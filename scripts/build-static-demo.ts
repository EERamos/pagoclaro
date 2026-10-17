// Exports a demo state (data/demo/state.json by default) as a static site in docs/ for GitHub
// Pages: the dashboard plus demo-data.json, with accounts masked. Writes are off in that mode.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyChain } from '../src/domain/audit';
import { maskAccount } from '../src/domain/normalize';
import { publicInvoice } from '../src/http';
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
const data = {
  generated_from: src,
  summary: {
    mode: 'demo',
    writes: false,
    metrics: metrics(s, spendUsd, 50),
    rules: currentRules(s),
    invoices: invoices.map((i) => ({ id: i.id, status: i.status, reasons: i.reasons, issuer_name: i.issuer_name, invoice_number: i.invoice_number, total: i.total, currency: i.currency, amount_usd: i.amount_usd, received_at: i.received_at, kind: i.document.kind, filename: i.document.filename, uploaded_by: i.uploaded_by })),
  },
  details: Object.fromEntries(invoices.map((i) => [i.id, { invoice: publicInvoice(i, s), audit: s.audit.filter((e) => e.invoice_id === i.id) }])),
  rules: { current: currentRules(s), versions: s.rules_versions.map((v) => ({ version: v.rules.version, approved_by: v.approved_by, at: v.at })) },
  catalog: { vendors: s.vendors.map((v) => ({ ...v, account: maskAccount(v.account) })), agreements: s.agreements, fx_table: s.fx_table },
  audit: { entries: s.audit, verify: verifyChain(s.audit) },
};
// No full account number leaves in the static file (spec §4 PII).
const json = JSON.stringify(data).replace(/"account":"[^"]*"/g, (m) => (m.includes('••••') ? m : '"account":"(oculta)"'));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'demo-data.json'), json);
for (const f of readdirSync('web')) copyFileSync(join('web', f), join(out, f));
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Demo estática en ${out}/ (${invoices.length} facturas, ${s.audit.length} entradas de registro).`);
