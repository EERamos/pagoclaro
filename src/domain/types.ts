// Domain types for PagoClaro. Pure data: no I/O lives here.

export const ISO_CURRENCIES = ['USD', 'MXN', 'COP', 'BRL', 'EUR'] as const;
export type ReadCurrency = (typeof ISO_CURRENCIES)[number] | 'AMBIGUOUS' | 'OTHER';
export type DocumentKind = 'pdf' | 'image' | 'email' | 'chat';
export type Rail = 'SPEI' | 'PIX' | 'BRE_B' | 'ACH';

export interface InvoiceLine {
  description: string;
  amount: number;
}

/** What one reader returns for one invoice. Everything here is data taken from the document. */
export interface InvoiceReading {
  issuer_name: string;
  issuer_tax_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  currency: ReadCurrency;
  total: number;
  lines: InvoiceLine[];
  payment_rail_hint: Rail | 'OTHER' | null;
  payment_account: string | null;
  suspicious_text: string[];
}

export interface ReadUsage {
  input_tokens: number;
  output_tokens: number;
  /** Part of output_tokens the model spent thinking (billed as output); absent in older readings. */
  reasoning_tokens?: number;
  cost_usd: number;
}

export type ReadErrorCode = 'UNREADABLE' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'BUDGET_EXHAUSTED';

export type ReadResult =
  | { ok: true; reading: InvoiceReading; model: string; usage: ReadUsage }
  | { ok: false; error: ReadErrorCode; message: string };

export interface Vendor {
  id: string;
  name: string;
  tax_id: string;
  country: string;
  currency: string;
  rail: Rail;
  account: string;
  status: 'active' | 'inactive';
}

export interface Agreement {
  id: string;
  vendor_id: string;
  kind: 'CONTRACT' | 'PURCHASE_ORDER';
  currency: string;
  amount_per_period: number | null;
  period: 'MONTHLY' | null;
  total?: number | null;
  remaining: number | null;
  status: 'open' | 'closed';
}

export interface FxTable {
  date: string;
  source: string;
  /** USD per one unit of the currency. */
  rates: Record<string, number>;
}

export interface Rules {
  version: number;
  auto_approve_up_to_usd: number;
  hard_cap_per_invoice_usd: number;
  monthly_budget_usd: number;
  contract_tolerance_pct: number;
  possible_duplicate_window_days: number;
  split_window_days: number;
  stale_after_days: number;
  future_tolerance_days: number;
  pending_timeout_hours: number;
}

export type Outcome = 'PAY' | 'HOLD' | 'ESCALATE';

export type InvoiceStatus = 'PROCESSING' | 'PAID' | 'HELD' | 'PENDING' | 'REJECTED' | 'EXPIRED' | 'VOIDED' | 'ERROR';

/** A provenance-tagged value (design §9). */
export interface Tagged<T> {
  value: T;
  tag: 'source' | 'calculated' | 'user-decided' | 'assumption';
  cite: string;
}

export type RuleCode =
  // HOLD class
  | 'HARD_CAP'
  | 'BUDGET_EXCEEDED'
  | 'DUPLICATE'
  | 'PO_BALANCE_EXCEEDED'
  | 'NOT_APPROVABLE'
  | 'EXPIRED'
  // ESCALATE class
  | 'READINGS_DISAGREE'
  | 'UNREADABLE'
  | 'READER_FAILED'
  | 'SUSPICIOUS_TEXT'
  | 'CURRENCY_AMBIGUOUS'
  | 'LINES_MISMATCH'
  | 'NEW_BENEFICIARY'
  | 'VENDOR_INACTIVE'
  | 'ACCOUNT_MISMATCH'
  | 'NO_AGREEMENT'
  | 'AGREEMENT_MISMATCH'
  | 'APPROVAL_THRESHOLD'
  | 'POSSIBLE_DUPLICATE'
  | 'SPLIT_SUSPECTED'
  | 'NO_FX_RATE'
  | 'STALE_DATE';

export interface RuleResult {
  rule: RuleCode;
  result: 'PASS' | 'FAIL';
  outcome_if_fail: 'HOLD' | 'ESCALATE';
  message_es: string;
  message_en: string;
  /** Set when a human approval lifted this rule (user-decided). */
  lifted_by?: string;
}

export interface Evaluation {
  id: string;
  invoice_id: string;
  outcome: Outcome;
  rules: RuleResult[];
  policy_version: number;
  at: string;
  approval: { approver: string; at: string; confirm_reading?: 'primary' | 'check' } | null;
}

export interface LedgerFacts {
  exact_duplicate: { invoice_id: string; invoice_number: string; status: string } | null;
  possible_duplicates: { invoice_id: string; invoice_number: string; issue_date: string }[];
  vendor_paid_usd_in_split_window: number;
  period: string;
  period_committed_usd: number;
}

export interface FxFacts {
  amount_usd: number;
  rate: number;
  rate_date: string;
  source: string;
}

/** Everything evaluate_rules looks at. No free text from the document ever reaches the engine. */
export interface Facts {
  reading: {
    issuer_tax_id: string;
    invoice_number: string;
    issue_date: string;
    currency: ReadCurrency;
    total: number;
    lines_total: number | null;
    payment_account: string | null;
    has_suspicious_text: boolean;
  };
  vendor: Vendor | null;
  account_matches: boolean | null;
  agreement: Agreement | null;
  ledger: LedgerFacts | null;
  fx: FxFacts | null;
  today: string;
  /** Provenance of each fact (design §9): where it came from and how. */
  provenance: Record<string, { tag: 'source' | 'calculated' | 'user-decided' | 'assumption'; cite: string }>;
}

export interface PaymentInstruction {
  id: string;
  invoice_id: string;
  evaluation_id: string;
  rail: Rail;
  amount: number;
  currency: string;
  amount_usd: number;
  fx: { rate: number; date: string; source: string };
  beneficiary: string;
  account: string;
  account_masked: string;
  simulated: true;
  idempotency_key: string;
  created_at: string;
  voided_at: string | null;
  voided_by: string | null;
}
