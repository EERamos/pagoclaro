// PagoClaro's fixed flow per invoice (design §3: no model loop). The model only reads; the code
// calls the tools in a fixed order and the deterministic engine decides.
import { verifyChain, type VerifyResult } from '../domain/audit';
import { compareReadings, linesTotal, suspiciousUnion } from '../domain/reconcile';
import { APPROVABLE } from '../domain/rules';
import { newId } from '../domain/normalize';
import type { Facts, InvoiceReading, ReadResult, RuleCode } from '../domain/types';
import { detectDocument, type InvoiceDocument } from '../extract/document';
import { appendAudit, type InvoiceRecord, type Store } from '../store/store';
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
      const result = await this.decide(id, det.ok ? det.doc : null, det.ok ? null : det.why);
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

    // Two independent readings, at most one retry each on a transient failure.
    const readTwice = async (tool: 'read_invoice_primary' | 'read_invoice_check') => {
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
      inv.readings = { primary: p.res, check: c.res, primary_attempts: p.attempts, check_attempts: c.attempts };
      if (p.res.ok) {
        inv.issuer_name = p.res.reading.issuer_name;
        inv.invoice_number = p.res.reading.invoice_number;
        inv.issue_date = p.res.reading.issue_date;
        inv.total = p.res.reading.total;
        inv.currency = p.res.reading.currency;
      }
    });

    for (const [who, r] of [['principal', p.res], ['verificación', c.res]] as const) {
      if (!r.ok) {
        if (r.error === 'UNREADABLE') return this.escalateOrError(id, ['UNREADABLE'], { why: r.message });
        return this.escalateOrError(id, ['READER_FAILED'], { reader: who, error: r.error });
      }
    }
    const primary = (p.res as Extract<ReadResult, { ok: true }>).reading;
    const check = (c.res as Extract<ReadResult, { ok: true }>).reading;

    const diff = compareReadings(primary, check);
    if (diff.length > 0) return this.escalateOrError(id, ['READINGS_DISAGREE'], { fields: diff.join(', ') });
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
    })) as { ok: boolean; vendor: Facts['vendor']; account_matches: boolean | null };
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
      ledger = lg.ok ? { exact_duplicate: lg.exact_duplicate, possible_duplicates: lg.possible_duplicates, vendor_paid_usd_in_split_window: lg.vendor_paid_usd_in_split_window, period: lg.period, period_committed_usd: lg.period_committed_usd } : null;
    }
    let fx: Facts['fx'] = null;
    if (iso && reading.total > 0) {
      const cv = (await this.tools.call('convert_currency', { amount: reading.total, currency: iso })) as any;
      fx = cv.ok ? { amount_usd: cv.amount_usd, rate: cv.rate, rate_date: cv.rate_date, source: cv.source } : null;
    }
    const st = this.store.read();
    const inv = st.invoices[id];
    const used = inv.reading_used ?? 'primary';
    const usedRes = inv.readings[used];
    const otherRes = inv.readings[used === 'primary' ? 'check' : 'primary'];
    const modelOf = (r: ReadResult | null) => (r && r.ok ? r.model : 'sin lectura');
    const readCite = `${inv.document.filename} (sha256 ${inv.document.sha256.slice(0, 12)}) · lector ${used === 'primary' ? 'principal' : 'de verificación'} ${modelOf(usedRes)}, cruzado con ${modelOf(otherRes)}`;
    const provenance: Facts['provenance'] = {};
    for (const f of ['issuer_tax_id', 'invoice_number', 'issue_date', 'currency', 'total', 'payment_account', 'lines']) {
      provenance[`reading.${f}`] = { tag: 'source', cite: readCite };
    }
    if (approval && used === 'check') provenance['reading.choice'] = { tag: 'user-decided', cite: `${approval.approver} eligió la lectura de verificación` };
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

  private async escalateOrError(id: string, reasons: RuleCode[], why: Record<string, string>): Promise<UploadResult> {
    this.store.tx((d) => {
      appendAudit(d, { at: this.now().toISOString(), invoice_id: id, type: 'invoice.unconfirmed', actor: 'pagoclaro', data: { reasons, ...why } });
    });
    const e = (await this.tools.call('escalate_to_human', { invoice_id: id, reasons })) as any;
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

  approve(invoiceId: string, approver: string, note: string | null, confirmReading?: 'primary' | 'check'): Promise<ActionResult> {
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
          return { ok: false, code: 'CONFIRM_READING', message: 'las lecturas no coinciden: elige cuál vale (primary o check)', status: 400 };
        }
        this.store.tx((d) => {
          const p = d.pending[inv.pending_id!];
          p.note = note;
          appendAudit(d, { at: this.now().toISOString(), invoice_id: invoiceId, type: 'approval.received', actor: approver, data: { note, confirm_reading: confirmReading ?? null, reasons: pending.reasons } });
        });
        const blockedEarly = pending.reasons.filter((r) => !APPROVABLE.has(r) && (r === 'UNREADABLE' || r === 'READER_FAILED'));
        const pick = needsChoice ? confirmReading! : 'primary';
        const rr = inv.readings[pick];
        if (blockedEarly.length > 0 || !rr || !rr.ok) {
          await this.tools.call('record_hold', { invoice_id: invoiceId, reasons: ['NOT_APPROVABLE', ...pending.reasons] });
          this.emit(invoiceId, 'approve', started);
          return this.actionResult(invoiceId);
        }
        this.store.tx((d) => {
          d.invoices[invoiceId].reading_used = pick;
        });
        const other = inv.readings[pick === 'primary' ? 'check' : 'primary'];
        const suspicious = suspiciousUnion(rr.reading, other && other.ok ? other.reading : null).length > 0;
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
    const models = [r.primary, r.check].filter((x): x is Extract<ReadResult, { ok: true }> => !!x && x.ok);
    this.telemetry.event({
      op,
      invoice_id: id,
      kind: inv.document.kind,
      outcome: inv.status,
      failed_rules: inv.reasons,
      policy_version: inv.evaluation_id ? this.store.read().evaluations[inv.evaluation_id]?.policy_version ?? null : null,
      latency_ms: Date.now() - startedMs,
      models: models.map((m) => ({ model: m.model, input_tokens: m.usage.input_tokens, output_tokens: m.usage.output_tokens, cost_usd: m.usage.cost_usd })),
    });
  }
}
