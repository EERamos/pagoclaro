// PagoClaro's fixed flow per invoice (design §3: no model loop). The model only reads; the code
// calls the tools in a fixed order and the deterministic engine decides.
import { verifyChain, type VerifyResult } from '../domain/audit';
import { compareReadings, linesTotal, suspiciousUnion } from '../domain/reconcile';
import { APPROVABLE } from '../domain/rules';
import { maskAccount, newId, normAccount, normTaxId } from '../domain/normalize';
import type { Facts, InvoiceReading, Rail, ReadResult, RuleCode, Vendor } from '../domain/types';
import { detectDocument, type InvoiceDocument } from '../extract/document';
import { appendAudit, type InvoiceRecord, type State, type Store } from '../store/store';
import type { Telemetry } from '../telemetry';
import { Toolbox } from './tools';

export interface UploadResult {
  invoice_id: string;
  status: InvoiceRecord['status'];
  reasons: RuleCode[];
  duplicate_of_file?: boolean;
  payment_id: string | null;
}

export type ActionResult =
  | { ok: true; invoice_id: string; status: InvoiceRecord['status']; reasons: RuleCode[]; payment_id: string | null }
  | { ok: false; code: string; message: string; status?: number };

export interface NewVendor {
  name: string;
  tax_id: string;
  country: string;
  currency: string;
  rail: Rail;
  account: string;
}

export type VendorResult = { ok: true; vendor_id: string; waiting_invoices?: number } | { ok: false; code: string; message: string; status?: number };

/**
 * Pending invoices of a vendor that escalated because their account was waiting for confirmation
 * and that name one of these accounts. They keep waiting for a person after the account is confirmed.
 */
export function waitingFor(s: State, vendorId: string, ...accounts: (string | null | undefined)[]): number {
  const wanted = accounts.filter((a): a is string => !!a).map(normAccount);
  if (wanted.length === 0) return 0;
  return Object.values(s.invoices).filter((i) => {
    if (i.status !== 'PENDING' || i.vendor_id !== vendorId || !i.reasons.includes('ACCOUNT_PENDING')) return false;
    const read = i.facts?.reading.payment_account;
    return !!read && wanted.includes(normAccount(read));
  }).length;
}

const ISO = new Set(['USD', 'MXN', 'COP', 'BRL', 'EUR']);

export class PagoClaro {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    readonly store: Store,
    readonly tools: Toolbox,
    private readonly now: () => Date,
    private readonly telemetry: Telemetry,
  ) {}

  /** One operation at a time: decisions read the ledger the previous one wrote. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  upload(filename: string, bytes: Buffer, actor: string): Promise<UploadResult> {
    return this.serial(() => this.doUpload(filename, bytes, actor));
  }

  private async doUpload(filename: string, bytes: Buffer, actor: string): Promise<UploadResult> {
    const started = Date.now();
    const det = detectDocument(filename, bytes);
    const sha = det.ok ? det.doc.sha256 : det.sha256;

    // The same file twice returns the earlier decision (spec BHV-031), unless it ended in error.
    const prior = Object.values(this.store.read().invoices).find((i) => i.document.sha256 === sha && i.status !== 'ERROR');
    if (prior) return { invoice_id: prior.id, status: prior.status, reasons: prior.reasons, duplicate_of_file: true, payment_id: prior.payment_id };

    const id = newId('inv', this.now().getTime());
    const kind = det.ok ? det.doc.kind : det.kind;
    const mediaType = det.ok ? det.doc.mediaType : det.mediaType;
    this.store.tx((d) => {
      d.invoices[id] = {
        id,
        document: { sha256: sha, kind, filename, media_type: mediaType, size: bytes.length },
        uploaded_by: actor,
        received_at: this.now().toISOString(),
        readings: { primary: null, check: null, primary_attempts: 0, check_attempts: 0 },
        reading_used: null,
        facts: null,
        vendor_id: null,
        issuer_name: null,
        invoice_number: null,
        issue_date: null,
        total: null,
        currency: null,
        amount_usd: null,
        evaluation_id: null,
        status: 'PROCESSING',
        reasons: [],
        decided_at: null,
        payment_id: null,
        pending_id: null,
      };
      appendAudit(d, { at: this.now().toISOString(), invoice_id: id, type: 'invoice.received', actor, data: { filename, kind, size: bytes.length, sha256: sha } });
    });
    this.tools.ctx.currentInvoiceId = id;
    try {
      let result: UploadResult;
      try {
        result = await this.decide(id, det.ok ? det.doc : null, det.ok ? null : det.why);
      } catch (e) {
        // Anything unexpected ends with no decision, never with a half-written one.
        result = this.markError(id, 'UNEXPECTED', e instanceof Error ? e.message : String(e));
      }
      this.emit(id, 'upload', started);
      return result;
    } finally {
      this.tools.ctx.currentInvoiceId = null;
    }
  }

  private async decide(id: string, doc: InvoiceDocument | null, unreadableWhy: string | null): Promise<UploadResult> {
    if (!doc) return this.escalateOrError(id, ['UNREADABLE'], { why: unreadableWhy ?? 'documento no válido' });
    this.tools.ctx.documents.set(doc.sha256, doc);
    const args = { invoice_id: id, document_kind: doc.kind, document_sha256: doc.sha256 };

    // Independent readings, at most one retry each on a transient failure.
    const readTwice = async (tool: 'read_invoice_primary' | 'read_invoice_check' | 'read_invoice_tiebreak') => {
      let res = (await this.tools.call(tool, args)) as ReadResult;
      let attempts = 1;
      if (!res.ok && (res.error === 'PROVIDER_ERROR' || res.error === 'TIMEOUT')) {
        res = (await this.tools.call(tool, args)) as ReadResult;
        attempts = 2;
      }
      return { res, attempts };
    };
    const [p, c] = [await readTwice('read_invoice_primary'), await readTwice('read_invoice_check')];
    this.store.tx((d) => {
      const inv = d.invoices[id];
      inv.readings = { primary: p.res, check: c.res, primary_attempts: p.attempts, check_attempts: c.attempts, tiebreak: null, tiebreak_attempts: 0, tiebreak_role: null };
      if (p.res.ok) {
        inv.issuer_name = p.res.reading.issuer_name;
        inv.invoice_number = p.res.reading.invoice_number;
        inv.issue_date = p.res.reading.issue_date;
        inv.total = p.res.reading.total;
        inv.currency = p.res.reading.currency;
      }
    });

    // The main reading is never replaced (spec §7 Assumption): without it a person decides.
    if (!p.res.ok) {
      if (p.res.error === 'UNREADABLE') return this.escalateOrError(id, ['UNREADABLE'], { why: p.res.message });
      return this.escalateOrError(id, ['READER_FAILED'], { reader: 'principal', error: p.res.error });
    }
    const primary = p.res.reading;
    const tiebreak = async (role: 'tiebreak' | 'second_reader') => {
      const t = await readTwice('read_invoice_tiebreak');
      this.store.tx((d) => {
        const r = d.invoices[id].readings;
        r.tiebreak = t.res;
        r.tiebreak_attempts = t.attempts;
        r.tiebreak_role = role;
      });
      return t.res;
    };
    const disagree = (fields: string[], readings: InvoiceReading[], tb: 'failed' | 'disagrees') => {
      // An order copied by any reader escalates on its own, even when the readings disagree
      // (spec BHV-010, BHV-044): SUSPICIOUS_TEXT is never approvable, READINGS_DISAGREE is.
      const suspicious = readings.some((r) => (r.suspicious_text ?? []).some((x) => x.trim()));
      const reasons: RuleCode[] = suspicious ? ['READINGS_DISAGREE', 'SUSPICIOUS_TEXT'] : ['READINGS_DISAGREE'];
      return this.escalateOrError(id, reasons, { fields: fields.join(', '), tiebreak: tb }, 'primary');
    };

    // The check reader failed on its retry too: the tie-break reader stands in as the second
    // reader and is compared with the main one on all five fields (BHV-004, BHV-045).
    if (!c.res.ok) {
      const t = await tiebreak('second_reader');
      if (!t.ok) return this.escalateOrError(id, ['READER_FAILED'], { reader: 'verificación y desempate', error: t.error });
      const diff = compareReadings(primary, t.reading);
      if (diff.length > 0) return disagree(diff, [primary, t.reading], 'disagrees');
      this.store.tx((d) => {
        d.invoices[id].reading_used = 'primary';
      });
      return this.evaluateAndRecord(id, primary, suspiciousUnion(primary, t.reading).length > 0, null);
    }
    const check = c.res.reading;

    // The check reading disagrees: the tie-break reading settles only the fields in dispute, and
    // the main reading goes on only when it confirms all of them (BHV-041 to BHV-043).
    const diff = compareReadings(primary, check);
    if (diff.length > 0) {
      const t = await tiebreak('tiebreak');
      if (!t.ok) return disagree(diff, [primary, check], 'failed');
      const still = compareReadings(primary, t.reading).filter((f) => diff.includes(f));
      if (still.length > 0) return disagree(diff, [primary, check, t.reading], 'disagrees');
      this.store.tx((d) => {
        d.invoices[id].reading_used = 'primary';
      });
      const suspicious = [primary, check, t.reading].some((r) => (r.suspicious_text ?? []).some((x) => x.trim()));
      return this.evaluateAndRecord(id, primary, suspicious, null);
    }
    this.store.tx((d) => {
      d.invoices[id].reading_used = 'primary';
    });
    return this.evaluateAndRecord(id, primary, suspiciousUnion(primary, check).length > 0, null);
  }

  /** Builds the facts from a reading, evaluates, and records the outcome. */
  private async evaluateAndRecord(id: string, reading: InvoiceReading, suspicious: boolean, approval: { approver: string; at: string } | null): Promise<UploadResult> {
    const vend = (await this.tools.call('find_vendor', {
      tax_id: reading.issuer_tax_id || '?',
      ...(reading.payment_account ? { payment_account: reading.payment_account } : {}),
    })) as { ok: boolean; vendor: Facts['vendor']; account_matches: boolean | null; pending_account_matches: boolean | null };
    const vendor = vend.ok ? vend.vendor : null;
    const iso = ISO.has(reading.currency) ? reading.currency : null;

    let agreement: Facts['agreement'] = null;
    let ledger: Facts['ledger'] = null;
    if (vendor && iso) {
      const ag = (await this.tools.call('find_agreement', { vendor_id: vendor.id, currency: iso })) as { ok: boolean; agreement: Facts['agreement'] };
      agreement = ag.ok ? ag.agreement : null;
    }
    if (vendor && iso && reading.total > 0 && /^\d{4}-\d{2}-\d{2}$/.test(reading.issue_date)) {
      const lg = (await this.tools.call('query_ledger', {
        vendor_id: vendor.id,
        invoice_number: reading.invoice_number || '?',
        currency: iso,
        total: reading.total,
        issue_date: reading.issue_date,
      })) as any;
      ledger = lg.ok
        ? {
            exact_duplicate: lg.exact_duplicate,
            possible_duplicates: lg.possible_duplicates,
            vendor_paid_usd_in_split_window: lg.vendor_paid_usd_in_split_window,
            vendor_paid_usd_in_period: lg.vendor_paid_usd_in_period,
            period: lg.period,
            period_committed_usd: lg.period_committed_usd,
          }
        : null;
    }
    let fx: Facts['fx'] = null;
    if (iso && reading.total > 0) {
      const cv = (await this.tools.call('convert_currency', { amount: reading.total, currency: iso })) as any;
      fx = cv.ok ? { amount_usd: cv.amount_usd, rate: cv.rate, rate_date: cv.rate_date, source: cv.source } : null;
    }
    const st = this.store.read();
    const inv = st.invoices[id];
    const used = inv.reading_used ?? 'primary';
    const ROLE = { primary: 'principal', check: 'de verificación', tiebreak: 'de desempate' } as const;
    const usedRes = inv.readings[used] ?? null;
    const others = (['primary', 'check', 'tiebreak'] as const).filter((k) => k !== used).map((k) => inv.readings[k] ?? null).filter((r): r is Extract<ReadResult, { ok: true }> => !!r && r.ok);
    const modelOf = (r: ReadResult | null) => (r && r.ok ? r.model : 'sin lectura');
    const readCite = `${inv.document.filename} (sha256 ${inv.document.sha256.slice(0, 12)}) · lector ${ROLE[used]} ${modelOf(usedRes)}, cruzado con ${others.map((r) => r.model).join(' y ') || 'ninguna otra lectura'}`;
    const provenance: Facts['provenance'] = {};
    for (const f of ['issuer_tax_id', 'invoice_number', 'issue_date', 'currency', 'total', 'payment_account', 'lines']) {
      provenance[`reading.${f}`] = { tag: 'source', cite: readCite };
    }
    if (approval && used !== 'primary') provenance['reading.choice'] = { tag: 'user-decided', cite: `${approval.approver} eligió la lectura ${ROLE[used]}` };
    if (vendor) provenance.vendor = { tag: 'source', cite: `catálogo de proveedores, ${vendor.id}` };
    if (agreement) provenance.agreement = { tag: 'source', cite: `acuerdo ${agreement.id}` };
    if (ledger) provenance.ledger = { tag: 'calculated', cite: `libro de pagos al ${this.now().toISOString().slice(0, 10)}, periodo ${ledger.period}` };
    if (fx) {
      provenance['fx.rate'] = { tag: 'source', cite: `tabla de tipos de cambio del ${fx.rate_date} (${fx.source})` };
      provenance['fx.amount_usd'] = { tag: 'calculated', cite: `${reading.total} ${iso} × ${fx.rate}` };
    }
    provenance.rules = { tag: 'user-decided', cite: `reglas v${st.rules_versions.at(-1)?.rules.version} aprobadas por ${st.rules_versions.at(-1)?.approved_by}` };
    if (approval) provenance.approval = { tag: 'user-decided', cite: `aprobación de ${approval.approver} el ${approval.at}` };
    if (reading.currency === 'AMBIGUOUS') provenance['reading.currency'] = { tag: 'assumption', cite: 'la factura no dice su moneda; no se infiere' };

    const facts: Facts = {
      provenance,
      reading: {
        issuer_tax_id: reading.issuer_tax_id,
        invoice_number: reading.invoice_number,
        issue_date: reading.issue_date,
        currency: reading.currency,
        total: reading.total,
        lines_total: linesTotal(reading),
        payment_account: reading.payment_account,
        has_suspicious_text: suspicious,
      },
      vendor,
      account_matches: vendor ? vend.account_matches : null,
      pending_account_matches: vendor ? (vend.pending_account_matches ?? null) : null,
      agreement,
      ledger,
      fx,
      today: this.now().toISOString(),
    };
    this.store.tx((d) => {
      const inv = d.invoices[id];
      inv.vendor_id = vendor?.id ?? null;
      inv.amount_usd = fx?.amount_usd ?? null;
    });
    const ev = (await this.tools.call('evaluate_rules', { invoice_id: id, facts, ...(approval ? { approval } : {}) })) as any;
    if (!ev.ok) return this.escalateOrError(id, ['READER_FAILED'], { reader: 'motor', error: ev.error });
    const fails: RuleCode[] = ev.rules.filter((r: any) => r.result === 'FAIL').map((r: any) => r.rule);
    if (ev.outcome === 'PAY') {
      const pay = (await this.tools.call('record_payment', { invoice_id: id, evaluation_id: ev.evaluation_id })) as any;
      if (!pay.ok) return this.markError(id, pay.error, pay.message);
      return this.result(id);
    }
    if (ev.outcome === 'HOLD') {
      const holdReasons = ev.rules.filter((r: any) => r.result === 'FAIL' && r.outcome_if_fail === 'HOLD').map((r: any) => r.rule);
      const h = (await this.tools.call('record_hold', { invoice_id: id, reasons: holdReasons.length ? holdReasons : fails })) as any;
      if (!h.ok) return this.markError(id, h.error, h.message);
      return this.result(id);
    }
    const e = (await this.tools.call('escalate_to_human', { invoice_id: id, reasons: fails })) as any;
    if (!e.ok) return this.markError(id, e.error, e.message);
    return this.result(id);
  }

  private async escalateOrError(id: string, reasons: RuleCode[], why: Record<string, string>, suggested?: 'primary'): Promise<UploadResult> {
    this.store.tx((d) => {
      appendAudit(d, { at: this.now().toISOString(), invoice_id: id, type: 'invoice.unconfirmed', actor: 'pagoclaro', data: { reasons, ...why } });
    });
    const e = (await this.tools.call('escalate_to_human', { invoice_id: id, reasons, ...(suggested ? { suggested_reading: suggested } : {}) })) as any;
    if (!e.ok) return this.markError(id, e.error, e.message);
    return this.result(id);
  }

  /** The invoice ends with no final decision and can be processed again (spec BHV-030). */
  private markError(id: string, code: string, message: string): UploadResult {
    try {
      this.store.tx((d) => {
        const inv = d.invoices[id];
        if (inv.status === 'PROCESSING') inv.status = 'ERROR';
        appendAudit(d, { at: this.now().toISOString(), invoice_id: id, type: 'invoice.error', actor: 'pagoclaro', data: { code, message } });
      });
    } catch {
      // Storage is down: nothing was written, which is the safe state.
    }
    return this.result(id);
  }

  private result(id: string): UploadResult {
    const inv = this.store.read().invoices[id];
    return { invoice_id: id, status: inv.status, reasons: inv.reasons, payment_id: inv.payment_id };
  }

  // ---------------- human actions ----------------

  approve(invoiceId: string, approver: string, note: string | null, confirmReading?: 'primary' | 'check' | 'tiebreak'): Promise<ActionResult> {
    return this.serial(async () => {
      const started = Date.now();
      const s = this.store.read();
      const inv = s.invoices[invoiceId];
      if (!inv) return { ok: false, code: 'NOT_FOUND', message: 'factura no encontrada', status: 404 };
      if (inv.status !== 'PENDING' || !inv.pending_id) return { ok: false, code: 'NOT_PENDING', message: `la factura está ${inv.status}`, status: 409 };
      const pending = s.pending[inv.pending_id];
      if (approver.trim().toLowerCase() === inv.uploaded_by.trim().toLowerCase()) {
        this.store.tx((d) => {
          appendAudit(d, { at: this.now().toISOString(), invoice_id: invoiceId, type: 'approval.refused', actor: approver, data: { code: 'SELF_APPROVAL', note } });
        });
        return { ok: false, code: 'SELF_APPROVAL', message: 'nadie aprueba una factura que él mismo subió', status: 403 };
      }
      this.tools.ctx.currentInvoiceId = invoiceId;
      try {
        // An expired pending item is held, never paid (spec BHV-037).
        if (Date.parse(pending.expires_at) < this.now().getTime()) {
          await this.tools.call('record_hold', { invoice_id: invoiceId, reasons: ['EXPIRED'] });
          this.emit(invoiceId, 'expire', started);
          return this.actionResult(invoiceId);
        }
        const needsChoice = pending.reasons.includes('READINGS_DISAGREE');
        if (needsChoice && !confirmReading) {
          return { ok: false, code: 'CONFIRM_READING', message: 'las lecturas no coinciden: elige cuál vale (primary, check o tiebreak)', status: 400 };
        }
        this.store.tx((d) => {
          const p = d.pending[inv.pending_id!];
          p.note = note;
          appendAudit(d, { at: this.now().toISOString(), invoice_id: invoiceId, type: 'approval.received', actor: approver, data: { note, confirm_reading: confirmReading ?? null, reasons: pending.reasons } });
        });
        const blockedEarly = pending.reasons.filter((r) => !APPROVABLE.has(r) && (r === 'UNREADABLE' || r === 'READER_FAILED'));
        const pick = needsChoice ? confirmReading! : 'primary';
        const rr = inv.readings[pick] ?? null;
        if (blockedEarly.length > 0 || !rr || !rr.ok) {
          await this.tools.call('record_hold', { invoice_id: invoiceId, reasons: ['NOT_APPROVABLE', ...pending.reasons] });
          this.emit(invoiceId, 'approve', started);
          return this.actionResult(invoiceId);
        }
        this.store.tx((d) => {
          d.invoices[invoiceId].reading_used = pick;
        });
        // An order copied by any reader still counts, whichever reading the person picked.
        const all = [inv.readings.primary, inv.readings.check, inv.readings.tiebreak ?? null].filter((r): r is Extract<ReadResult, { ok: true }> => !!r && r.ok);
        const suspicious = all.some((r) => (r.reading.suspicious_text ?? []).some((x) => x.trim()));
        await this.evaluateAndRecord(invoiceId, rr.reading, suspicious, { approver, at: this.now().toISOString() });
        this.emit(invoiceId, 'approve', started);
        return this.actionResult(invoiceId);
      } finally {
        this.tools.ctx.currentInvoiceId = null;
      }
    });
  }

  reject(invoiceId: string, actor: string, reason: string): Promise<ActionResult> {
    return this.serial(async () => {
      const s = this.store.read();
      const inv = s.invoices[invoiceId];
      if (!inv) return { ok: false, code: 'NOT_FOUND', message: 'factura no encontrada', status: 404 };
      if (inv.status !== 'PENDING' || !inv.pending_id) return { ok: false, code: 'NOT_PENDING', message: `la factura está ${inv.status}`, status: 409 };
      const now = this.now().toISOString();
      this.store.tx((d) => {
        const i = d.invoices[invoiceId];
        i.status = 'REJECTED';
        i.decided_at = now;
        const p = d.pending[i.pending_id!];
        p.resolved_at = now;
        p.resolved_by = actor;
        p.resolution = 'REJECTED';
        p.note = reason;
        appendAudit(d, { at: now, invoice_id: invoiceId, type: 'decision.rejected', actor, data: { reason, reasons: i.reasons } });
      });
      return this.actionResult(invoiceId);
    });
  }

  /** A person voids a simulated payment instruction (why record_payment is reversible). */
  voidPayment(paymentId: string, actor: string, reason: string): Promise<ActionResult> {
    return this.serial(async () => {
      const s = this.store.read();
      const pay = s.payments[paymentId];
      if (!pay) return { ok: false, code: 'NOT_FOUND', message: 'instrucción no encontrada', status: 404 };
      if (pay.voided_at) return { ok: false, code: 'ALREADY_VOIDED', message: 'la instrucción ya está anulada', status: 409 };
      const now = this.now().toISOString();
      this.store.tx((d) => {
        const p = d.payments[paymentId];
        p.voided_at = now;
        p.voided_by = actor;
        const inv = d.invoices[p.invoice_id];
        inv.status = 'VOIDED';
        const ev = d.evaluations[p.evaluation_id];
        const agr = (inv.facts?.agreement ?? null) as { id: string; kind: string } | null;
        if (agr && agr.kind === 'PURCHASE_ORDER') {
          const live = d.agreements.find((x) => x.id === agr.id);
          if (live && live.remaining !== null) live.remaining = Math.round((live.remaining + p.amount) * 100) / 100;
        }
        appendAudit(d, { at: now, invoice_id: p.invoice_id, type: 'payment.voided', actor, data: { payment_id: paymentId, reason, evaluation_id: ev?.id ?? null } });
      });
      return this.actionResult(pay.invoice_id);
    });
  }

  // ---------------- authorized vendors (spec v3: a person keeps the list, never the agent) ----------------

  /** Adds an authorized vendor; its account waits for someone else to confirm it (BHV-046, BHV-047). */
  addVendor(actor: string, v: NewVendor): Promise<VendorResult> {
    return this.serial(async () => {
      const now = this.now().toISOString();
      const s = this.store.read();
      if (s.vendors.some((x) => normTaxId(x.tax_id) === normTaxId(v.tax_id))) {
        return { ok: false, code: 'DUPLICATE_TAX_ID', message: `la identificación fiscal ${v.tax_id} ya está en el catálogo`, status: 409 };
      }
      const vendor: Vendor = {
        id: newId('ven', this.now().getTime()),
        name: v.name.trim(),
        tax_id: v.tax_id.trim(),
        country: v.country,
        currency: v.currency,
        rail: v.rail,
        account: null,
        pending_account: { value: v.account.trim(), changed_by: actor, changed_at: now, reason: null },
        account_confirmed_by: null,
        account_confirmed_at: null,
        account_confirmation_note: null,
        added_by: actor,
        added_at: now,
        status: 'active',
      };
      this.store.tx((d) => {
        d.vendors.push(vendor);
        appendAudit(d, { at: now, invoice_id: null, type: 'vendor.added', actor, data: { vendor_id: vendor.id, name: vendor.name, tax_id: vendor.tax_id, currency: vendor.currency, rail: vendor.rail, account_masked: maskAccount(v.account) } });
      });
      return { ok: true, vendor_id: vendor.id };
    });
  }

  /** Deactivates, reactivates or changes the account; a new account waits for confirmation (BHV-048, BHV-049). */
  updateVendor(vendorId: string, actor: string, changes: { status?: 'active' | 'inactive'; account?: string; reason?: string }): Promise<VendorResult> {
    return this.serial(async () => {
      const now = this.now().toISOString();
      const s = this.store.read();
      const v = s.vendors.find((x) => x.id === vendorId);
      if (!v) return { ok: false, code: 'NOT_FOUND', message: 'proveedor no encontrado', status: 404 };
      if (changes.account === undefined && changes.status === undefined) return { ok: false, code: 'NO_CHANGES', message: 'no hay nada que cambiar', status: 400 };
      const reason = changes.reason?.trim() ?? '';
      if (changes.account !== undefined && reason.length < 3) {
        return { ok: false, code: 'REASON_REQUIRED', message: 'un cambio de cuenta necesita un motivo', status: 400 };
      }
      this.store.tx((d) => {
        const live = d.vendors.find((x) => x.id === vendorId)!;
        if (changes.status !== undefined && changes.status !== live.status) {
          live.status = changes.status;
          appendAudit(d, { at: now, invoice_id: null, type: changes.status === 'inactive' ? 'vendor.deactivated' : 'vendor.reactivated', actor, data: { vendor_id: live.id, name: live.name } });
        }
        if (changes.account !== undefined) {
          const from = live.pending_account?.value ?? live.account;
          live.pending_account = { value: changes.account.trim(), changed_by: actor, changed_at: now, reason };
          appendAudit(d, {
            at: now,
            invoice_id: null,
            type: 'vendor.account_changed',
            actor,
            data: { vendor_id: live.id, name: live.name, from_masked: from ? maskAccount(from) : 'sin cuenta', confirmed_masked: live.account ? maskAccount(live.account) : null, to_masked: maskAccount(changes.account), reason },
          });
        }
      });
      return { ok: true, vendor_id: vendorId };
    });
  }

  /**
   * Confirms the account waiting for confirmation: someone other than who changed it, with a note
   * on how it was checked through another channel. Confirming pays nothing (BHV-051, BHV-052).
   */
  confirmAccount(vendorId: string, actor: string, note: string): Promise<VendorResult> {
    return this.serial(async () => {
      const now = this.now().toISOString();
      const s = this.store.read();
      const v = s.vendors.find((x) => x.id === vendorId);
      if (!v) return { ok: false, code: 'NOT_FOUND', message: 'proveedor no encontrado', status: 404 };
      const p = v.pending_account;
      if (!p) return { ok: false, code: 'NO_PENDING_ACCOUNT', message: 'este proveedor no tiene una cuenta por confirmar', status: 409 };
      const person = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ');
      if (person(actor) === person(p.changed_by)) {
        return { ok: false, code: 'SAME_ACTOR', message: 'quien agregó o cambió la cuenta no puede confirmarla', status: 403 };
      }
      if (note.trim().length < 10) {
        return { ok: false, code: 'VERIFICATION_NOTE_REQUIRED', message: 'escribe cómo se verificó la cuenta por otro canal (al menos 10 caracteres)', status: 400 };
      }
      const waiting = waitingFor(s, vendorId, p.value);
      this.store.tx((d) => {
        const live = d.vendors.find((x) => x.id === vendorId)!;
        const before = live.account;
        live.account = p.value;
        live.pending_account = null;
        live.account_confirmed_by = actor;
        live.account_confirmed_at = now;
        live.account_confirmation_note = note.trim();
        appendAudit(d, {
          at: now,
          invoice_id: null,
          type: 'vendor.account_confirmed',
          actor,
          data: { vendor_id: live.id, name: live.name, account_masked: maskAccount(p.value), previous_masked: before ? maskAccount(before) : null, changed_by: p.changed_by, note: note.trim(), waiting_invoices: waiting },
        });
      });
      return { ok: true, vendor_id: vendorId, waiting_invoices: waiting };
    });
  }

  /** Holds every pending item past its timeout. */
  sweepExpired(): Promise<number> {
    return this.serial(async () => {
      const s = this.store.read();
      const nowMs = this.now().getTime();
      let n = 0;
      for (const p of Object.values(s.pending)) {
        if (!p.resolved_at && Date.parse(p.expires_at) < nowMs) {
          this.tools.ctx.currentInvoiceId = p.invoice_id;
          await this.tools.call('record_hold', { invoice_id: p.invoice_id, reasons: ['EXPIRED'] });
          this.tools.ctx.currentInvoiceId = null;
          n++;
        }
      }
      return n;
    });
  }

  verifyAudit(): VerifyResult {
    return verifyChain(this.store.read().audit);
  }

  private actionResult(id: string): ActionResult {
    const inv = this.store.read().invoices[id];
    return { ok: true, invoice_id: id, status: inv.status, reasons: inv.reasons, payment_id: inv.payment_id };
  }

  private emit(id: string, op: string, startedMs: number) {
    const inv = this.store.read().invoices[id];
    const r = inv.readings;
    const models = [r.primary, r.check, r.tiebreak ?? null].filter((x): x is Extract<ReadResult, { ok: true }> => !!x && x.ok);
    this.telemetry.event({
      op,
      invoice_id: id,
      kind: inv.document.kind,
      outcome: inv.status,
      failed_rules: inv.reasons,
      policy_version: inv.evaluation_id ? this.store.read().evaluations[inv.evaluation_id]?.policy_version ?? null : null,
      latency_ms: Date.now() - startedMs,
      models: models.map((m) => ({
        model: m.model,
        input_tokens: m.usage.input_tokens,
        output_tokens: m.usage.output_tokens,
        reasoning_tokens: m.usage.reasoning_tokens ?? 0,
        cost_usd: m.usage.cost_usd,
      })),
    });
  }
}
