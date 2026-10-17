// HTTP API and dashboard. Closed schemas reject unknown fields; writes need the access code; the
// client never supplies a decision (spec BHV-039).
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PagoClaro } from './agent/pipeline';
import { maskAccount } from './domain/normalize';
import { RulesSchema } from './domain/rules';
import type { ReadResult } from './domain/types';
import { metrics, whatIf } from './metrics';
import { appendAudit, currentRules, type InvoiceRecord, type State } from './store/store';
import type { Telemetry } from './telemetry';

export interface HttpDeps {
  agent: PagoClaro;
  accessCode: string | null;
  spend: () => { usd: number; cap: number };
  telemetry: Telemetry;
  mode: string;
  webDir?: string;
  logger?: boolean;
}

const Actor = z.string().trim().min(2).max(60).regex(/^[\p{L}0-9._@ -]+$/u, 'nombre de actor inválido');
const UploadBody = z.object({ file_name: z.string().min(3).max(120), content_base64: z.string().min(4).max(15_000_000), actor: Actor }).strict();
const ApproveBody = z.object({ actor: Actor, note: z.string().max(500).optional(), confirm_reading: z.enum(['primary', 'check']).optional() }).strict();
const RejectBody = z.object({ actor: Actor, reason: z.string().min(3).max(500) }).strict();
const VoidBody = z.object({ actor: Actor, reason: z.string().min(3).max(500) }).strict();
const RulesBody = z.object({ actor: Actor, rules: z.any() }).strict();
const WhatIfBody = z.object({ rules: z.any() }).strict();

function maskReading(r: ReadResult | null) {
  if (!r || !r.ok) return r;
  return { ...r, reading: { ...r.reading, payment_account: r.reading.payment_account ? maskAccount(r.reading.payment_account) : null } };
}

export function publicInvoice(i: InvoiceRecord, s: State) {
  const ev = i.evaluation_id ? s.evaluations[i.evaluation_id] : null;
  const pay = i.payment_id ? s.payments[i.payment_id] : null;
  const pending = i.pending_id ? s.pending[i.pending_id] : null;
  return {
    id: i.id,
    document: i.document,
    uploaded_by: i.uploaded_by,
    received_at: i.received_at,
    status: i.status,
    reasons: i.reasons,
    issuer_name: i.issuer_name,
    invoice_number: i.invoice_number,
    issue_date: i.issue_date,
    total: i.total,
    currency: i.currency,
    amount_usd: i.amount_usd,
    decided_at: i.decided_at,
    reading_used: i.reading_used,
    readings: { primary: maskReading(i.readings.primary), check: maskReading(i.readings.check) },
    vendor: i.facts?.vendor ? { ...(i.facts.vendor as object), account: maskAccount((i.facts.vendor as { account: string }).account) } : null,
    agreement: i.facts?.agreement ?? null,
    fx: i.facts?.fx ?? null,
    ledger: i.facts?.ledger ?? null,
    evaluation: ev,
    payment: pay ? { ...pay, account: undefined } : null,
    pending,
  };
}

export async function buildHttp(deps: HttpDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 16 * 1024 * 1024 });
  const { agent } = deps;
  const store = agent.store;

  const bad = (reply: FastifyReply, code: number, error: string, message: string) => reply.code(code).send({ ok: false, error, message });
  const parse = <T>(schema: z.ZodType<T>, body: unknown, reply: FastifyReply): T | null => {
    const r = schema.safeParse(body);
    if (!r.success) {
      bad(reply, 400, 'INVALID_REQUEST', r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
      return null;
    }
    return r.data;
  };
  const authorized = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!deps.accessCode) {
      bad(reply, 403, 'WRITES_DISABLED', 'escrituras deshabilitadas: esta instancia no tiene PAGOCLARO_ACCESS_CODE');
      return false;
    }
    if (req.headers['x-access-code'] !== deps.accessCode) {
      bad(reply, 401, 'BAD_ACCESS_CODE', 'código de acceso inválido');
      return false;
    }
    return true;
  };

  app.get('/health', async () => ({ ok: true, service: 'pagoclaro', mode: deps.mode, writes: !!deps.accessCode, audit_chain_ok: agent.verifyAudit().ok }));

  app.get('/api/summary', async () => {
    await agent.sweepExpired();
    const s = store.read();
    const sp = deps.spend();
    return {
      mode: deps.mode,
      writes: !!deps.accessCode,
      metrics: metrics(s, sp.usd, sp.cap),
      rules: s.rules_versions.length ? currentRules(s) : null,
      invoices: Object.values(s.invoices)
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .map((i) => ({ id: i.id, status: i.status, reasons: i.reasons, issuer_name: i.issuer_name, invoice_number: i.invoice_number, total: i.total, currency: i.currency, amount_usd: i.amount_usd, received_at: i.received_at, kind: i.document.kind, filename: i.document.filename, uploaded_by: i.uploaded_by })),
    };
  });

  app.get('/api/invoices/:id', async (req, reply) => {
    const s = store.read();
    const inv = s.invoices[(req.params as { id: string }).id];
    if (!inv) return bad(reply, 404, 'NOT_FOUND', 'factura no encontrada');
    return { invoice: publicInvoice(inv, s), audit: s.audit.filter((e) => e.invoice_id === inv.id) };
  });

  app.post('/api/invoices', async (req, reply) => {
    const body = parse(UploadBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const bytes = Buffer.from(body.content_base64, 'base64');
    const res = await agent.upload(body.file_name, bytes, body.actor);
    return { ok: true, ...res };
  });

  app.post('/api/invoices/:id/approve', async (req, reply) => {
    const body = parse(ApproveBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const r = await agent.approve((req.params as { id: string }).id, body.actor, body.note ?? null, body.confirm_reading);
    if (!r.ok) return bad(reply, r.status ?? 400, r.code, r.message);
    return r;
  });

  app.post('/api/invoices/:id/reject', async (req, reply) => {
    const body = parse(RejectBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const r = await agent.reject((req.params as { id: string }).id, body.actor, body.reason);
    if (!r.ok) return bad(reply, r.status ?? 400, r.code, r.message);
    return r;
  });

  app.post('/api/payments/:id/void', async (req, reply) => {
    const body = parse(VoidBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const r = await agent.voidPayment((req.params as { id: string }).id, body.actor, body.reason);
    if (!r.ok) return bad(reply, r.status ?? 400, r.code, r.message);
    return r;
  });

  app.get('/api/rules', async () => {
    const s = store.read();
    return { current: currentRules(s), versions: s.rules_versions.map((v) => ({ version: v.rules.version, approved_by: v.approved_by, at: v.at })) };
  });

  app.put('/api/rules', async (req, reply) => {
    const body = parse(RulesBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const s = store.read();
    const next = RulesSchema.safeParse({ ...(body.rules as object), version: currentRules(s).version + 1 });
    if (!next.success) return bad(reply, 400, 'INVALID_RULES', next.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    const at = new Date().toISOString();
    store.tx((d) => {
      d.rules_versions.push({ rules: next.data, approved_by: body.actor, at });
      appendAudit(d, { at, invoice_id: null, type: 'rules.changed', actor: body.actor, data: { version: next.data.version, rules: next.data } });
    });
    return { ok: true, rules: next.data };
  });

  app.post('/api/what-if', async (req, reply) => {
    const body = parse(WhatIfBody, req.body, reply);
    if (!body) return;
    const s = store.read();
    const rules = RulesSchema.safeParse({ ...(body.rules as object), version: currentRules(s).version + 1 });
    if (!rules.success) return bad(reply, 400, 'INVALID_RULES', rules.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return { ok: true, ...whatIf(s, rules.data) };
  });

  app.get('/api/catalog', async () => {
    const s = store.read();
    return { vendors: s.vendors.map((v) => ({ ...v, account: maskAccount(v.account) })), agreements: s.agreements, fx_table: s.fx_table };
  });

  app.get('/api/audit', async () => ({ entries: store.read().audit, verify: agent.verifyAudit() }));
  app.get('/api/audit/verify', async () => agent.verifyAudit());
  app.get('/api/telemetry', async () => ({ events: deps.telemetry.events.slice(-100) }));

  // Dashboard (static files from web/).
  const webDir = deps.webDir ?? 'web';
  const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
  const serve = async (file: string, reply: FastifyReply) => {
    if (!/^[a-z0-9._-]+$/i.test(file)) return bad(reply, 404, 'NOT_FOUND', 'no existe');
    try {
      const data = await readFile(join(webDir, file));
      return reply.type(TYPES[extname(file)] ?? 'application/octet-stream').send(data);
    } catch {
      return bad(reply, 404, 'NOT_FOUND', 'no existe');
    }
  };
  app.get('/', async (_req, reply) => serve('index.html', reply));
  app.get('/:file', async (req, reply) => serve((req.params as { file: string }).file, reply));

  return app;
}
