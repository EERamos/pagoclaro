// The build's model probe: one real call per pinned model to settle how it behaves (structured
// output through output_config.format, no tools; reasoning tokens; PDF and image input) and what
// a reading costs. It reads one invoice PDF and one PNG with each model. Cost: well under 0.25 USD.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../src/config';
import { detectDocument } from '../src/extract/document';
import { AnthropicExtractor } from '../src/extract/extractor';
import { SpendMeter } from '../src/extract/spend';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

const config = loadConfig();
if (!config.hasApiKey) {
  console.error('Falta ANTHROPIC_API_KEY.');
  process.exit(2);
}
const spend = new SpendMeter(config.spendCapUsd, join(config.dataDir, 'model-spend.json'));
const client = new Anthropic();
const load = (id: string) => (JSON.parse(readFileSync(join('evals', id.startsWith('ADV') ? 'adversarial' : 'golden', `${id}.json`), 'utf8')) as { input: { fixture: { invoice: FixtureInvoice } } }).input.fixture.invoice;

for (const model of [config.primaryModel, config.checkModel]) {
  const reader = new AnthropicExtractor(client, model, spend, { timeoutMs: 60_000, effort: 'low' });
  for (const id of ['EVL-001', 'ADV-003']) {
    const r = await renderInvoice(load(id));
    const d = detectDocument(r.filename, r.bytes);
    if (!d.ok) throw new Error(d.why);
    const t0 = Date.now();
    const res = await reader.read(d.doc);
    const ms = Date.now() - t0;
    console.log(`\n${model} · ${id} (${d.doc.kind}) · ${ms} ms`);
    console.log(JSON.stringify(res, null, 2));
  }
}
const snap = spend.snapshot();
console.log(`\nGasto acumulado: ${snap.total_usd.toFixed(5)} USD en ${snap.calls} llamadas · ${JSON.stringify(snap.by_model)}`);
console.log(`Fecha de la prueba: ${new Date().toISOString()}`);
