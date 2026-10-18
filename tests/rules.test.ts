import { describe, expect, test } from 'vitest';
import { APPROVABLE, evaluate, HOLD_CODES } from '../src/domain/rules';
import type { Facts, Rules, VendorView } from '../src/domain/types';

const RULES: Rules = {
  version: 1,
  auto_approve_up_to_usd: 5000,
  hard_cap_per_invoice_usd: 25000,
  monthly_budget_usd: 60000,
  contract_tolerance_pct: 1,
  possible_duplicate_window_days: 10,
  split_window_days: 7,
  stale_after_days: 120,
  future_tolerance_days: 3,
  pending_timeout_hours: 72,
  no_agreement_max_per_invoice_usd: 0,
  no_agreement_max_per_month_usd: 0,
};
const VENDOR: VendorView = { id: 'ven_cloudbridge', name: 'Cloudbridge LLC', tax_id: '12-3456789', country: 'US', currency: 'USD', rail: 'ACH', account: '000000001-000123456789', pending_account: null, status: 'active' };

function facts(over: Partial<Facts> & { total?: number } = {}): Facts {
  const total = over.total ?? 1000;
  return {
    provenance: {},
    reading: { issuer_tax_id: '12-3456789', invoice_number: 'CB-1', issue_date: '2026-10-15', currency: 'USD', total, lines_total: total, payment_account: VENDOR.account, has_suspicious_text: false },
    vendor: VENDOR,
    account_matches: true,
    agreement: { id: 'agr', vendor_id: VENDOR.id, kind: 'PURCHASE_ORDER', currency: 'USD', amount_per_period: null, period: null, total: 20000, remaining: 20000, status: 'open' },
    ledger: { exact_duplicate: null, possible_duplicates: [], vendor_paid_usd_in_split_window: 0, period: '2026-10', period_committed_usd: 10000 },
    fx: { amount_usd: total, rate: 1, rate_date: '2026-10-16', source: 'tabla' },
    today: '2026-10-17T12:00:00Z',
    ...over,
  };
}

describe('cuentas por confirmar y tope sin acuerdo (spec v3)', () => {
  const PENDING = '000000001-000999999999';
  const withPending: VendorView = { ...VENDOR, pending_account: PENDING };
  test('BHV-049 una factura a la cuenta por confirmar escala con ACCOUNT_PENDING y no se puede aprobar', () => {
    const f = facts({ vendor: withPending, account_matches: false, pending_account_matches: true });
    f.reading.payment_account = PENDING;
    const r = evaluate(f, RULES);
    expect(r.outcome).toBe('ESCALATE');
    expect(r.rules.find((x) => x.rule === 'ACCOUNT_PENDING')?.result).toBe('FAIL');
    expect(r.rules.find((x) => x.rule === 'ACCOUNT_MISMATCH')?.result).toBe('PASS');
    expect(APPROVABLE.has('ACCOUNT_PENDING')).toBe(false);
    const ap = evaluate(f, RULES, { approver: 'luis.tesoreria', at: 't' });
    expect(ap.outcome).toBe('HOLD');
    expect(ap.rules.find((x) => x.rule === 'NOT_APPROVABLE')?.result).toBe('FAIL');
  });
  test('BHV-050 mientras la cuenta nueva espera, la confirmada se paga y ACCOUNT_PENDING queda en PASS', () => {
    const r = evaluate(facts({ vendor: withPending, account_matches: true, pending_account_matches: false }), RULES);
    expect(r.outcome).toBe('PAY');
    expect(r.rules.find((x) => x.rule === 'ACCOUNT_PENDING')?.result).toBe('PASS');
  });
  test('BHV-054 sin acuerdo se paga solo bajo el tope de la empresa, con la cuenta confirmada', () => {
    const capped: Rules = { ...RULES, no_agreement_max_per_invoice_usd: 1000, no_agreement_max_per_month_usd: 3000 };
    const ledger = { ...facts().ledger!, vendor_paid_usd_in_period: 0 };
    const small = evaluate(facts({ total: 600, agreement: null, ledger }), capped);
    expect(small.outcome).toBe('PAY');
    expect(small.rules.find((x) => x.rule === 'NO_AGREEMENT')?.result).toBe('PASS');
    const big = evaluate(facts({ total: 1500, agreement: null, ledger }), capped);
    expect(big.rules.find((x) => x.rule === 'NO_AGREEMENT')?.result).toBe('FAIL');
    const month = evaluate(facts({ total: 600, agreement: null, ledger: { ...ledger, vendor_paid_usd_in_period: 2600 } }), capped);
    expect(month.rules.find((x) => x.rule === 'NO_AGREEMENT')?.result).toBe('FAIL');
    const zero = evaluate(facts({ total: 600, agreement: null, ledger }), RULES);
    expect(zero.rules.find((x) => x.rule === 'NO_AGREEMENT')?.result).toBe('FAIL');
    const unconfirmed = evaluate(facts({ total: 600, agreement: null, ledger, account_matches: false, pending_account_matches: true, vendor: withPending }), capped);
    expect(unconfirmed.rules.find((x) => x.rule === 'NO_AGREEMENT')?.result).toBe('FAIL');
  });
});

describe('motor de reglas', () => {
  test('BHV-016 una factura dentro de las reglas da PAY con todo en PASS', () => {
    const r = evaluate(facts(), RULES);
    expect(r.outcome).toBe('PAY');
    expect(r.rules.every((x) => x.result === 'PASS')).toBe(true);
  });

  test('BHV-024 el límite de autoaprobación es inclusivo', () => {
    expect(evaluate(facts({ total: 5000 }), RULES).outcome).toBe('PAY');
    expect(evaluate(facts({ total: 5000.01 }), RULES).outcome).toBe('ESCALATE');
  });

  test('BHV-018 HOLD gana sobre ESCALATE', () => {
    const r = evaluate(facts({ total: 27000, agreement: { ...facts().agreement!, remaining: 200000 } }), RULES);
    expect(r.outcome).toBe('HOLD');
    expect(r.rules.find((x) => x.rule === 'HARD_CAP')?.result).toBe('FAIL');
    expect(r.rules.find((x) => x.rule === 'APPROVAL_THRESHOLD')?.result).toBe('FAIL');
  });

  test('BHV-034 una aprobación levanta el umbral y paga', () => {
    const r = evaluate(facts({ total: 5400 }), RULES, { approver: 'luis.tesoreria', at: '2026-10-17T13:00:00Z' });
    expect(r.outcome).toBe('PAY');
    expect(r.rules.find((x) => x.rule === 'APPROVAL_THRESHOLD')?.lifted_by).toBe('luis.tesoreria');
  });

  test('BHV-040 una aprobación no levanta una cuenta que no coincide', () => {
    const r = evaluate(facts({ account_matches: false }), RULES, { approver: 'luis.tesoreria', at: '2026-10-17T13:00:00Z' });
    expect(r.outcome).toBe('HOLD');
    expect(r.rules.some((x) => x.rule === 'NOT_APPROVABLE' && x.result === 'FAIL')).toBe(true);
  });

  test('BHV-035 una aprobación no levanta reglas de frenar', () => {
    const r = evaluate(facts({ total: 5400, ledger: { ...facts().ledger!, period_committed_usd: 57000 } }), RULES, { approver: 'luis.tesoreria', at: '2026-10-17T13:00:00Z' });
    expect(r.outcome).toBe('HOLD');
    expect(r.rules.find((x) => x.rule === 'BUDGET_EXCEEDED')?.result).toBe('FAIL');
  });

  test('BHV-008 texto con órdenes escala y no se aprueba', () => {
    const f = facts();
    f.reading.has_suspicious_text = true;
    expect(evaluate(f, RULES).outcome).toBe('ESCALATE');
    expect(evaluate(f, RULES, { approver: 'x', at: 'y' }).outcome).toBe('HOLD');
  });

  test('cada regla tiene mensaje en español y en inglés', () => {
    const r = evaluate(facts({ account_matches: false, total: 30000 }), RULES);
    for (const x of r.rules) {
      expect(x.message_es.length).toBeGreaterThan(5);
      expect(x.message_en.length).toBeGreaterThan(5);
    }
  });
});

// Property: for random facts and rules, PAY implies every hard rule passed — no payment outside
// the rules, proven over many cases instead of promised.
describe('propiedad: cero pagos fuera de las reglas', () => {
  let seed = 20261017;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

  test('BHV-016 PAY implica que toda regla quedó en PASS, con y sin aprobación', () => {
    let pays = 0;
    for (let i = 0; i < 20000; i++) {
      const rules: Rules = {
        ...RULES,
        auto_approve_up_to_usd: pick([0, 1000, 5000, 20000]),
        hard_cap_per_invoice_usd: pick([20000, 25000, 50000]),
        monthly_budget_usd: pick([0, 10000, 60000]),
        no_agreement_max_per_invoice_usd: pick([0, 0, 1000, 30000]),
        no_agreement_max_per_month_usd: pick([0, 3000, 100000]),
      };
      if (rules.auto_approve_up_to_usd > rules.hard_cap_per_invoice_usd) continue;
      const total = Math.round(rnd() * 60000 * 100) / 100 + 0.01;
      const f = facts({
        total,
        vendor: rnd() < 0.1 ? null : VENDOR,
        account_matches: pick([true, true, true, false, null]),
        pending_account_matches: pick([null, null, false, true]),
        fx: rnd() < 0.1 ? null : { amount_usd: total, rate: 1, rate_date: '2026-10-16', source: 'tabla' },
        ledger: { exact_duplicate: rnd() < 0.1 ? { invoice_id: 'x', invoice_number: 'CB-1', status: 'PAID' } : null, possible_duplicates: rnd() < 0.1 ? [{ invoice_id: 'y', invoice_number: 'CB-0', issue_date: '2026-10-10' }] : [], vendor_paid_usd_in_split_window: pick([0, 1000, 4500]), period: '2026-10', period_committed_usd: pick([0, 10000, 59000]) },
        agreement: rnd() < 0.1 ? null : { ...facts().agreement!, remaining: pick([0, 1000, 20000, 100000]) },
      });
      f.reading.has_suspicious_text = rnd() < 0.1;
      f.reading.currency = rnd() < 0.05 ? 'AMBIGUOUS' : 'USD';
      f.reading.lines_total = rnd() < 0.05 ? total + 1 : total;
      const approval = rnd() < 0.3 ? { approver: 'p', at: 't' } : null;
      const r = evaluate(f, rules, approval);
      if (r.outcome !== 'PAY') continue;
      pays++;
      for (const x of r.rules) {
        if (x.result === 'FAIL') throw new Error(`PAY con ${x.rule} en FAIL`);
        if (HOLD_CODES.has(x.rule)) expect(x.result).toBe('PASS');
        if (x.lifted_by) expect(APPROVABLE.has(x.rule)).toBe(true);
      }
      expect(f.vendor === null ? approval !== null : true).toBe(true);
      // Never by itself to an account nobody confirmed (design v3 NO-goal), with or without approval.
      if (f.vendor) expect(f.account_matches).toBe(true);
      expect(f.reading.has_suspicious_text).toBe(false);
      expect(f.fx).not.toBeNull();
      expect(f.fx!.amount_usd).toBeLessThanOrEqual(rules.hard_cap_per_invoice_usd + 1e-9);
      if (!approval) expect(f.fx!.amount_usd).toBeLessThanOrEqual(rules.auto_approve_up_to_usd + 1e-9);
    }
    expect(pays).toBeGreaterThan(100);
  });
});
