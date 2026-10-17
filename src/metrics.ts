// Dashboard metrics, all derived from the store (nothing stored twice).
import { verifyChain } from './domain/audit';
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
    model_spend_usd: Math.round(spendUsd * 10000) / 10000,
    model_spend_cap_usd: capUsd,
    rule_hits: ruleHits,
    audit_chain_ok: chain.ok,
    audit_entries: s.audit.length,
    policy_version: s.rules_versions.length ? currentRules(s).version : null,
  };
}

/** Re-runs the engine over every stored decision with other rules. Writes nothing. */
export function whatIf(s: State, rules: Rules) {
  const changes: { invoice_id: string; invoice_number: string | null; from: string; to: string }[] = [];
  let compared = 0;
  for (const i of Object.values(s.invoices)) {
    if (!i.facts || !i.evaluation_id) continue;
    const ev = s.evaluations[i.evaluation_id];
    if (!ev || ev.approval) continue;
    compared++;
    const res = evaluate(i.facts, rules, null);
    if (res.outcome !== ev.outcome) changes.push({ invoice_id: i.id, invoice_number: i.invoice_number, from: ev.outcome, to: res.outcome });
  }
  return { compared, changed: changes.length, changes };
}
