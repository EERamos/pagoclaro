// The ten tools of the spec (§2), exactly by name and tier. Inputs are closed schemas (unknown
// fields rejected); errors come back as observations, never thrown. The toolbox records every
// requested call in order — that log is the trajectory the eval runner checks.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { evaluate, type ApprovalInput } from '../domain/rules';
import { daysBetween, daysFromTo, maskAccount, newId, normAccount, normInvoiceNumber, normTaxId, periodOf, round2 } from '../domain/normalize';
import type { Agreement, Evaluation, Facts, PaymentInstruction, Rail, ReadResult, RuleCode, Vendor } from '../domain/types';
import type { InvoiceDocument } from '../extract/document';
import type { Extractor } from '../extract/extractor';
import { appendAudit, currentRules, type InvoiceRecord, type State, type Store } from '../store/store';

export const TOOL_TIERS = {
  read_invoice_primary: 'safe',
  read_invoice_check: 'safe',
  find_vendor: 'safe',
  find_agreement: 'safe',
  query_ledger: 'safe',
  convert_currency: 'safe',
  evaluate_rules: 'safe',
  record_payment: 'reversible',
  record_hold: 'reversible',
  escalate_to_human: 'reversible',
} as const;

export type ToolName = keyof typeof TOOL_TIERS;

const InvoiceId = z.string().regex(/^inv_[0-9A-Z]{26}$/);
const Iso4217 = z.string().regex(/^[A-Z]{3}$/);
const ReasonList = z.array(z.string().min(1).max(40)).min(1).max(12);

const ReadInput = z.object({ invoice_id: InvoiceId, document_kind: z.enum(['pdf', 'image', 'email', 'chat']), document_sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict();

const FactsSchema = z
  .object({
    reading: z
      .object({
        issuer_tax_id: z.string(),
        invoice_number: z.string(),
        issue_date: z.string(),
        currency: z.enum(['USD', 'MXN', 'COP', 'BRL', 'EUR', 'AMBIGUOUS', 'OTHER']),
        total: z.number(),
        lines_total: z.number().nullable(),
        payment_account: z.string().nullable(),
        has_suspicious_text: z.boolean(),
      })
      .strict(),
    vendor: z.any().nullable(),
    account_matches: z.boolean().nullable(),
    agreement: z.any().nullable(),
    ledger: z.any().nullable(),
    fx: z.object({ amount_usd: z.number(), rate: z.number(), rate_date: z.string(), source: z.string() }).strict().nullable(),
    today: z.string(),
    provenance: z.record(z.string(), z.object({ tag: z.enum(['source', 'calculated', 'user-decided', 'assumption']), cite: z.string() }).strict()),
  })
  .strict();

export const INPUT_SCHEMAS = {
  read_invoice_primary: ReadInput,
  read_invoice_check: ReadInput,
  find_vendor: z.object({ tax_id: z.string().min(1).max(32), payment_account: z.string().min(1).max(64).optional() }).strict(),
  find_agreement: z.object({ vendor_id: z.string().regex(/^ven_[A-Za-z0-9_]{1,32}$/), currency: Iso4217 }).strict(),
  query_ledger: z
    .object({ vendor_id: z.string().min(1), invoice_number: z.string().min(1).max(64), currency: Iso4217, total: z.number().positive(), issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .strict(),
  convert_currency: z.object({ amount: z.number().positive(), currency: Iso4217 }).strict(),
  evaluate_rules: z
    .object({ invoice_id: InvoiceId, facts: FactsSchema, approval: z.object({ approver: z.string().min(1), at: z.string() }).strict().optional() })
    .strict(),
  record_payment: z.object({ invoice_id: InvoiceId, evaluation_id: z.string().regex(/^evl_[0-9A-Z]{26}$/) }).strict(),
  record_hold: z.object({ invoice_id: InvoiceId, reasons: ReasonList }).strict(),
  escalate_to_human: z.object({ invoice_id: InvoiceId, reasons: ReasonList }).strict(),
} satisfies Record<ToolName, z.ZodType>;

export interface ToolCall {
  name: ToolName;
  args: Record<string, unknown>;
  at: string;
  /** False when the call was refused before its body ran (invalid input). */
  executed: boolean;
  result: unknown;
}

/** Injected by the eval runner only (harness_condition); production passes none. */
export interface ToolOverrides {
  alwaysErrors?: { tool: ToolName; error: string };
  returns?: Partial<Record<ToolName, unknown>>;
}

export interface ToolContext {
  /** The invoice this run is about; never part of a tool's schema. */
  currentInvoiceId: string | null;
  /** Readers' documents, by hash, for this process. */
  documents: Map<string, InvoiceDocument>;
}

export interface ToolboxDeps {
  store: Store;
  primary: Extractor;
  check: Extractor;
  now: () => Date;
  overrides?: ToolOverrides;
}

const RAIL_BY_CURRENCY: Record<string, Rail> = { MXN: 'SPEI', BRL: 'PIX', COP: 'BRE_B', USD: 'ACH' };

export class Toolbox {
  readonly calls: ToolCall[] = [];
  readonly ctx: ToolContext = { currentInvoiceId: null, documents: new Map() };

  constructor(private readonly deps: ToolboxDeps) {}

  async call(name: ToolName, args: Record<string, unknown>): Promise<any> {
    const at = this.deps.now().toISOString();
    const entry: ToolCall = { name, args: structuredClone(args), at, executed: false, result: null };
    this.calls.push(entry);
    const parsed = INPUT_SCHEMAS[name].safeParse(args);
    if (!parsed.success) {
      entry.result = { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
      return entry.result;
    }
    entry.executed = true;
    const o = this.deps.overrides;
    if (o?.alwaysErrors?.tool === name) {
      entry.result = { ok: false, error: o.alwaysErrors.error, message: 'falla inyectada por el arnés de evaluación' };
      return entry.result;
    }
    if (o?.returns && name in o.returns) {
      entry.result = structuredClone(o.returns[name]);
      return entry.result;
    }
    try {
      entry.result = await this.run(name, parsed.data as any);
    } catch (e) {
      entry.result = { ok: false, error: name.startsWith('read_') ? 'PROVIDER_ERROR' : 'STORE_ERROR', message: e instanceof Error ? e.message : 'error' };
    }
    return entry.result;
  }

  private async run(name: ToolName, a: any): Promise<unknown> {
    switch (name) {
      case 'read_invoice_primary':
      case 'read_invoice_check': {
        const doc = this.ctx.documents.get(a.document_sha256);
        if (!doc) return { ok: false, error: 'UNREADABLE', message: 'documento no disponible' } satisfies ReadResult;
        return (name === 'read_invoice_primary' ? this.deps.primary : this.deps.check).read(doc);
      }
      case 'find_vendor':
        return this.findVendor(a.tax_id, a.payment_account);
      case 'find_agreement':
        return this.findAgreement(a.vendor_id, a.currency);
      case 'query_ledger':
        return this.queryLedger(a);
      case 'convert_currency':
        return this.convert(a.amount, a.currency);
      case 'evaluate_rules':
        return this.evaluateRules(a.invoice_id, a.facts as Facts, a.approval ?? null);
      case 'record_payment':
        return this.recordPayment(a.invoice_id, a.evaluation_id);
      case 'record_hold':
        return this.recordHold(a.invoice_id, a.reasons as RuleCode[]);
      case 'escalate_to_human':
        return this.escalate(a.invoice_id, a.reasons as RuleCode[]);
    }
  }

  private findVendor(taxId: string, account?: string) {
    const s = this.deps.store.read();
    const v = s.vendors.find((x) => normTaxId(x.tax_id) === normTaxId(taxId)) ?? null;
    if (!v) return { ok: true, match: 'NONE', vendor: null, account_matches: null };
    const account_matches = account === undefined ? false : normAccount(account) === normAccount(v.account);
    return { ok: true, match: 'TAX_ID', vendor: v, account_matches };
  }

  private findAgreement(vendorId: string, currency: string) {
    const s = this.deps.store.read();
    const open = s.agreements.filter((x) => x.vendor_id === vendorId && x.currency === currency && x.status === 'open');
    const a = open.find((x) => x.kind === 'CONTRACT') ?? open[0] ?? null;
    return { ok: true, agreement: a };
  }

  private queryLedger(a: { vendor_id: string; invoice_number: string; currency: string; total: number; issue_date: string }) {
    const s = this.deps.store.read();
    const rules = currentRules(s);
    const today = this.deps.now().toISOString();
    const period = periodOf(today);
    const self = this.ctx.currentInvoiceId;
    type Row = { invoice_id: string; invoice_number: string; vendor_id: string; total: number; currency: string; amount_usd: number; issue_date: string; decided_at: string; status: string };
    const rows: Row[] = [
      ...Object.values(s.invoices)
        .filter((i) => i.id !== self && (i.status === 'PAID' || i.status === 'PENDING') && i.vendor_id)
        .map((i) => ({
          invoice_id: i.id,
          invoice_number: i.invoice_number ?? '',
          vendor_id: i.vendor_id!,
          total: i.total ?? 0,
          currency: i.currency ?? '',
          amount_usd: i.amount_usd ?? 0,
          issue_date: i.issue_date ?? '',
          decided_at: i.decided_at ?? i.received_at,
          status: i.status,
        })),
      ...s.external_ledger.map((e, k) => ({ invoice_id: `hist_${k + 1}`, ...e })),
    ];
    const mine = rows.filter((r) => r.vendor_id === a.vendor_id);
    const exact = mine.find((r) => normInvoiceNumber(r.invoice_number) === normInvoiceNumber(a.invoice_number)) ?? null;
    const w = rules.possible_duplicate_window_days;
    const possible = mine
      .filter((r) => normInvoiceNumber(r.invoice_number) !== normInvoiceNumber(a.invoice_number))
      .filter((r) => r.currency === a.currency && Math.round(r.total * 100) === Math.round(a.total * 100))
      .filter((r) => Math.min(daysBetween(r.issue_date, a.issue_date), daysBetween(r.decided_at.slice(0, 10), a.issue_date)) <= w)
      .map((r) => ({ invoice_id: r.invoice_id, invoice_number: r.invoice_number, issue_date: r.issue_date }));
    const splitDays = rules.split_window_days;
    const paidInWindow = mine
      .filter((r) => r.status === 'PAID')
      .filter((r) => {
        const d = daysFromTo(r.decided_at, today);
        return d >= 0 && d <= splitDays;
      })
      .reduce((sum, r) => sum + r.amount_usd, 0);
    const committed =
      (s.budget_baselines[period] ?? 0) +
      rows.filter((r) => r.status === 'PAID' && periodOf(r.decided_at) === period).reduce((sum, r) => sum + r.amount_usd, 0);
    return {
      ok: true,
      exact_duplicate: exact ? { invoice_id: exact.invoice_id, invoice_number: exact.invoice_number, status: exact.status } : null,
      possible_duplicates: possible,
      vendor_paid_usd_in_split_window: round2(paidInWindow),
      period,
      period_committed_usd: round2(committed),
    };
  }

  private convert(amount: number, currency: string) {
    const s = this.deps.store.read();
    const rate = s.fx_table.rates[currency];
    if (rate === undefined) return { ok: false, error: 'NO_FX_RATE', message: `no hay tasa para ${currency} en la tabla` };
    return { ok: true, amount_usd: round2(amount * rate), rate, rate_date: s.fx_table.date, source: s.fx_table.source };
  }

  private evaluateRules(invoiceId: string, facts: Facts, approval: ApprovalInput | null) {
    const at = this.deps.now().toISOString();
    return this.deps.store.tx((d) => {
      if (!d.invoices[invoiceId]) return { ok: false, error: 'INVALID_FACTS', message: 'factura desconocida' };
      const rules = currentRules(d);
      const res = evaluate(facts, rules, approval);
      const ev: Evaluation = {
        id: newId('evl', this.deps.now().getTime()),
        invoice_id: invoiceId,
        outcome: res.outcome,
        rules: res.rules,
        policy_version: rules.version,
        at,
        approval: approval ? { approver: approval.approver, at: approval.at } : null,
      };
      d.evaluations[ev.id] = ev;
      d.invoices[invoiceId].evaluation_id = ev.id;
      d.invoices[invoiceId].facts = facts;
      return { ok: true, evaluation_id: ev.id, outcome: ev.outcome, rules: ev.rules, policy_version: ev.policy_version };
    });
  }

  private decisionData(d: State, inv: InvoiceRecord, ev: Evaluation | null) {
    const read = (r: ReadResult | null) => (r && r.ok ? { model: r.model, input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens } : null);
    return {
      invoice_number: inv.invoice_number,
      issuer: inv.issuer_name,
      total: inv.total,
      currency: inv.currency,
      amount_usd: inv.amount_usd,
      readers: { primary: read(inv.readings.primary), check: read(inv.readings.check) },
      fx: inv.facts?.fx ?? null,
      evaluation: ev ? { id: ev.id, outcome: ev.outcome, policy_version: ev.policy_version, rules: ev.rules, approval: ev.approval } : null,
      policy_version: ev?.policy_version ?? currentRules(d).version,
    };
  }

  private recordPayment(invoiceId: string, evaluationId: string) {
    const now = this.deps.now().toISOString();
    return this.deps.store.tx((d) => {
      const inv = d.invoices[invoiceId];
      const ev = d.evaluations[evaluationId];
      if (!inv || !ev || ev.invoice_id !== invoiceId) return { ok: false, error: 'NOT_PAY', message: 'la evaluación no es de esta factura' };
      if (ev.outcome !== 'PAY') return { ok: false, error: 'NOT_PAY', message: 'la evaluación no dio PAY' };
      if (inv.evaluation_id !== evaluationId) return { ok: false, error: 'NOT_PAY', message: 'hay una evaluación más reciente' };
      if (inv.payment_id || inv.status === 'PAID') return { ok: false, error: 'ALREADY_DECIDED', message: 'la factura ya tiene instrucción de pago' };
      if (inv.status !== 'PROCESSING' && inv.status !== 'PENDING') return { ok: false, error: 'ALREADY_DECIDED', message: `la factura ya está ${inv.status}` };
      const facts = inv.facts;
      if (!facts || !facts.fx) return { ok: false, error: 'NOT_PAY', message: 'faltan hechos de la evaluación' };
      const vendor = facts.vendor as Vendor | null;
      const currency = facts.reading.currency;
      const rail: Rail = vendor?.rail ?? RAIL_BY_CURRENCY[currency] ?? 'ACH';
      const account = vendor?.account ?? facts.reading.payment_account ?? '';
      const key = createHash('sha256').update(`${inv.vendor_id ?? normTaxId(facts.reading.issuer_tax_id)}|${normInvoiceNumber(facts.reading.invoice_number)}|${inv.document.sha256}`).digest('hex');
      if (Object.values(d.payments).some((p) => p.idempotency_key === key && !p.voided_at)) {
        return { ok: false, error: 'ALREADY_DECIDED', message: 'instrucción de pago ya emitida (misma llave de idempotencia)' };
      }
      const pay: PaymentInstruction = {
        id: newId('pay', this.deps.now().getTime()),
        invoice_id: invoiceId,
        evaluation_id: evaluationId,
        rail,
        amount: facts.reading.total,
        currency,
        amount_usd: facts.fx.amount_usd,
        fx: { rate: facts.fx.rate, date: facts.fx.rate_date, source: facts.fx.source },
        beneficiary: vendor?.name ?? inv.issuer_name ?? '',
        account,
        account_masked: maskAccount(account),
        simulated: true,
        idempotency_key: key,
        created_at: now,
        voided_at: null,
        voided_by: null,
      };
      d.payments[pay.id] = pay;
      // A purchase order's balance goes down by what is paid.
      const agr = facts.agreement as Agreement | null;
      if (agr && agr.kind === 'PURCHASE_ORDER' && agr.remaining !== null) {
        const live = d.agreements.find((x) => x.id === agr.id);
        if (live && live.remaining !== null) live.remaining = round2(live.remaining - pay.amount);
      }
      const wasPending = inv.status === 'PENDING';
      inv.status = 'PAID';
      inv.payment_id = pay.id;
      inv.decided_at = now;
      inv.reasons = [];
      if (wasPending && inv.pending_id && d.pending[inv.pending_id]) {
        const p = d.pending[inv.pending_id];
        p.resolved_at = now;
        p.resolved_by = ev.approval?.approver ?? null;
        p.resolution = 'APPROVED_PAID';
      }
      const entry = appendAudit(d, {
        at: now,
        invoice_id: invoiceId,
        type: 'decision.pay',
        actor: ev.approval ? ev.approval.approver : 'pagoclaro',
        data: {
          ...this.decisionData(d, inv, ev),
          payment: { id: pay.id, rail, amount: pay.amount, currency, amount_usd: pay.amount_usd, account_masked: pay.account_masked, simulated: true, idempotency_key: key },
        },
      });
      return {
        ok: true,
        payment_instruction: { id: pay.id, rail, amount: pay.amount, currency, amount_usd: pay.amount_usd, beneficiary: pay.beneficiary, account_masked: pay.account_masked, simulated: true, idempotency_key: key },
        audit_seq: entry.seq,
      };
    });
  }

  private recordHold(invoiceId: string, reasons: RuleCode[]) {
    const now = this.deps.now().toISOString();
    return this.deps.store.tx((d) => {
      const inv = d.invoices[invoiceId];
      if (!inv) return { ok: false, error: 'STORE_ERROR', message: 'factura desconocida' };
      if (inv.status === 'PAID' || inv.status === 'HELD' || inv.status === 'REJECTED' || inv.status === 'EXPIRED') {
        return { ok: false, error: 'ALREADY_DECIDED', message: `la factura ya está ${inv.status}` };
      }
      const expired = reasons.includes('EXPIRED');
      const ev = inv.evaluation_id ? d.evaluations[inv.evaluation_id] : null;
      inv.status = expired ? 'EXPIRED' : 'HELD';
      inv.reasons = reasons;
      inv.decided_at = now;
      if (inv.pending_id && d.pending[inv.pending_id] && !d.pending[inv.pending_id].resolved_at) {
        const p = d.pending[inv.pending_id];
        p.resolved_at = now;
        p.resolution = expired ? 'EXPIRED' : 'APPROVED_HELD';
        p.resolved_by = expired ? 'pagoclaro' : (ev?.approval?.approver ?? null);
      }
      const entry = appendAudit(d, { at: now, invoice_id: invoiceId, type: expired ? 'decision.expired' : 'decision.hold', actor: ev?.approval?.approver ?? 'pagoclaro', data: { ...this.decisionData(d, inv, ev), reasons } });
      return { ok: true, audit_seq: entry.seq };
    });
  }

  private escalate(invoiceId: string, reasons: RuleCode[]) {
    const now = this.deps.now();
    return this.deps.store.tx((d) => {
      const inv = d.invoices[invoiceId];
      if (!inv) return { ok: false, error: 'STORE_ERROR', message: 'factura desconocida' };
      if (inv.status !== 'PROCESSING') return { ok: false, error: 'ALREADY_DECIDED', message: `la factura ya está ${inv.status}` };
      const hours = currentRules(d).pending_timeout_hours;
      const expires = new Date(now.getTime() + hours * 3_600_000).toISOString();
      const pending = { id: newId('pnd', now.getTime()), invoice_id: invoiceId, reasons, created_at: now.toISOString(), expires_at: expires, resolved_at: null, resolved_by: null, resolution: null, note: null };
      d.pending[pending.id] = pending;
      inv.status = 'PENDING';
      inv.reasons = reasons;
      inv.pending_id = pending.id;
      const ev = inv.evaluation_id ? d.evaluations[inv.evaluation_id] : null;
      const entry = appendAudit(d, { at: now.toISOString(), invoice_id: invoiceId, type: 'decision.escalate', actor: 'pagoclaro', data: { ...this.decisionData(d, inv, ev), reasons, pending_id: pending.id, expires_at: expires } });
      return { ok: true, pending_id: pending.id, expires_at: expires, audit_seq: entry.seq };
    });
  }
}
