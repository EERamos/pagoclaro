// The deterministic rule engine: evaluate_rules' body. It never sees free text from a document and
// never calls a model. Every rule that applies is listed (PASS or FAIL) so the explanation is
// complete, and the outcome is the strictest failure: HOLD > ESCALATE > PAY.
import { z } from 'zod';
import { describe } from './messages';
import { cents, daysFromTo, maskAccount, round2 } from './normalize';
import type { Facts, Outcome, RuleCode, RuleResult, Rules } from './types';

export const RulesSchema = z
  .object({
    version: z.number().int().positive(),
    auto_approve_up_to_usd: z.number().nonnegative(),
    hard_cap_per_invoice_usd: z.number().positive(),
    monthly_budget_usd: z.number().nonnegative(),
    contract_tolerance_pct: z.number().min(0).max(50),
    possible_duplicate_window_days: z.number().int().min(0).max(90),
    split_window_days: z.number().int().min(0).max(90),
    stale_after_days: z.number().int().min(1).max(3650),
    future_tolerance_days: z.number().int().min(0).max(365),
    pending_timeout_hours: z.number().int().min(1).max(24 * 60),
  })
  .strict()
  .refine((r) => r.auto_approve_up_to_usd <= r.hard_cap_per_invoice_usd, {
    message: 'auto_approve_up_to_usd no puede ser mayor que hard_cap_per_invoice_usd',
  });

/** Reasons a human approval may lift (spec §7 Assumption). Anything else becomes NOT_APPROVABLE. */
export const APPROVABLE: ReadonlySet<RuleCode> = new Set<RuleCode>([
  'APPROVAL_THRESHOLD',
  'POSSIBLE_DUPLICATE',
  'SPLIT_SUSPECTED',
  'AGREEMENT_MISMATCH',
  'NO_AGREEMENT',
  'NEW_BENEFICIARY',
  'STALE_DATE',
  'READINGS_DISAGREE',
]);

export const HOLD_CODES: ReadonlySet<RuleCode> = new Set<RuleCode>([
  'HARD_CAP',
  'BUDGET_EXCEEDED',
  'DUPLICATE',
  'PO_BALANCE_EXCEEDED',
  'NOT_APPROVABLE',
  'EXPIRED',
]);

export interface ApprovalInput {
  approver: string;
  at: string;
}

export interface EngineResult {
  outcome: Outcome;
  rules: RuleResult[];
}

function rule(code: RuleCode, pass: boolean, params: Record<string, string | number>): RuleResult {
  const result = pass ? 'PASS' : 'FAIL';
  return {
    rule: code,
    result,
    outcome_if_fail: HOLD_CODES.has(code) ? 'HOLD' : 'ESCALATE',
    ...describe(code, result, params),
  };
}

export function outcomeOf(results: RuleResult[]): Outcome {
  const fails = results.filter((r) => r.result === 'FAIL');
  if (fails.some((r) => r.outcome_if_fail === 'HOLD')) return 'HOLD';
  if (fails.length > 0) return 'ESCALATE';
  return 'PAY';
}

export function evaluate(facts: Facts, rules: Rules, approval: ApprovalInput | null = null): EngineResult {
  const out: RuleResult[] = [];
  const r = facts.reading;
  const cur = r.currency;

  // Reading-level checks.
  out.push(rule('SUSPICIOUS_TEXT', !r.has_suspicious_text, { count: r.has_suspicious_text ? 1 : 0 }));
  out.push(rule('CURRENCY_AMBIGUOUS', cur !== 'AMBIGUOUS', { cur }));
  if (r.lines_total === null) {
    out.push(rule('LINES_MISMATCH', true, { none: 1, sum: 0, total: r.total, cur }));
  } else {
    out.push(rule('LINES_MISMATCH', cents(r.lines_total) === cents(r.total), { none: 0, sum: round2(r.lines_total), total: r.total, cur }));
  }
  const back = daysFromTo(r.issue_date, facts.today);
  const ahead = daysFromTo(facts.today, r.issue_date);
  const dateOk = Number.isFinite(back) && back <= rules.stale_after_days && ahead <= rules.future_tolerance_days;
  out.push(rule('STALE_DATE', dateOk, { date: r.issue_date, stale: rules.stale_after_days, future: rules.future_tolerance_days }));

  // Who is paid.
  const v = facts.vendor;
  out.push(rule('NEW_BENEFICIARY', v !== null, { name: v?.name ?? '', taxid: r.issuer_tax_id }));
  if (v) {
    out.push(rule('VENDOR_INACTIVE', v.status === 'active', {}));
    out.push(
      rule('ACCOUNT_MISMATCH', facts.account_matches === true, {
        masked: maskAccount(v.account),
        read: r.payment_account ? maskAccount(r.payment_account) : 'sin cuenta',
      }),
    );

    // What was agreed: looked up only for a currency the invoice states (an ambiguous one already
    // escalates on its own rule).
    const a = facts.agreement;
    if (cur !== 'AMBIGUOUS' && cur !== 'OTHER') out.push(rule('NO_AGREEMENT', a !== null, { ref: a?.id ?? '', cur }));
    if (a) {
      if (a.kind === 'CONTRACT' && a.amount_per_period !== null) {
        const dev = (Math.abs(r.total - a.amount_per_period) / a.amount_per_period) * 100;
        out.push(rule('AGREEMENT_MISMATCH', dev <= rules.contract_tolerance_pct + 1e-9, { po: 0, total: r.total, agreed: a.amount_per_period, cur, tol: rules.contract_tolerance_pct }));
      } else {
        out.push(rule('AGREEMENT_MISMATCH', true, { po: 1, total: r.total, agreed: 0, cur, tol: rules.contract_tolerance_pct }));
        if (a.kind === 'PURCHASE_ORDER' && a.remaining !== null) {
          out.push(rule('PO_BALANCE_EXCEEDED', cents(r.total) <= cents(a.remaining), { total: r.total, remaining: a.remaining, cur }));
        }
      }
    }

    // History.
    const l = facts.ledger;
    if (l) {
      out.push(
        rule('DUPLICATE', l.exact_duplicate === null, {
          number: l.exact_duplicate?.invoice_number ?? '',
          status: l.exact_duplicate?.status ?? '',
          ref: l.exact_duplicate?.invoice_id ?? '',
        }),
      );
      out.push(
        rule('POSSIBLE_DUPLICATE', l.possible_duplicates.length === 0, {
          days: rules.possible_duplicate_window_days,
          refs: l.possible_duplicates.map((p) => p.invoice_number).join(', '),
        }),
      );
    }
  }

  // Money.
  const fx = facts.fx;
  out.push(
    rule('NO_FX_RATE', fx !== null, {
      cur,
      rate: fx?.rate ?? 0,
      date: fx?.rate_date ?? '',
      source: fx?.source ?? '',
    }),
  );
  if (fx) {
    const amt = fx.amount_usd;
    out.push(rule('HARD_CAP', amt <= rules.hard_cap_per_invoice_usd + 1e-9, { usd: amt, cap: rules.hard_cap_per_invoice_usd }));
    out.push(rule('APPROVAL_THRESHOLD', amt <= rules.auto_approve_up_to_usd + 1e-9, { usd: amt, limit: rules.auto_approve_up_to_usd }));
    const l = facts.ledger;
    if (l) {
      const remaining = round2(rules.monthly_budget_usd - l.period_committed_usd);
      out.push(rule('BUDGET_EXCEEDED', amt <= remaining + 1e-9, { usd: amt, remaining, period: l.period }));
      const prev = l.vendor_paid_usd_in_split_window;
      const sum = round2(prev + amt);
      const split = amt <= rules.auto_approve_up_to_usd + 1e-9 && sum > rules.auto_approve_up_to_usd + 1e-9;
      out.push(rule('SPLIT_SUSPECTED', !split, { prev, sum, days: rules.split_window_days, limit: rules.auto_approve_up_to_usd }));
    }
  }

  if (!approval) return { outcome: outcomeOf(out), rules: out };
  return applyApproval(out, approval);
}

/**
 * A human approval lifts only the reasons that ask for judgment; any other escalation becomes a
 * NOT_APPROVABLE hold, and every hold-class rule still holds. The result is PAY or HOLD, never a loop.
 */
export function applyApproval(results: RuleResult[], approval: ApprovalInput, extraBlocked: RuleCode[] = []): EngineResult {
  const blocked: RuleCode[] = [...extraBlocked];
  const lifted = results.map((r) => {
    if (r.result !== 'FAIL' || r.outcome_if_fail !== 'ESCALATE') return r;
    if (APPROVABLE.has(r.rule)) {
      return {
        ...r,
        result: 'PASS' as const,
        lifted_by: approval.approver,
        message_es: `${r.message_es} Aprobado por ${approval.approver}.`,
        message_en: `${r.message_en} Approved by ${approval.approver}.`,
      };
    }
    blocked.push(r.rule);
    return r;
  });
  const finalRules = [...lifted];
  if (blocked.length > 0) {
    // The blocked escalations stay visible as FAIL; NOT_APPROVABLE turns the outcome into a hold.
    finalRules.push(rule('NOT_APPROVABLE', false, { codes: [...new Set(blocked)].join(', ') }));
  }
  const outcome = outcomeOf(finalRules);
  return { outcome: outcome === 'ESCALATE' ? 'HOLD' : outcome, rules: finalRules };
}
