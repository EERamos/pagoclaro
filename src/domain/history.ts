// The history's plain-language lines (spec v3, BHV-017, BHV-029, BHV-046): built from the entry,
// the invoice and the rules that applied, never by a model. They say who decided, why, the margin
// against each limit and what is expected from a person, with no rule codes, model names or hashes.
import type { InvoiceRecord, State } from '../store/store';
import { maskAccount } from './normalize';
import type { RuleCode, Rules } from './types';

export interface Summary {
  summary_es: string;
  summary_en: string;
}

interface Entry {
  at: string;
  invoice_id: string | null;
  type: string;
  actor: string;
  data: unknown;
}

const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number | null | undefined, cur: string | null | undefined) => `${num(Number(n ?? 0))} ${cur ?? ''}`.trim();
const usd = (n: number | null | undefined) => money(n, 'USD');
const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
const actorName = (a: string) => (a === 'pagoclaro' ? 'PagoClaro' : a);
/** Ends a sentence on a name without doubling its own period ("S.A. de C.V."). */
const dot = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

const FIELD: Record<string, { es: string; en: string }> = {
  issuer_tax_id: { es: 'la identificación fiscal', en: 'the tax id' },
  invoice_number: { es: 'el número', en: 'the number' },
  currency: { es: 'la moneda', en: 'the currency' },
  total: { es: 'el total', en: 'the total' },
  payment_account: { es: 'la cuenta', en: 'the account' },
};
const fieldList = (fields: string, lang: 'es' | 'en') =>
  fields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => FIELD[f]?.[lang] ?? f)
    .join(lang === 'es' ? ', ' : ', ');

interface Ctx {
  inv: InvoiceRecord | null;
  rules: Rules | null;
  fields: string;
}

/** Each reason in common words, and what a person is expected to do about it. */
const REASON: Record<RuleCode, { es: (c: Ctx) => string; en: (c: Ctx) => string; act?: 'approve' | 'choose' | { es: string; en: string } }> = {
  APPROVAL_THRESHOLD: {
    es: (c) => `el monto (${usd(c.inv?.amount_usd)}) pasa de lo que se paga sin revisión (${usd(c.rules?.auto_approve_up_to_usd)})`,
    en: (c) => `the amount (${usd(c.inv?.amount_usd)}) is above what is paid without review (${usd(c.rules?.auto_approve_up_to_usd)})`,
    act: 'approve',
  },
  HARD_CAP: {
    es: (c) => `el monto (${usd(c.inv?.amount_usd)}) pasa del tope por factura (${usd(c.rules?.hard_cap_per_invoice_usd)})`,
    en: (c) => `the amount (${usd(c.inv?.amount_usd)}) is above the cap per invoice (${usd(c.rules?.hard_cap_per_invoice_usd)})`,
  },
  BUDGET_EXCEEDED: {
    es: (c) => `no alcanza el presupuesto del mes (quedan ${usd((c.rules?.monthly_budget_usd ?? 0) - (c.inv?.facts?.ledger?.period_committed_usd ?? 0))} de ${usd(c.rules?.monthly_budget_usd)})`,
    en: (c) => `the month's budget is short (${usd((c.rules?.monthly_budget_usd ?? 0) - (c.inv?.facts?.ledger?.period_committed_usd ?? 0))} left of ${usd(c.rules?.monthly_budget_usd)})`,
  },
  DUPLICATE: {
    es: () => 'ya hay una factura con ese número de este proveedor, pagada o pendiente',
    en: () => 'an invoice with that number from this vendor is already paid or pending',
  },
  PO_BALANCE_EXCEEDED: {
    es: (c) => `el monto pasa del saldo de la orden de compra (${money(c.inv?.facts?.agreement?.remaining, c.inv?.facts?.agreement?.currency)})`,
    en: (c) => `the amount is above the purchase order balance (${money(c.inv?.facts?.agreement?.remaining, c.inv?.facts?.agreement?.currency)})`,
  },
  NOT_APPROVABLE: {
    es: () => 'una aprobación no puede levantar esos motivos',
    en: () => 'an approval cannot lift those reasons',
  },
  EXPIRED: {
    es: (c) => `nadie la resolvió en ${c.rules?.pending_timeout_hours ?? 72} horas`,
    en: (c) => `nobody resolved it within ${c.rules?.pending_timeout_hours ?? 72} hours`,
  },
  READINGS_DISAGREE: {
    es: (c) => `las lecturas de la factura no coinciden${c.fields ? ` en ${fieldList(c.fields, 'es')}` : ''}`,
    en: (c) => `the readings of the invoice disagree${c.fields ? ` on ${fieldList(c.fields, 'en')}` : ''}`,
    act: 'choose',
  },
  UNREADABLE: {
    es: () => 'el archivo no se pudo leer',
    en: () => 'the file could not be read',
    act: { es: 'pedir al proveedor un archivo legible y volver a enviarlo', en: 'ask the vendor for a readable file and send it again' },
  },
  READER_FAILED: {
    es: () => 'el servicio de lectura no respondió, ni en su reintento',
    en: () => 'the reading service did not answer, not even on its retry',
    act: { es: 'volver a enviar la factura más tarde', en: 'send the invoice again later' },
  },
  SUSPICIOUS_TEXT: {
    es: () => 'el documento trae frases que intentan dar órdenes (se guardan como texto y no se obedecen)',
    en: () => 'the document carries text that tries to give orders (kept as text and not followed)',
    act: { es: 'revisar el documento; si es legítimo, pedir al proveedor una factura sin esas frases, y si no, rechazarla', en: 'review the document; if it is genuine, ask the vendor for an invoice without that text, otherwise reject it' },
  },
  CURRENCY_AMBIGUOUS: {
    es: () => 'la factura no dice en qué moneda está',
    en: () => 'the invoice does not say its currency',
    act: { es: 'pedir al proveedor la factura con la moneda escrita', en: 'ask the vendor for the invoice with its currency written' },
  },
  LINES_MISMATCH: {
    es: () => 'las líneas de la factura no suman el total',
    en: () => 'the invoice lines do not add up to the total',
    act: { es: 'pedir al proveedor una factura corregida', en: 'ask the vendor for a corrected invoice' },
  },
  NEW_BENEFICIARY: {
    es: () => 'el emisor no está en la lista de proveedores autorizados',
    en: () => 'the issuer is not on the authorized vendor list',
    act: 'approve',
  },
  VENDOR_INACTIVE: {
    es: () => 'el proveedor está desactivado en la lista de proveedores autorizados',
    en: () => 'the vendor is deactivated on the authorized vendor list',
    act: { es: 'reactivar al proveedor si corresponde y volver a enviar la factura, o rechazarla', en: 'reactivate the vendor if it applies and send the invoice again, or reject it' },
  },
  ACCOUNT_MISMATCH: {
    es: (c) => `la cuenta de la factura (${readMasked(c)}) no es la cuenta confirmada del proveedor (${vendorMasked(c)})`,
    en: (c) => `the invoice's account (${readMasked(c)}) is not the vendor's confirmed account (${vendorMasked(c)})`,
    act: { es: 'confirmar con el proveedor por otro canal; si cambió de cuenta, registrarla en Proveedores autorizados, y si no, rechazar la factura', en: 'confirm with the vendor through another channel; if the account changed, record it under Authorized vendors, otherwise reject the invoice' },
  },
  ACCOUNT_PENDING: {
    es: (c) => `la cuenta de la factura (${readMasked(c)}) es una cuenta nueva que nadie ha confirmado`,
    en: (c) => `the invoice's account (${readMasked(c)}) is a new account nobody has confirmed`,
    act: { es: 'que alguien distinto de quien cambió la cuenta la confirme en Proveedores autorizados; después una persona puede aprobar la factura', en: 'someone other than who changed the account confirms it under Authorized vendors; then a person can approve the invoice' },
  },
  NO_AGREEMENT: {
    es: (c) => `no hay contrato ni orden de compra con este proveedor${(c.rules?.no_agreement_max_per_invoice_usd ?? 0) > 0 ? ` y el monto no cabe en el tope para proveedores sin acuerdo (${usd(c.rules?.no_agreement_max_per_invoice_usd)} por factura y ${usd(c.rules?.no_agreement_max_per_month_usd)} por mes)` : ''}`,
    en: (c) => `there is no contract or purchase order with this vendor${(c.rules?.no_agreement_max_per_invoice_usd ?? 0) > 0 ? ` and the amount does not fit the cap for vendors without one (${usd(c.rules?.no_agreement_max_per_invoice_usd)} per invoice and ${usd(c.rules?.no_agreement_max_per_month_usd)} per month)` : ''}`,
    act: 'approve',
  },
  AGREEMENT_MISMATCH: {
    es: (c) => `el monto no cuadra con el contrato (${money(c.inv?.facts?.agreement?.amount_per_period, c.inv?.facts?.agreement?.currency)})`,
    en: (c) => `the amount does not match the contract (${money(c.inv?.facts?.agreement?.amount_per_period, c.inv?.facts?.agreement?.currency)})`,
    act: 'approve',
  },
  POSSIBLE_DUPLICATE: {
    es: () => 'hay otro cobro del mismo monto de este proveedor en días cercanos',
    en: () => 'there is another charge for the same amount from this vendor a few days apart',
    act: 'approve',
  },
  SPLIT_SUSPECTED: {
    es: (c) => `junto con lo pagado a este proveedor en los últimos ${c.rules?.split_window_days ?? 7} días pasa de lo que se paga sin revisión`,
    en: (c) => `together with what was paid to this vendor in the last ${c.rules?.split_window_days ?? 7} days it is above what is paid without review`,
    act: 'approve',
  },
  NO_FX_RATE: {
    es: (c) => `no hay tipo de cambio para ${c.inv?.currency ?? 'esa moneda'}`,
    en: (c) => `there is no exchange rate for ${c.inv?.currency ?? 'that currency'}`,
    act: { es: 'pedir la factura en una moneda con tipo de cambio en la tabla', en: 'ask for the invoice in a currency the rate table has' },
  },
  STALE_DATE: {
    es: () => 'la fecha de la factura está fuera de rango',
    en: () => 'the invoice date is out of range',
    act: 'approve',
  },
};

function readMasked(c: Ctx): string {
  const r = c.inv?.facts?.reading.payment_account;
  return r ? maskAccount(r) : 'sin cuenta';
}
function vendorMasked(c: Ctx): string {
  const a = c.inv?.facts?.vendor?.account;
  return a ? maskAccount(a) : 'sin cuenta confirmada';
}

function label(inv: InvoiceRecord | null, lang: 'es' | 'en'): string {
  if (!inv) return lang === 'es' ? 'la factura' : 'the invoice';
  if (inv.invoice_number) {
    const of = inv.issuer_name ? (lang === 'es' ? ` de ${inv.issuer_name}` : ` from ${inv.issuer_name}`) : '';
    return lang === 'es' ? `la factura ${inv.invoice_number}${of}` : `invoice ${inv.invoice_number}${of}`;
  }
  return lang === 'es' ? `el archivo ${inv.document.filename}` : `the file ${inv.document.filename}`;
}
function amount(inv: InvoiceRecord | null): string {
  if (!inv || inv.total === null) return '';
  const base = money(inv.total, inv.currency);
  return inv.currency !== 'USD' && inv.amount_usd !== null ? `${base} (${usd(inv.amount_usd)})` : base;
}
const forAmount = (inv: InvoiceRecord | null, lang: 'es' | 'en') => (amount(inv) ? (lang === 'es' ? ` por ${amount(inv)}` : ` for ${amount(inv)}`) : '');

function reasonsText(reasons: RuleCode[], c: Ctx, lang: 'es' | 'en'): string {
  const others = [...new Set(reasons.filter((r) => r !== 'NOT_APPROVABLE'))];
  const parts = others.map((r) => (REASON[r] ? REASON[r][lang](c) : r));
  if (reasons.includes('NOT_APPROVABLE')) {
    const one = others.length === 1;
    parts.push(lang === 'es' ? `una aprobación no puede levantar ${one ? 'ese motivo' : 'esos motivos'}` : `an approval cannot lift ${one ? 'that reason' : 'those reasons'}`);
  }
  return parts.join('; ');
}

function expected(reasons: RuleCode[], uploader: string, lang: 'es' | 'en'): string {
  const out: string[] = [];
  const add = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };
  for (const r of reasons) {
    const a = REASON[r]?.act;
    if (!a) continue;
    if (a === 'approve') add(lang === 'es' ? `que la apruebe o la rechace alguien distinto de quien la subió (${uploader})` : `someone other than who uploaded it (${uploader}) approves or rejects it`);
    else if (a === 'choose') add(lang === 'es' ? `que una persona distinta de quien la subió (${uploader}) revise la factura y elija la lectura correcta antes de aprobarla; la lectura principal ya está cargada` : `someone other than who uploaded it (${uploader}) reviews the invoice and picks the right reading before approving it; the main reading is preloaded`);
    else add(a[lang]);
  }
  return out.join('; ');
}

function rulesOf(s: State, version: number | null | undefined): Rules | null {
  const v = s.rules_versions.find((x) => x.rules.version === version) ?? s.rules_versions.at(-1);
  return v?.rules ?? null;
}

function lastFields(s: State, invoiceId: string | null): string {
  if (!invoiceId) return '';
  const e = [...s.audit].reverse().find((x) => x.invoice_id === invoiceId && x.type === 'invoice.unconfirmed');
  return String((e?.data as { fields?: string } | undefined)?.fields ?? '');
}

function payLine(s: State, inv: InvoiceRecord, data: any, lang: 'es' | 'en'): string {
  const ev = data?.evaluation;
  const rules = rulesOf(s, ev?.policy_version);
  const approver: string | null = ev?.approval?.approver ?? null;
  const facts = inv.facts;
  const usdAmt = facts?.fx?.amount_usd ?? inv.amount_usd ?? 0;
  const vendor = facts?.vendor ?? null;
  const committedAfter = (facts?.ledger?.period_committed_usd ?? 0) + usdAmt;
  const agr = facts?.agreement ?? null;
  const masked = data?.payment?.account_masked ?? '';
  const es: string[] = [];
  const en: string[] = [];
  if (vendor) {
    es.push(`el proveedor está autorizado y la cuenta (${masked}) es la confirmada`);
    en.push(`the vendor is authorized and the account (${masked}) is the confirmed one`);
  } else {
    es.push(`el emisor no estaba en la lista de proveedores autorizados y lo aprobó una persona; la cuenta es ${masked}`);
    en.push(`the issuer was not on the authorized vendor list and a person approved it; the account is ${masked}`);
  }
  if (agr?.kind === 'CONTRACT') {
    es.push(`cuadra con el contrato de ${money(agr.amount_per_period, agr.currency)}`);
    en.push(`it matches the ${money(agr.amount_per_period, agr.currency)} contract`);
  } else if (agr?.kind === 'PURCHASE_ORDER' && agr.remaining !== null) {
    const left = agr.remaining - (inv.total ?? 0);
    es.push(`la orden de compra queda con ${money(left, agr.currency)} de saldo`);
    en.push(`the purchase order is left with ${money(left, agr.currency)}`);
  } else if (vendor) {
    es.push(`no tiene contrato ni orden de compra y cabe en el tope para proveedores autorizados sin acuerdo (${usd(rules?.no_agreement_max_per_invoice_usd)} por factura y ${usd(rules?.no_agreement_max_per_month_usd)} por mes)`);
    en.push(`it has no contract or purchase order and fits the cap for authorized vendors without one (${usd(rules?.no_agreement_max_per_invoice_usd)} per invoice and ${usd(rules?.no_agreement_max_per_month_usd)} per month)`);
  }
  if (approver) {
    es.push(`el pago (${usd(usdAmt)}) queda dentro del tope por factura de ${usd(rules?.hard_cap_per_invoice_usd)}`);
    en.push(`the payment (${usd(usdAmt)}) is within the cap per invoice of ${usd(rules?.hard_cap_per_invoice_usd)}`);
  } else {
    es.push(`el pago usa ${usd(usdAmt)} de ${usd(rules?.auto_approve_up_to_usd)} que se pagan sin revisión`);
    en.push(`the payment uses ${usd(usdAmt)} of the ${usd(rules?.auto_approve_up_to_usd)} paid without review`);
  }
  es.push(`el mes lleva ${usd(committedAfter)} de ${usd(rules?.monthly_budget_usd)} de presupuesto`);
  en.push(`the month is at ${usd(committedAfter)} of its ${usd(rules?.monthly_budget_usd)} budget`);
  const who =
    lang === 'es'
      ? approver
        ? `Decidió ${approver}, que la aprobó; PagoClaro volvió a revisar las reglas y pagó ${label(inv, 'es')}${forAmount(inv, 'es')}`
        : `PagoClaro pagó ${label(inv, 'es')}${forAmount(inv, 'es')} porque cumple todas las reglas`
      : approver
        ? `${approver} decided by approving it; PagoClaro checked the rules again and paid ${label(inv, 'en')}${forAmount(inv, 'en')}`
        : `PagoClaro paid ${label(inv, 'en')}${forAmount(inv, 'en')} because it meets every rule`;
  return lang === 'es'
    ? `${who}: ${es.join('; ')}. Es una instrucción de pago simulada: no se movió dinero real.`
    : `${who}: ${en.join('; ')}. It is a simulated payment instruction: no real money moved.`;
}

/** The line for one entry, or null for entries that are not part of the history (test seeds). */
export function summarize(s: State, e: Entry): Summary | null {
  const inv = e.invoice_id ? s.invoices[e.invoice_id] ?? null : null;
  const d = (e.data ?? {}) as any;
  const who = actorName(e.actor);
  const both = (es: string, en: string): Summary => ({ summary_es: es, summary_en: en });
  const ctx = (reasons: RuleCode[]): Ctx => ({ inv, rules: rulesOf(s, d?.evaluation?.policy_version ?? d?.policy_version), fields: reasons.includes('READINGS_DISAGREE') ? lastFields(s, e.invoice_id) || String(d.fields ?? '') : '' });
  switch (e.type) {
    case 'invoice.received':
      return both(`${who} subió el archivo ${d.filename}.`, `${who} uploaded the file ${d.filename}.`);
    case 'invoice.unconfirmed': {
      const reasons = (d.reasons ?? []) as RuleCode[];
      const file = inv?.document.filename ?? '';
      if (reasons.includes('READINGS_DISAGREE')) {
        const fes = fieldList(String(d.fields ?? ''), 'es');
        const fen = fieldList(String(d.fields ?? ''), 'en');
        const tb = d.tiebreak === 'failed' ? [' y la lectura de desempate no respondió', ' and the tie-break reading did not answer'] : d.tiebreak === 'disagrees' ? [' y la lectura de desempate no confirmó la principal', ' and the tie-break reading did not confirm the main one'] : ['', ''];
        return both(
          `Las lecturas de ${file} no coinciden en ${fes}${tb[0]}: decide una persona, con la lectura principal ya cargada.`,
          `The readings of ${file} disagree on ${fen}${tb[1]}: a person decides, with the main reading preloaded.`,
        );
      }
      if (reasons.includes('UNREADABLE')) return both(`El archivo ${file} no se pudo leer.`, `The file ${file} could not be read.`);
      return both(`El servicio de lectura no respondió para ${file}, ni en su reintento.`, `The reading service did not answer for ${file}, not even on its retry.`);
    }
    case 'decision.pay':
      if (!inv) return null;
      return both(payLine(s, inv, d, 'es'), payLine(s, inv, d, 'en'));
    case 'decision.escalate': {
      const reasons = (d.reasons ?? []) as RuleCode[];
      const c = ctx(reasons);
      const up = inv?.uploaded_by ?? '';
      const exp = d.expires_at ? [` Si nadie la resuelve antes del ${when(d.expires_at)}, se frena.`, ` If nobody resolves it before ${when(d.expires_at)}, it is held.`] : ['', ''];
      return both(
        `PagoClaro dejó ${label(inv, 'es')}${forAmount(inv, 'es')} esperando a una persona porque ${reasonsText(reasons, c, 'es')}. Se espera: ${expected(reasons, up, 'es') || 'la revisión de una persona'}.${exp[0]} No se movió dinero.`,
        `PagoClaro left ${label(inv, 'en')}${forAmount(inv, 'en')} waiting for a person because ${reasonsText(reasons, c, 'en')}. Expected: ${expected(reasons, up, 'en') || 'a person reviews it'}.${exp[1]} No money moved.`,
      );
    }
    case 'decision.hold': {
      // A hold after an approval names the escalations the approval could not lift, too.
      const failing = ((d?.evaluation?.rules ?? []) as { rule: RuleCode; result: string }[]).filter((r) => r.result === 'FAIL').map((r) => r.rule);
      const reasons = [...new Set([...((d.reasons ?? []) as RuleCode[]), ...failing])];
      const c = ctx(reasons);
      const approver: string | null = d?.evaluation?.approval?.approver ?? null;
      const lead = approver
        ? [`${approver} la aprobó, pero PagoClaro frenó ${label(inv, 'es')}${forAmount(inv, 'es')} al volver a revisar las reglas porque`, `${approver} approved it, but PagoClaro held ${label(inv, 'en')}${forAmount(inv, 'en')} when it checked the rules again because`]
        : [`PagoClaro frenó ${label(inv, 'es')}${forAmount(inv, 'es')} porque`, `PagoClaro held ${label(inv, 'en')}${forAmount(inv, 'en')} because`];
      return both(`${lead[0]} ${reasonsText(reasons, c, 'es')}. No se pagó ni se movió dinero.`, `${lead[1]} ${reasonsText(reasons, c, 'en')}. Nothing was paid and no money moved.`);
    }
    case 'decision.expired': {
      const h = rulesOf(s, null)?.pending_timeout_hours ?? 72;
      return both(`Nadie resolvió ${label(inv, 'es')} en ${h} horas: PagoClaro la frenó por vencida. No se pagó.`, `Nobody resolved ${label(inv, 'en')} within ${h} hours: PagoClaro held it as expired. Nothing was paid.`);
    }
    case 'decision.rejected':
      return both(`${who} rechazó ${label(inv, 'es')}. Motivo: "${d.reason}". No se pagó.`, `${who} rejected ${label(inv, 'en')}. Reason: "${d.reason}". Nothing was paid.`);
    case 'approval.received':
      return both(
        `${who} aprobó ${label(inv, 'es')}${d.note ? ` con la nota "${d.note}"` : ''}; PagoClaro vuelve a revisar las reglas antes de pagar.`,
        `${who} approved ${label(inv, 'en')}${d.note ? ` with the note "${d.note}"` : ''}; PagoClaro checks the rules again before paying.`,
      );
    case 'approval.refused':
      return both(`No se aceptó la aprobación de ${who} para ${label(inv, 'es')}: nadie aprueba una factura que subió.`, `${who}'s approval of ${label(inv, 'en')} was refused: nobody approves an invoice they uploaded.`);
    case 'payment.voided':
      return both(`${who} anuló el pago simulado de ${label(inv, 'es')}. Motivo: "${d.reason}".`, `${who} voided the simulated payment of ${label(inv, 'en')}. Reason: "${d.reason}".`);
    case 'invoice.error':
      return both(`No se pudo terminar de procesar ${label(inv, 'es')}: no se pagó nada y se puede volver a enviar.`, `${label(inv, 'en')} could not be finished: nothing was paid and it can be sent again.`.replace(/^./, (x) => x.toUpperCase()));
    case 'rules.loaded':
    case 'rules.changed': {
      const r = d.rules as Rules | undefined;
      if (!r) return null;
      const cap = r.no_agreement_max_per_invoice_usd ?? 0;
      const es = `pagar sin revisión hasta ${usd(r.auto_approve_up_to_usd)}, tope por factura ${usd(r.hard_cap_per_invoice_usd)}, presupuesto del mes ${usd(r.monthly_budget_usd)}, proveedores autorizados sin acuerdo ${cap > 0 ? `hasta ${usd(cap)} por factura y ${usd(r.no_agreement_max_per_month_usd)} por mes` : 'siempre a revisión'}`;
      const en = `pay without review up to ${usd(r.auto_approve_up_to_usd)}, cap per invoice ${usd(r.hard_cap_per_invoice_usd)}, monthly budget ${usd(r.monthly_budget_usd)}, authorized vendors without an agreement ${cap > 0 ? `up to ${usd(cap)} per invoice and ${usd(r.no_agreement_max_per_month_usd)} per month` : 'always reviewed'}`;
      return e.type === 'rules.loaded'
        ? both(`Se cargaron las reglas de la empresa (versión ${r.version}): ${es}.`, `The company's rules were loaded (version ${r.version}): ${en}.`)
        : both(`${who} cambió las reglas (versión ${r.version}): ${es}.`, `${who} changed the rules (version ${r.version}): ${en}.`);
    }
    case 'vendor.added':
      return both(
        `${who} agregó a ${d.name} como proveedor autorizado, con la cuenta ${d.account_masked} por confirmar. Sus facturas no se pagan solas hasta que otra persona confirme la cuenta.`,
        `${who} added ${d.name} as an authorized vendor, with the account ${d.account_masked} waiting for confirmation. Its invoices are not paid by themselves until someone else confirms the account.`,
      );
    case 'vendor.account_changed':
      return both(
        `${who} cambió la cuenta de ${d.name} de ${d.from_masked} a ${d.to_masked}, que queda por confirmar. Motivo: "${d.reason}". Mientras tanto solo se paga la cuenta confirmada.`,
        `${who} changed ${d.name}'s account from ${d.from_masked} to ${d.to_masked}, now waiting for confirmation. Reason: "${d.reason}". Meanwhile only the confirmed account is paid.`,
      );
    case 'vendor.account_confirmed':
      return both(
        `${who} confirmó la cuenta ${d.account_masked} de ${dot(d.name)} Cómo se verificó: "${d.note}". Confirmar no paga nada: ${d.waiting_invoices} factura(s) siguen esperando a una persona.`,
        `${who} confirmed ${d.name}'s account ${d.account_masked}. How it was checked: "${d.note}". Confirming pays nothing: ${d.waiting_invoices} invoice(s) still wait for a person.`,
      );
    case 'vendor.deactivated':
      return both(`${who} desactivó a ${d.name}: sus facturas ya no se pagan solas. Los pagos anteriores siguen en el libro.`, `${who} deactivated ${d.name}: its invoices are no longer paid by themselves. Earlier payments stay in the ledger.`);
    case 'vendor.reactivated':
      return both(`${who} reactivó a ${d.name} en la lista de proveedores autorizados.`, `${who} reactivated ${d.name} on the authorized vendor list.`);
    default:
      return null;
  }
}
