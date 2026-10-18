import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { makeEntry, verifyChain, type AuditEntry } from '../src/domain/audit';
import { compareReadings } from '../src/domain/reconcile';
import type { InvoiceReading } from '../src/domain/types';
import { detectDocument } from '../src/extract/document';
import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicExtractor, documentBlocks, RecordedExtractor } from '../src/extract/extractor';
import { SpendMeter } from '../src/extract/spend';
import { toEvent } from '../src/telemetry';
import { activeAlerts, alertNotifier } from '../src/alerts';
import type { State } from '../src/store/store';
import { renderEml, type FixtureInvoice } from '../runner/render';
import { materialize, type CaseFile } from '../runner/harness';
import { OracleExtractor } from '../runner/oracle';
import { metrics, whatIf } from '../src/metrics';
import { summaryInvoice } from '../src/http';

const reading: InvoiceReading = {
  issuer_name: 'A',
  issuer_tax_id: 'SDA-190312-AB1',
  invoice_number: 'AUR 2026 0917',
  issue_date: '2026-10-15',
  due_date: null,
  currency: 'MXN',
  total: 42000,
  lines: [],
  payment_rail_hint: 'SPEI',
  payment_account: '0021 8070 0012 345678',
  suspicious_text: [],
};

describe('registro encadenado', () => {
  test('BHV-032 editar una entrada rompe la cadena en esa entrada', () => {
    const log: AuditEntry[] = [];
    for (let i = 1; i <= 5; i++) log.push(makeEntry(log.at(-1), { at: `t${i}`, invoice_id: null, type: 'x', actor: 'a', data: { amount: i } }));
    expect(verifyChain(log).ok).toBe(true);
    (log[2].data as { amount: number }).amount = 99999;
    const v = verifyChain(log);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.broken_at).toBe(3);
  });

  test('BHV-029 la frase del historial también queda encadenada', () => {
    const log: AuditEntry[] = [];
    for (let i = 1; i <= 3; i++) log.push(makeEntry(log.at(-1), { at: `t${i}`, invoice_id: null, type: 'x', actor: 'a', data: { amount: i }, summary_es: `frase ${i}`, summary_en: `line ${i}` }));
    // An entry written before the lines existed still verifies next to the new ones.
    log.push(makeEntry(log.at(-1), { at: 't4', invoice_id: null, type: 'x', actor: 'a', data: { amount: 4 } }));
    expect(verifyChain(log).ok).toBe(true);
    log[1].summary_es = 'PagoClaro pagó todo';
    const v = verifyChain(log);
    expect(v.ok === false && v.broken_at).toBe(2);
  });
});

describe('cruce de lecturas', () => {
  test('BHV-001 normaliza separadores antes de comparar', () => {
    expect(compareReadings(reading, { ...reading, issuer_tax_id: 'SDA190312AB1', invoice_number: 'AUR-2026-0917', payment_account: '002180700012345678' })).toEqual([]);
  });
  test('BHV-002 un total distinto se detecta', () => {
    expect(compareReadings(reading, { ...reading, total: 4200 })).toEqual(['total']);
  });
});

describe('documentos', () => {
  test('BHV-003 bytes que no son PDF se rechazan antes de leer', () => {
    const d = detectDocument('factura-rota.pdf', Buffer.from('no es un pdf'));
    expect(d.ok).toBe(false);
  });
  test('un correo trae su cuerpo como texto y el PDF adjunto como documento', async () => {
    const inv: FixtureInvoice = {
      file_name: 'X.eml',
      kind: 'email',
      language: 'es',
      issuer: { name: 'Aurora', tax_id_label: 'RFC', tax_id: 'SDA190312AB1', address: 'CDMX' },
      bill_to: { name: 'Northwind', tax_id_label: 'EIN', tax_id: '98-7654321', address: 'DE' },
      number: 'AUR-1',
      issue_date: '2026-10-15',
      currency_code: 'MXN',
      lines: [{ description: 'Servicio', amount: 1, amount_display: '1.00' }],
      total: 1,
      total_display: 'MXN 1.00',
      payment: { method: 'SPEI', label: 'CLABE', value: '002180700012345678' },
      email: { from: 'a@aurora.example.com', to: 'b@northwind.example.com', subject: 'Factura', body: 'Adjunto la factura.' },
    };
    const bytes = await renderEml(inv);
    const det = detectDocument('X.eml', bytes);
    expect(det.ok).toBe(true);
    const blocks = await documentBlocks(det.ok ? det.doc : (null as never));
    expect(blocks[0].type).toBe('text');
    expect(blocks.some((b) => b.type === 'document')).toBe(true);
  });
});

describe('lectores', () => {
  test('sin lectura guardada, la demo sin llave no llama a ningún modelo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    const r = new RecordedExtractor('claude-opus-5-5', dir, 'replay');
    const det = detectDocument('a.txt', Buffer.from('hola'));
    const res = await r.read(det.ok ? det.doc : (null as never));
    expect(res.ok).toBe(false);
  });
  test('el lector registra los tokens de razonamiento junto a los de entrada y salida', async () => {
    const fake = {
      messages: {
        parse: async () => ({
          stop_reason: 'end_turn',
          usage: { input_tokens: 3800, output_tokens: 320, output_tokens_details: { thinking_tokens: 120 } },
          parsed_output: { ...reading, due_date: null, payment_account: null },
        }),
      },
    } as unknown as Anthropic;
    const ex = new AnthropicExtractor(fake, 'claude-opus-5-5', new SpendMeter(50, null));
    const det = detectDocument('a.txt', Buffer.from('hola'));
    const res = await ex.read(det.ok ? det.doc : (null as never));
    expect(res.ok && res.usage).toMatchObject({ input_tokens: 3800, output_tokens: 320, reasoning_tokens: 120 });
    const ev = toEvent(
      { op: 'upload', invoice_id: 'i', kind: 'chat', outcome: 'PAID', failed_rules: [], policy_version: 1, latency_ms: 1, models: [{ model: 'claude-opus-5-5', input_tokens: 3800, output_tokens: 320, reasoning_tokens: 120, cost_usd: 0.02 }] },
      '2026-10-17T00:00:00Z',
    );
    expect(ev['pagoclaro.usage.reasoning_tokens']).toBe(120);
  });
  test('las alarmas del runbook se encienden con su umbral y avisan una sola vez', () => {
    const inv = (n: number, reasons: string[]) => ({ status: 'PENDING', received_at: `2026-10-17T10:0${n}:00Z`, reasons });
    const quiet = { payments_out_of_rules: 0, audit_chain_ok: true, model_spend_usd: 39.99, model_spend_cap_usd: 50 };
    const twoFailed = { invoices: { a: inv(1, ['READER_FAILED']), b: inv(2, ['READER_FAILED']), c: inv(0, []) } } as unknown as State;
    expect(activeAlerts(twoFailed, quiet)).toEqual([]);
    const threeFailed = { invoices: { ...twoFailed.invoices, d: inv(3, ['READER_FAILED']) } } as unknown as State;
    const loud = { payments_out_of_rules: 1, audit_chain_ok: false, model_spend_usd: 40, model_spend_cap_usd: 50 };
    expect(activeAlerts(threeFailed, loud).map((a) => a.code)).toEqual(['PAYMENT_OUT_OF_RULES', 'AUDIT_CHAIN_BROKEN', 'MODEL_SPEND_HIGH', 'READERS_FAILING']);
    const said: string[] = [];
    const notify = alertNotifier((line) => said.push(line));
    notify(activeAlerts(threeFailed, loud));
    notify(activeAlerts(threeFailed, loud));
    expect(said).toHaveLength(4);
    expect(said[0]).toMatch(/^\[ALERTA\] PAYMENT_OUT_OF_RULES/);
    notify([]);
    notify(activeAlerts(threeFailed, loud).slice(0, 1));
    expect(said).toHaveLength(5);
  });
  test('el medidor bloquea al llegar al tope', () => {
    const m = new SpendMeter(0.0001, null);
    expect(m.exhausted()).toBe(false);
    m.add('claude-opus-5-5', 10_000, 1_000);
    expect(m.exhausted()).toBe(true);
  });
});

describe('tablero', () => {
  test('el presupuesto del mes se cuenta como lo cuenta el libro: lo comprometido antes más lo pagado en el mes', async () => {
    const c = JSON.parse(readFileSync(join('evals', 'golden', 'EVL-013.json'), 'utf8')) as CaseFile;
    const p = new OracleExtractor('claude-opus-5-5');
    const k = new OracleExtractor('claude-haiku-5-5');
    const s = new OracleExtractor('claude-sonnet-5-5');
    const ctx = await materialize(c, { primary: p, check: k, tiebreak: s, onRender: (sha, inv) => (p.register(sha, inv), k.register(sha, inv), s.register(sha, inv)) });
    const b = metrics(ctx.state(), 0, 50).budget;
    // 10,000.00 USD committed before the month's run plus the 2,289.00 USD just paid (AUR-2026-0917).
    expect(b).toEqual({ period: '2026-10', budget_usd: 60000, committed_usd: 12289 });
  });
});

describe('tablero: datos de las gráficas', () => {
  const run = async (id: string) => {
    const dir = id.startsWith('ADV') ? 'adversarial' : 'golden';
    const c = JSON.parse(readFileSync(join('evals', dir, `${id}.json`), 'utf8')) as CaseFile;
    const p = new OracleExtractor('claude-opus-5-5');
    const k = new OracleExtractor('claude-haiku-5-5');
    const s = new OracleExtractor('claude-sonnet-5-5');
    return materialize(c, { primary: p, check: k, tiebreak: s, onRender: (sha, inv) => (p.register(sha, inv), k.register(sha, inv), s.register(sha, inv)) });
  };

  test('la lista dice de qué proveedor es, cuándo vence y si hizo falta el desempate', async () => {
    const ctx = await run('EVL-036');
    const s = ctx.state();
    const row = summaryInvoice(Object.values(s.invoices)[0], s);
    // Readings that disagree escalate before the vendor is looked up.
    expect(row.vendor_id).toBeNull();
    expect(row.readers).toBe('tiebreak');
    expect(row.expires_at).toBe(Object.values(s.pending)[0].expires_at);
    const paid = await run('EVL-013');
    const p = summaryInvoice(Object.values(paid.state().invoices)[0], paid.state());
    expect(p.vendor_id).toBe('ven_aurora');
    expect(p.readers).toBe('agree');
    expect(p.expires_at).toBeNull();
  });

  test('la simulación de reglas cuenta las decisiones antes y después', async () => {
    const ctx = await run('EVL-013');
    const s = ctx.state();
    const r = whatIf(s, { ...s.rules_versions[0].rules, auto_approve_up_to_usd: 1000 });
    expect(r.before).toEqual({ PAY: 1, HOLD: 0, ESCALATE: 0 });
    expect(r.after).toEqual({ PAY: 0, HOLD: 0, ESCALATE: 1 });
    expect(r.changed).toBe(1);
  });
});
