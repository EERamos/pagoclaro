// Materializes one eval case: a fresh in-memory world, the fixture's invoice drawn as a real file,
// the case's actions sent through the real HTTP ingress, and a log of everything to check.
import type { FastifyInstance } from 'fastify';
import type { PagoClaro } from '../src/agent/pipeline';
import type { ToolOverrides, Toolbox, ToolName } from '../src/agent/tools';
import { makeEntry } from '../src/domain/audit';
import { newId, normInvoiceNumber, normTaxId } from '../src/domain/normalize';
import type { ReadResult, RuleCode } from '../src/domain/types';
import { sha256 } from '../src/extract/document';
import type { Extractor } from '../src/extract/extractor';
import { createPagoClaro } from '../src/factory';
import { buildHttp } from '../src/http';
import { JsonStore, type InvoiceRecord, type State, type Store } from '../src/store/store';
import type { Telemetry } from '../src/telemetry';
import { seedWorld, type World } from '../src/world';
import { renderInvoice, type FixtureInvoice } from './render';

export interface CaseFile {
  id: string;
  bhv_ref: string;
  method: 'deterministic' | 'llm_judge' | 'adversarial';
  tier: 'safe' | 'reversible' | 'destructive';
  input: { message: string; fixture: Fixture };
  expected: {
    trajectory?: { mode: 'ANY_ORDER' | 'IN_ORDER' | 'EXACT'; tools: { name: string; args_subset?: Record<string, unknown> }[] };
    asserts: string[];
    forbidden: string[];
  };
  human_review?: boolean;
}

interface PreloadedPending {
  invoice: FixtureInvoice;
  readings: { primary: ReadResult; check: ReadResult };
  status: 'PENDING';
  reasons: RuleCode[];
  uploaded_by: string;
  escalated_at: string;
}

type Action =
  | { type: 'upload'; actor: string; access_code: string; invoice_number?: string }
  | { type: 'api_upload'; actor: string; access_code: string; extra_fields: Record<string, unknown> }
  | { type: 'approve'; invoice_number: string; actor: string; access_code: string; note: string | null }
  | { type: 'view_detail'; invoice_number: string }
  | { type: 'verify_audit' }
  | { type: 'add_vendor'; actor: string; access_code: string; vendor: Record<string, unknown> }
  | { type: 'update_vendor'; tax_id: string; actor: string; access_code: string; changes: Record<string, unknown> }
  | { type: 'confirm_account'; tax_id: string; actor: string; access_code: string; note: string };

export interface Fixture extends World {
  today: string;
  access_code: string;
  actor: string;
  invoice?: FixtureInvoice;
  /** Several invoices in one case; each upload names its invoice_number. */
  invoices?: FixtureInvoice[];
  actions: Action[];
  store?: PreloadedPending[];
  harness_condition?: Record<string, unknown>;
  audit_seed_entries?: number;
  tamper?: { seq: number; field: string; value: unknown };
}

export interface Response {
  action: Action['type'];
  status: number;
  body: any;
}

export interface RunCtx {
  c: CaseFile;
  fixture: Fixture;
  store: Store;
  agent: PagoClaro;
  tools: Toolbox;
  telemetry: Telemetry;
  http: FastifyInstance;
  responses: Response[];
  state(): State;
  invoiceByNumber(n: string): InvoiceRecord | undefined;
}

export interface Readers {
  primary: Extractor;
  check: Extractor;
  tiebreak: Extractor;
  /** Called with every rendered document, so a test double can map it to its fixture. */
  onRender?: (sha: string, inv: FixtureInvoice) => void;
}

const TOOL_NAMES = new Set<ToolName>(['read_invoice_primary', 'read_invoice_check', 'read_invoice_tiebreak', 'find_vendor', 'find_agreement', 'query_ledger', 'convert_currency', 'evaluate_rules', 'record_payment', 'record_hold', 'escalate_to_human']);

/** harness_condition → injected tool backends. A key the runner cannot bind fails the run. */
export function bindHarness(h: Record<string, unknown> | undefined): ToolOverrides {
  const o: ToolOverrides = {};
  if (!h) return o;
  for (const [k, v] of Object.entries(h)) {
    if (k === 'tool_always_errors') {
      const tools = (Array.isArray(v) ? v : [v]) as ToolName[];
      for (const t of tools) if (!TOOL_NAMES.has(t)) throw new Error(`harness_condition: herramienta desconocida "${String(t)}"`);
      o.alwaysErrors = { tools, error: String(h.error ?? 'PROVIDER_ERROR') };
    } else if (k === 'error') {
      continue;
    } else if (k.endsWith('_returns')) {
      const tool = k.slice(0, -'_returns'.length) as ToolName;
      if (!TOOL_NAMES.has(tool)) throw new Error(`harness_condition: herramienta desconocida en "${k}"`);
      (o.returns ??= {})[tool] = v;
    } else {
      throw new Error(`harness_condition: clave que el runner no sabe ligar: "${k}"`);
    }
  }
  return o;
}

export async function materialize(c: CaseFile, readers: Readers): Promise<RunCtx> {
  const fx = c.input.fixture;
  let clock = Date.parse(fx.today);
  const now = () => new Date(clock);
  const store = new JsonStore(null);
  seedWorld(store, fx, fx.today);
  const overrides = bindHarness(fx.harness_condition);
  const { agent, tools, telemetry } = createPagoClaro({ store, primary: readers.primary, check: readers.check, tiebreak: readers.tiebreak, now, overrides });
  const http = await buildHttp({ agent, accessCode: fx.access_code, spend: () => ({ usd: 0, cap: 50 }), telemetry, mode: 'eval', notify: () => {} });

  // Pending items that already exist when the case starts (their readings were taken before).
  for (const p of fx.store ?? []) {
    const r = await renderInvoice(p.invoice);
    const sha = sha256(r.bytes);
    const at = p.escalated_at;
    const rules = fx.rules;
    store.tx((d) => {
      const id = newId('inv', Date.parse(at));
      const pid = newId('pnd', Date.parse(at));
      const primary = p.readings.primary as Extract<ReadResult, { ok: true }>;
      d.invoices[id] = {
        id,
        document: { sha256: sha, kind: p.invoice.kind === 'corrupt' ? 'pdf' : p.invoice.kind, filename: r.filename, media_type: 'application/pdf', size: r.bytes.length },
        uploaded_by: p.uploaded_by,
        received_at: at,
        readings: { primary: p.readings.primary, check: p.readings.check, primary_attempts: 1, check_attempts: 1, tiebreak: null, tiebreak_attempts: 0, tiebreak_role: null },
        reading_used: 'primary',
        facts: null,
        vendor_id: null,
        issuer_name: primary.reading.issuer_name,
        invoice_number: primary.reading.invoice_number,
        issue_date: primary.reading.issue_date,
        total: primary.reading.total,
        currency: primary.reading.currency,
        amount_usd: null,
        evaluation_id: null,
        status: 'PENDING',
        reasons: p.reasons,
        decided_at: null,
        payment_id: null,
        pending_id: pid,
      };
      d.pending[pid] = { id: pid, invoice_id: id, reasons: p.reasons, created_at: at, expires_at: new Date(Date.parse(at) + rules.pending_timeout_hours * 3_600_000).toISOString(), resolved_at: null, resolved_by: null, resolution: null, note: null };
    });
  }

  // An audit log of N chained entries, then one entry edited by hand (BHV-032).
  if (fx.audit_seed_entries) {
    store.tx((d) => {
      d.audit = [];
      for (let k = 1; k <= fx.audit_seed_entries!; k++) {
        d.audit.push(makeEntry(d.audit.at(-1), { at: new Date(clock + k * 1000).toISOString(), invoice_id: null, type: 'seed', actor: 'seed', data: { amount: k * 100 } }));
      }
      if (fx.tamper) {
        const e = d.audit[fx.tamper.seq - 1] as unknown as Record<string, any>;
        const path = fx.tamper.field.split('.');
        let o = e;
        for (const k of path.slice(0, -1)) o = o[k];
        o[path.at(-1)!] = fx.tamper.value;
      }
    });
  }

  const responses: Response[] = [];
  const ctx: RunCtx = {
    c,
    fixture: fx,
    store,
    agent,
    tools,
    telemetry,
    http,
    responses,
    state: () => store.read(),
    invoiceByNumber: (n) => Object.values(store.read().invoices).find((i) => normInvoiceNumber(i.invoice_number) === normInvoiceNumber(n)),
  };

  const vendorIdByTaxId = (taxId: string) => {
    const v = store.read().vendors.find((x) => normTaxId(x.tax_id) === normTaxId(taxId));
    if (!v) throw new Error(`no hay proveedor con identificación ${taxId}`);
    return v.id;
  };
  for (const a of fx.actions) {
    clock += 60_000;
    if (a.type === 'upload' || a.type === 'api_upload') {
      const want = a.type === 'upload' ? a.invoice_number : undefined;
      const invoice = want ? fx.invoices?.find((i) => normInvoiceNumber(i.number) === normInvoiceNumber(want)) : (fx.invoice ?? fx.invoices?.[0]);
      if (!invoice) throw new Error(`el caso sube una factura${want ? ` ${want}` : ''} que no está en el fixture`);
      const r = await renderInvoice(invoice);
      readers.onRender?.(sha256(r.bytes), invoice);
      const payload: Record<string, unknown> = { file_name: r.filename, content_base64: r.bytes.toString('base64'), actor: a.actor, ...(a.type === 'api_upload' ? a.extra_fields : {}) };
      const res = await http.inject({ method: 'POST', url: '/api/invoices', headers: { 'x-access-code': a.access_code }, payload });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'approve') {
      const inv = ctx.invoiceByNumber(a.invoice_number);
      if (!inv) throw new Error(`no hay factura ${a.invoice_number} para aprobar`);
      const payload: Record<string, unknown> = { actor: a.actor, ...(a.note ? { note: a.note } : {}) };
      const res = await http.inject({ method: 'POST', url: `/api/invoices/${inv.id}/approve`, headers: { 'x-access-code': a.access_code }, payload });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'view_detail') {
      const inv = ctx.invoiceByNumber(a.invoice_number);
      if (!inv) throw new Error(`no hay factura ${a.invoice_number} para ver`);
      const res = await http.inject({ method: 'GET', url: `/api/invoices/${inv.id}` });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'verify_audit') {
      const res = await http.inject({ method: 'GET', url: '/api/audit/verify' });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'add_vendor') {
      const res = await http.inject({ method: 'POST', url: '/api/vendors', headers: { 'x-access-code': a.access_code }, payload: { actor: a.actor, vendor: a.vendor } });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'update_vendor') {
      const res = await http.inject({ method: 'PATCH', url: `/api/vendors/${vendorIdByTaxId(a.tax_id)}`, headers: { 'x-access-code': a.access_code }, payload: { actor: a.actor, ...a.changes } });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else if (a.type === 'confirm_account') {
      const res = await http.inject({ method: 'POST', url: `/api/vendors/${vendorIdByTaxId(a.tax_id)}/confirm-account`, headers: { 'x-access-code': a.access_code }, payload: { actor: a.actor, note: a.note } });
      responses.push({ action: a.type, status: res.statusCode, body: res.json() });
    } else {
      throw new Error(`acción desconocida: ${(a as { type: string }).type}`);
    }
  }
  await http.close();
  return ctx;
}

export function checkTrajectory(c: CaseFile, ctx: RunCtx): string | null {
  const t = c.expected.trajectory;
  if (!t || t.tools.length === 0) return null;
  const calls = ctx.tools.calls;
  const matches = (call: { name: string; args: Record<string, unknown> }, want: { name: string; args_subset?: Record<string, unknown> }) =>
    call.name === want.name && Object.entries(want.args_subset ?? {}).every(([k, v]) => JSON.stringify(call.args[k]) === JSON.stringify(v));
  if (t.mode === 'ANY_ORDER') {
    for (const w of t.tools) if (!calls.some((c2) => matches(c2, w))) return `trayectoria: falta ${w.name}${w.args_subset ? ` con ${JSON.stringify(w.args_subset)}` : ''}`;
    return null;
  }
  if (t.mode === 'IN_ORDER') {
    let i = 0;
    for (const w of t.tools) {
      while (i < calls.length && !matches(calls[i], w)) i++;
      if (i >= calls.length) return `trayectoria: ${w.name} no aparece en orden (llamadas: ${calls.map((x) => x.name).join(' > ')})`;
      i++;
    }
    return null;
  }
  if (calls.length !== t.tools.length || !t.tools.every((w, k) => matches(calls[k], w))) return `trayectoria EXACT distinta: ${calls.map((x) => x.name).join(' > ')}`;
  return null;
}
