// The demo world (catalog, agreements, rules v1, exchange-rate table, budget baseline), seeded
// once into an empty store. Vendors and agreements are read-only in the dashboard.
import { z } from 'zod';
import { RulesSchema } from './domain/rules';
import { periodOf } from './domain/normalize';
import type { Agreement, FxTable, Rules, Vendor } from './domain/types';
import { appendAudit, type ExternalLedgerEntry, type State, type Store } from './store/store';

export interface World {
  today?: string;
  company: { name: string; tax_id_label: string; tax_id: string; address: string };
  rules: Rules;
  fx_table: FxTable;
  vendors: Vendor[];
  agreements: Agreement[];
  ledger: ExternalLedgerEntry[];
  prior_committed_usd: number;
  access_code?: string;
  actor?: string;
}

const VendorSchema = z.object({ id: z.string(), name: z.string(), tax_id: z.string(), country: z.string(), currency: z.string(), rail: z.enum(['SPEI', 'PIX', 'BRE_B', 'ACH']), account: z.string(), status: z.enum(['active', 'inactive']) });
const AgreementSchema = z.object({
  id: z.string(),
  vendor_id: z.string(),
  kind: z.enum(['CONTRACT', 'PURCHASE_ORDER']),
  currency: z.string(),
  amount_per_period: z.number().nullable(),
  period: z.enum(['MONTHLY']).nullable(),
  total: z.number().nullable().optional(),
  remaining: z.number().nullable(),
  status: z.enum(['open', 'closed']),
});
export const WorldSchema = z.object({
  today: z.string().optional(),
  company: z.object({ name: z.string(), tax_id_label: z.string(), tax_id: z.string(), address: z.string() }),
  rules: RulesSchema,
  fx_table: z.object({ date: z.string(), source: z.string(), rates: z.record(z.string(), z.number().positive()) }),
  vendors: z.array(VendorSchema),
  agreements: z.array(AgreementSchema),
  ledger: z.array(z.object({ invoice_number: z.string(), vendor_id: z.string(), total: z.number(), currency: z.string(), amount_usd: z.number(), issue_date: z.string(), decided_at: z.string(), status: z.enum(['PAID', 'PENDING']) })),
  prior_committed_usd: z.number().nonnegative(),
  access_code: z.string().optional(),
  actor: z.string().optional(),
});

export function seedWorld(store: Store, world: World, at: string, by = 'seed'): void {
  const w = WorldSchema.parse(world);
  store.tx((d: State) => {
    if (d.rules_versions.length > 0) return;
    d.rules_versions.push({ rules: w.rules as Rules, approved_by: by, at });
    d.fx_table = w.fx_table;
    d.vendors = w.vendors as Vendor[];
    d.agreements = w.agreements as Agreement[];
    d.external_ledger = w.ledger;
    d.budget_baselines[periodOf(w.today ?? at)] = w.prior_committed_usd;
    appendAudit(d, { at, invoice_id: null, type: 'rules.loaded', actor: by, data: { version: w.rules.version, rules: w.rules } });
  });
}
