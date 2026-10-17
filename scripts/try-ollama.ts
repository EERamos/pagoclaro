// Free local check of the reader's prompt and schema with Ollama (text documents only).
import { readFileSync } from 'node:fs';
import { detectDocument } from '../src/extract/document';
import { OllamaExtractor } from '../src/extract/extractor';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['ADV-005', 'ADV-006'];
const reader = new OllamaExtractor(process.env.OLLAMA_MODEL ?? 'qwen3:8b');
for (const id of ids) {
  const dir = id.startsWith('ADV') ? 'adversarial' : 'golden';
  const c = JSON.parse(readFileSync(`evals/${dir}/${id}.json`, 'utf8')) as { input: { fixture: { invoice: FixtureInvoice } } };
  const r = await renderInvoice(c.input.fixture.invoice);
  const d = detectDocument(r.filename, r.bytes);
  if (!d.ok) throw new Error(d.why);
  const t0 = Date.now();
  const res = await reader.read(d.doc);
  console.log(`${id} (${((Date.now() - t0) / 1000).toFixed(1)} s):`, JSON.stringify(res, null, 2));
}
