// Exports a demo state (data/demo/state.json by default) as a static site in docs/ for GitHub
// Pages: the dashboard plus demo-data.json, with accounts masked. Writes are off in that mode.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyChain } from '../src/domain/audit';
import { publicInvoice, publicVendor, summaryInvoice } from '../src/http';
import { metrics } from '../src/metrics';
import { currentRules, type State } from '../src/store/store';

const src = process.argv[2] ?? join('data', 'demo', 'state.json');
const out = process.argv[3] ?? 'docs';
const spendFile = join('data', 'model-spend.json');

const s = JSON.parse(readFileSync(src, 'utf8')) as State;
let spendUsd = 0;
try {
  spendUsd = (JSON.parse(readFileSync(spendFile, 'utf8')) as { total_usd: number }).total_usd;
} catch {
  spendUsd = 0;
}
const invoices = Object.values(s.invoices).sort((a, b) => b.received_at.localeCompare(a.received_at));
// Plain-words sentences (audit summary_es/en) for the per-invoice history.
type Said = { summary_es?: string; summary_en?: string };
const said = (e: unknown) => e as Said;
const data = {
  generated_from: src,
  summary: {
    mode: 'demo',
    writes: false,
    metrics: metrics(s, spendUsd, 50),
    rules: currentRules(s),
    // The same row as GET /api/summary.
    invoices: invoices.map((i) => summaryInvoice(i, s)),
  },
  details: Object.fromEntries(
    invoices.map((i) => {
      const audit = s.audit.filter((e) => e.invoice_id === i.id);
      const history = audit.filter((e) => said(e).summary_es).map((e) => ({ at: e.at, actor: e.actor, summary_es: said(e).summary_es, summary_en: said(e).summary_en ?? null }));
      return [i.id, { invoice: publicInvoice(i, s), audit, ...(history.length ? { history } : {}) }];
    }),
  ),
  rules: { current: currentRules(s), versions: s.rules_versions.map((v) => ({ version: v.rules.version, approved_by: v.approved_by, at: v.at })) },
  // The same vendor view as GET /api/catalog: confirmed and pending accounts masked, waiting count.
  catalog: { vendors: s.vendors.map((v) => publicVendor(v, s)), agreements: s.agreements, fx_table: s.fx_table },
  audit: { entries: s.audit, verify: verifyChain(s.audit) },
};
// No full account number leaves in the static file (spec §4 PII), confirmed or pending.
const json = JSON.stringify(data).replace(/"(pending_)?account":"[^"]*"/g, (m) => (m.includes('••••') ? m : m.replace(/:"[^"]*"$/, ':"(oculta)"')));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'demo-data.json'), json);
for (const f of readdirSync('web')) copyFileSync(join('web', f), join(out, f));
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Demo estática en ${out}/ (${invoices.length} facturas, ${s.audit.length} entradas de registro).`);
