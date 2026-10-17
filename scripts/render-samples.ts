// Renders a few eval fixtures to tmp/samples/ so a person can look at what the readers receive.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

const out = 'tmp/samples';
mkdirSync(out, { recursive: true });
const wanted = process.argv.slice(2);
for (const dir of ['evals/golden', 'evals/adversarial']) {
  for (const f of readdirSync(dir)) {
    const id = f.replace('.json', '');
    if (wanted.length && !wanted.includes(id)) continue;
    const c = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { input: { fixture: { invoice?: FixtureInvoice } } };
    const inv = c.input.fixture.invoice;
    if (!inv) continue;
    const r = await renderInvoice(inv);
    writeFileSync(join(out, `${id}__${r.filename}`), r.bytes);
    console.log(`${id}: ${r.filename} (${r.bytes.length} bytes)`);
  }
}
