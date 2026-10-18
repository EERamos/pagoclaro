// Dashboard metrics, all derived from the store (nothing stored twice).
import { activeAlerts } from './alerts';
import { verifyChain } from './domain/audit';
import { periodOf } from './domain/normalize';
import { evaluate } from './domain/rules';
import type { Rules } from './domain/types';
import { currentRules, type State } from './store/store';

export function metrics(s: State, spendUsd: number, capUsd: number) {
  const inv = Object.values(s.invoices).filter((i) => i.status !== 'PROCESSING');
  const count = (st: string) => inv.filter((i) => i.status === st).length;
  const byAgent = inv.filter((i) => {
    if (i.status !== 'PAID' && i.status !== 'HELD' && i.status !== 'VOIDED') return false;
    const ev = i.evaluation_id ? s.evaluations[i.evaluation_id] : null;
    return !!ev && ev.approval === null;
  }).length;
  const payments = Object.values(s.payments);
  const outOfRules = payments.filter((p) => s.evaluations[p.evaluation_id]?.outcome !== 'PAY').length;
  const ruleHits: Record<string, number> = {};
  for (const i of inv) for (const r of i.reasons) ruleHits[r] = (ruleHits[r] ?? 0) + 1;
  const chain = verifyChain(s.audit);
  const modelSpend = Math.round(spendUsd * 10000) / 10000;
  return {
    processed: inv.length,
    paid: count('PAID'),
    held: count('HELD'),
    pending: count('PENDING'),
    rejected: count('REJECTED'),
    expired: count('EXPIRED'),
    voided: count('VOIDED'),
    errors: count('ERROR'),
    decided_by_agent: byAgent,
    autonomy_pct: inv.length ? Math.round((byAgent / inv.length) * 1000) / 10 : 0,
    payments_out_of_rules: outOfRules,
    usd_paid: Math.round(payments.filter((p) => !p.voided_at).reduce((a, p) => a + p.amount_usd, 0) * 100) / 100,
    model_spend_usd: modelSpend,
    model_spend_cap_usd: capUsd,
    rule_hits: ruleHits,
    audit_chain_ok: chain.ok,
    audit_entries: s.audit.length,
    policy_version: s.rules_versions.length ? currentRules(s).version : null,
    budget: budgetOf(s),
    alerts: activeAlerts(s, { payments_out_of_rules: outOfRules, audit_chain_ok: chain.ok, model_spend_usd: modelSpend, model_spend_cap_usd: capUsd }),
  };
}

/**
 * The month's budget as query_ledger counts it: what was committed before this system plus what
 * was paid in the month, here and in the seeded history. The month is the latest invoice's.
 */
function budgetOf(s: State): { period: string; budget_usd: number; committed_usd: number } | null {
  if (!s.rules_versions.length) return null;
  const latest = Object.values(s.invoices).reduce((a, i) => (i.received_at > a ? i.received_at : a), '');
  const period = periodOf(latest || new Date().toISOString());
  const paidHere = Object.values(s.invoices)
    .filter((i) => i.status === 'PAID' && periodOf(i.decided_at ?? i.received_at) === period)
    .reduce((a, i) => a + (i.amount_usd ?? 0), 0);
  const paidBefore = s.external_ledger.filter((e) => e.status === 'PAID' && periodOf(e.decided_at) === period).reduce((a, e) => a + e.amount_usd, 0);
  const committed = (s.budget_baselines[period] ?? 0) + paidHere + paidBefore;
  return { period, budget_usd: currentRules(s).monthly_budget_usd, committed_usd: Math.round(committed * 100) / 100 };
}

/** Re-runs the engine over every stored decision with other rules. Writes nothing. */
export function whatIf(s: State, rules: Rules) {
  const changes: { invoice_id: string; invoice_number: string | null; from: string; to: string }[] = [];
  // How the agent's own decisions split today and with the other rules, for the before/after bars.
  const before = { PAY: 0, HOLD: 0, ESCALATE: 0 };
  const after = { PAY: 0, HOLD: 0, ESCALATE: 0 };
  let compared = 0;
  for (const i of Object.values(s.invoices)) {
    if (!i.facts || !i.evaluation_id) continue;
    const ev = s.evaluations[i.evaluation_id];
    if (!ev || ev.approval) continue;
    compared++;
    const res = evaluate(i.facts, rules, null);
    before[ev.outcome]++;
    after[res.outcome]++;
    if (res.outcome !== ev.outcome) changes.push({ invoice_id: i.id, invoice_number: i.invoice_number, from: ev.outcome, to: res.outcome });
  }
  return { compared, changed: changes.length, changes, before, after };
}
