// HTTP API and dashboard. Closed schemas reject unknown fields; writes need the access code; the
// client never supplies a decision (spec BHV-039).
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { waitingFor, type PagoClaro, type VendorResult } from './agent/pipeline';
import { alertNotifier, type Alert } from './alerts';
import { maskAccount } from './domain/normalize';
import { RulesSchema } from './domain/rules';
import type { ReadResult, Vendor } from './domain/types';
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
  /** Receives the firing alarms after each API call; prints "[ALERTA]" lines by default. */
  notify?: (alerts: Alert[]) => void;
}

const Actor = z.string().trim().min(2).max(60).regex(/^[\p{L}0-9._@ -]+$/u, 'nombre de actor inválido');
const UploadBody = z.object({ file_name: z.string().min(3).max(120), content_base64: z.string().min(4).max(15_000_000), actor: Actor }).strict();
const ApproveBody = z.object({ actor: Actor, note: z.string().max(500).optional(), confirm_reading: z.enum(['primary', 'check', 'tiebreak']).optional() }).strict();
const Account = z.string().trim().min(4).max(64).regex(/^[\p{L}0-9@._+\- ]+$/u, 'cuenta inválida');
const NewVendorBody = z
  .object({
    actor: Actor,
    vendor: z
      .object({
        name: z.string().trim().min(2).max(120),
        tax_id: z.string().trim().min(3).max(32),
        country: z.string().trim().regex(/^[A-Z]{2}$/, 'país de 2 letras'),
        currency: z.enum(['USD', 'MXN', 'COP', 'BRL', 'EUR']),
        rail: z.enum(['SPEI', 'PIX', 'BRE_B', 'ACH']),
        account: Account,
      })
      .strict(),
  })
  .strict();
const VendorPatchBody = z.object({ actor: Actor, status: z.enum(['active', 'inactive']).optional(), account: Account.optional(), reason: z.string().max(300).optional() }).strict();
const ConfirmAccountBody = z.object({ actor: Actor, note: z.string().max(500).optional() }).strict();
const RejectBody = z.object({ actor: Actor, reason: z.string().min(3).max(500) }).strict();
const VoidBody = z.object({ actor: Actor, reason: z.string().min(3).max(500) }).strict();
const RulesBody = z.object({ actor: Actor, rules: z.any() }).strict();
const WhatIfBody = z.object({ rules: z.any() }).strict();

function maskReading(r: ReadResult | null) {
  if (!r || !r.ok) return r;
  return { ...r, reading: { ...r.reading, payment_account: r.reading.payment_account ? maskAccount(r.reading.payment_account) : null } };
}

const maskOrNull = (a: string | null | undefined) => (a ? maskAccount(a) : null);

/** The vendor as the dashboard shows it: accounts masked, and how many invoices wait on its account. */
export function publicVendor(v: Vendor, s: State) {
  return {
    id: v.id,
    name: v.name,
    tax_id: v.tax_id,
    country: v.country,
    currency: v.currency,
    rail: v.rail,
    account: maskOrNull(v.account),
    pending_account: maskOrNull(v.pending_account?.value),
    pending_changed_by: v.pending_account?.changed_by ?? null,
    pending_changed_at: v.pending_account?.changed_at ?? null,
    pending_reason: v.pending_account?.reason ?? null,
    account_confirmed_by: v.account_confirmed_by ?? null,
    account_confirmed_at: v.account_confirmed_at ?? null,
    added_by: v.added_by ?? null,
    added_at: v.added_at ?? null,
    status: v.status,
    waiting_invoices: waitingFor(s, v.id, v.pending_account?.value, v.account),
  };
}

/** The latest plain-language line about an invoice's decision. */
function latestSummary(s: State, invoiceId: string): { summary_es: string | null; summary_en: string | null } {
  const e = [...s.audit].reverse().find((x) => x.invoice_id === invoiceId && x.summary_es && (x.type.startsWith('decision.') || x.type === 'invoice.error' || x.type === 'payment.voided'))
    ?? [...s.audit].reverse().find((x) => x.invoice_id === invoiceId && x.summary_es);
  return { summary_es: e?.summary_es ?? null, summary_en: e?.summary_en ?? null };
}

/**
 * One row of the invoice list: what the list and the charts need, accounts never included.
 * `readers` says how the reading was settled: both readers agreed, the tie-break settled it, or the
 * tie-break stood in for a failed check reader.
 */
export function summaryInvoice(i: InvoiceRecord, s: State) {
  const p = i.pending_id ? s.pending[i.pending_id] : null;
  const role = i.readings.tiebreak_role ?? null;
  const agreed = !!i.readings.primary?.ok && !!i.readings.check?.ok;
  return {
    id: i.id,
    status: i.status,
    reasons: i.reasons,
    issuer_name: i.issuer_name,
    invoice_number: i.invoice_number,
    total: i.total,
    currency: i.currency,
    amount_usd: i.amount_usd,
    received_at: i.received_at,
    kind: i.document.kind,
    filename: i.document.filename,
    uploaded_by: i.uploaded_by,
    vendor_id: i.vendor_id,
    expires_at: p && !p.resolved_at && i.status === 'PENDING' ? p.expires_at : null,
    readers: role ?? (agreed ? 'agree' : null),
    ...latestSummary(s, i.id),
  };
}

export function publicInvoice(i: InvoiceRecord, s: State) {
  const ev = i.evaluation_id ? s.evaluations[i.evaluation_id] : null;
  const pay = i.payment_id ? s.payments[i.payment_id] : null;
  const pending = i.pending_id ? s.pending[i.pending_id] : null;
  const vendor = i.facts?.vendor ?? null;
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
    readings: { primary: maskReading(i.readings.primary), check: maskReading(i.readings.check), tiebreak: maskReading(i.readings.tiebreak ?? null), tiebreak_role: i.readings.tiebreak_role ?? null },
    vendor: vendor ? { ...vendor, account: maskOrNull(vendor.account), pending_account: maskOrNull(vendor.pending_account) } : null,
    agreement: i.facts?.agreement ?? null,
    fx: i.facts?.fx ?? null,
    ledger: i.facts?.ledger ?? null,
    provenance: i.facts?.provenance ?? null,
    evaluation: ev,
    payment: pay ? { ...pay, account: undefined } : null,
    pending: pending ? { ...pending, suggested_reading: pending.suggested_reading ?? null } : null,
    ...latestSummary(s, i.id),
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

  const alerts = () => {
    const sp = deps.spend();
    return metrics(store.read(), sp.usd, sp.cap).alerts;
  };
  const notify = deps.notify ?? alertNotifier();
  app.addHook('onResponse', async (req) => {
    if (req.url === '/health' || req.url.startsWith('/api/')) notify(alerts());
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'pagoclaro',
    mode: deps.mode,
    writes: !!deps.accessCode,
    audit_chain_ok: agent.verifyAudit().ok,
    alerts: alerts().map((a) => a.code),
  }));

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
        .map((i) => summaryInvoice(i, s)),
    };
  });

  app.get('/api/invoices/:id', async (req, reply) => {
    const s = store.read();
    const inv = s.invoices[(req.params as { id: string }).id];
    if (!inv) return bad(reply, 404, 'NOT_FOUND', 'factura no encontrada');
    const audit = s.audit.filter((e) => e.invoice_id === inv.id);
    return {
      invoice: publicInvoice(inv, s),
      audit,
      history: audit.filter((e) => e.summary_es).map((e) => ({ at: e.at, actor: e.actor, summary_es: e.summary_es, summary_en: e.summary_en })),
    };
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
    return { vendors: s.vendors.map((v) => publicVendor(v, s)), agreements: s.agreements, fx_table: s.fx_table };
  });

  // Authorized vendors: kept by a person with the access code and a name, never by the agent.
  const vendorReply = (r: VendorResult, reply: FastifyReply) => {
    if (!r.ok) return bad(reply, r.status ?? 400, r.code, r.message);
    const s = store.read();
    const v = s.vendors.find((x) => x.id === r.vendor_id)!;
    return { ok: true, vendor: publicVendor(v, s), ...(r.waiting_invoices !== undefined ? { waiting_invoices: r.waiting_invoices } : {}) };
  };
  app.post('/api/vendors', async (req, reply) => {
    const body = parse(NewVendorBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    return vendorReply(await agent.addVendor(body.actor, body.vendor), reply);
  });
  app.patch('/api/vendors/:id', async (req, reply) => {
    const body = parse(VendorPatchBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    const { actor, ...changes } = body;
    return vendorReply(await agent.updateVendor((req.params as { id: string }).id, actor, changes), reply);
  });
  app.post('/api/vendors/:id/confirm-account', async (req, reply) => {
    const body = parse(ConfirmAccountBody, req.body, reply);
    if (!body) return;
    if (!authorized(req, reply)) return;
    return vendorReply(await agent.confirmAccount((req.params as { id: string }).id, body.actor, body.note ?? ''), reply);
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
