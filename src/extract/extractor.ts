// The Extractor seam (design §5): one interface, three implementations — Anthropic (live), recorded
// readings (tests and the public demo, no key) and local Ollama (text documents only, no cost).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../util/atomic';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import PostalMime from 'postal-mime';
import { z } from 'zod';
import type { InvoiceReading, ReadResult } from '../domain/types';
import type { InvoiceDocument } from './document';
import { READER_SYSTEM, READER_USER, ReadingSchema, type ParsedReading } from './prompt';
import type { SpendMeter } from './spend';

export interface Extractor {
  readonly model: string;
  read(doc: InvoiceDocument): Promise<ReadResult>;
}

function toReading(p: ParsedReading): InvoiceReading {
  return {
    issuer_name: p.issuer_name.trim(),
    issuer_tax_id: p.issuer_tax_id.trim(),
    invoice_number: p.invoice_number.trim(),
    issue_date: p.issue_date.trim(),
    due_date: p.due_date?.trim() || null,
    currency: p.currency,
    total: p.total,
    lines: p.lines.filter((l) => Number.isFinite(l.amount)),
    payment_rail_hint: p.payment_rail_hint,
    payment_account: p.payment_account?.trim() || null,
    suspicious_text: p.suspicious_text.map((s) => s.trim()).filter(Boolean),
  };
}

type Block = Anthropic.ContentBlockParam;

/** Builds the user-turn blocks for a document. Email bodies and chats go as text inside tags. */
export async function documentBlocks(doc: InvoiceDocument): Promise<Block[]> {
  if (doc.kind === 'pdf') {
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.bytes.toString('base64') } }];
  }
  if (doc.kind === 'image') {
    const mt = doc.mediaType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    return [{ type: 'image', source: { type: 'base64', media_type: mt, data: doc.bytes.toString('base64') } }];
  }
  if (doc.kind === 'chat') {
    return [{ type: 'text', text: `<mensaje_de_chat_recibido>\n${doc.bytes.toString('utf8')}\n</mensaje_de_chat_recibido>` }];
  }
  const email = await PostalMime.parse(doc.bytes);
  const header = [`De: ${email.from?.address ?? ''}`, `Para: ${(email.to ?? []).map((t) => t.address).join(', ')}`, `Asunto: ${email.subject ?? ''}`].join('\n');
  const blocks: Block[] = [{ type: 'text', text: `<correo_recibido>\n${header}\n\n${email.text ?? ''}\n</correo_recibido>` }];
  for (const a of email.attachments ?? []) {
    const data = Buffer.from(a.content as ArrayBuffer).toString('base64');
    if (a.mimeType === 'application/pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    else if (a.mimeType === 'image/png' || a.mimeType === 'image/jpeg') blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType, data } });
  }
  return blocks;
}

export interface AnthropicExtractorOptions {
  timeoutMs: number;
  effort: 'low' | 'medium' | 'high';
}

export class AnthropicExtractor implements Extractor {
  constructor(
    private readonly client: Anthropic,
    readonly model: string,
    private readonly spend: SpendMeter,
    private readonly opts: AnthropicExtractorOptions = { timeoutMs: 40_000, effort: 'low' },
  ) {}

  async read(doc: InvoiceDocument): Promise<ReadResult> {
    if (this.spend.exhausted()) {
      return { ok: false, error: 'BUDGET_EXHAUSTED', message: `se alcanzó el tope de gasto de ${this.spend.capUsd} USD` };
    }
    let blocks: Block[];
    try {
      blocks = await documentBlocks(doc);
    } catch {
      return { ok: false, error: 'UNREADABLE', message: 'no se pudo abrir el documento' };
    }
    try {
      const resp = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: 8000,
          system: READER_SYSTEM,
          messages: [{ role: 'user', content: [...blocks, { type: 'text', text: READER_USER }] }],
          output_config: { format: zodOutputFormat(ReadingSchema), effort: this.opts.effort },
        },
        { timeout: this.opts.timeoutMs, maxRetries: 0 },
      );
      const cost = this.spend.add(this.model, resp.usage.input_tokens, resp.usage.output_tokens);
      const usage = { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens, cost_usd: cost };
      if (resp.stop_reason === 'refusal') return { ok: false, error: 'PROVIDER_ERROR', message: 'el modelo se negó a leer el documento' };
      if (resp.stop_reason === 'max_tokens') return { ok: false, error: 'PROVIDER_ERROR', message: 'la respuesta se cortó' };
      const parsed = resp.parsed_output;
      if (!parsed) return { ok: false, error: 'PROVIDER_ERROR', message: 'la salida no cumplió el esquema' };
      return { ok: true, reading: toReading(parsed), model: this.model, usage };
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, error: 'TIMEOUT', message: 'el lector no respondió a tiempo' };
      if (e instanceof Anthropic.BadRequestError) {
        const m = e.message.toLowerCase();
        if (m.includes('pdf') || m.includes('image') || m.includes('document')) return { ok: false, error: 'UNREADABLE', message: 'el proveedor no pudo procesar el archivo' };
        return { ok: false, error: 'PROVIDER_ERROR', message: `petición rechazada (400)` };
      }
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: 'PROVIDER_ERROR', message: 'la API key no es válida' };
      if (e instanceof Anthropic.RateLimitError) return { ok: false, error: 'PROVIDER_ERROR', message: 'límite de peticiones del proveedor' };
      if (e instanceof Anthropic.APIError) return { ok: false, error: 'PROVIDER_ERROR', message: `error del proveedor (${e.status ?? 'sin estado'})` };
      return { ok: false, error: 'PROVIDER_ERROR', message: 'error inesperado del lector' };
    }
  }
}

/**
 * Readings recorded per model and document hash. `replay` never calls a model (tests, public demo
 * without a key); `record` reads through `inner` and saves what it got.
 */
export class RecordedExtractor implements Extractor {
  constructor(
    readonly model: string,
    private readonly dir: string,
    private readonly mode: 'replay' | 'record',
    private readonly inner: Extractor | null = null,
  ) {}

  private path(sha: string): string {
    return join(this.dir, this.model, `${sha}.json`);
  }

  async read(doc: InvoiceDocument): Promise<ReadResult> {
    const p = this.path(doc.sha256);
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as ReadResult;
    if (this.mode === 'replay' || !this.inner) {
      return { ok: false, error: 'PROVIDER_ERROR', message: 'no hay lectura guardada para este archivo y la demo no tiene API key' };
    }
    const res = await this.inner.read(doc);
    if (res.ok) atomicWrite(p, JSON.stringify(res, null, 2));
    return res;
  }
}

/** Local reader through Ollama (no cost). Text documents only: emails and chats. */
export class OllamaExtractor implements Extractor {
  constructor(
    readonly model: string,
    private readonly baseUrl = 'http://localhost:11434',
  ) {}

  async read(doc: InvoiceDocument): Promise<ReadResult> {
    if (doc.kind === 'pdf' || doc.kind === 'image') {
      return { ok: false, error: 'UNREADABLE', message: 'el lector local solo lee correos y chats' };
    }
    const blocks = await documentBlocks(doc);
    const text = blocks.filter((b): b is Anthropic.TextBlockParam => b.type === 'text').map((b) => b.text).join('\n\n');
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          think: false,
          format: z2json(),
          messages: [
            { role: 'system', content: READER_SYSTEM },
            { role: 'user', content: `${text}\n\n${READER_USER}` },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) return { ok: false, error: 'PROVIDER_ERROR', message: `ollama ${res.status}` };
      const body = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      const parsed = ReadingSchema.safeParse(JSON.parse(body.message?.content ?? '{}'));
      if (!parsed.success) return { ok: false, error: 'PROVIDER_ERROR', message: 'la salida no cumplió el esquema' };
      return { ok: true, reading: toReading(parsed.data), model: this.model, usage: { input_tokens: body.prompt_eval_count ?? 0, output_tokens: body.eval_count ?? 0, cost_usd: 0 } };
    } catch {
      return { ok: false, error: 'PROVIDER_ERROR', message: 'ollama no respondió' };
    }
  }
}

function z2json(): unknown {
  return z.toJSONSchema(ReadingSchema);
}
