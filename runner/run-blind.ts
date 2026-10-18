// The blind set (design §1 Goodhart notes): 12 invoices written apart, never used while building.
// `npm run blind` runs them once with the live readers and reports the metric separately.
// `npm run blind -- --check` only validates that every file loads and renders (no evaluation).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../src/config';
import { AnthropicExtractor } from '../src/extract/extractor';
import { SpendMeter } from '../src/extract/spend';
import { materialize, type CaseFile, type Fixture } from './harness';
import { renderInvoice } from './render';

interface BlindCase {
  id: string;
  description: string;
  fixture: Fixture;
  expected: { outcome: 'PAY' | 'HOLD' | 'ESCALATE'; reasons_any: string[]; why: string };
}

const config = loadConfig();
const files = readdirSync('blind').filter((f) => /^BLD-\d{3}\.json$/.test(f)).sort();
const cases = files.map((f) => JSON.parse(readFileSync(join('blind', f), 'utf8')) as BlindCase);

async function main() {
  if (process.argv.includes('--check')) {
    for (const c of cases) {
      if (!c.fixture?.invoice || !c.expected?.outcome) throw new Error(`${c.id}: falta fixture.invoice o expected.outcome`);
      const r = await renderInvoice(c.fixture.invoice);
      if (r.bytes.length < 10) throw new Error(`${c.id}: el archivo renderizado está vacío`);
    }
    console.log(`${cases.length} casos ciegos cargan y se renderizan (no se evaluó nada).`);
    return;
  }
  if (!config.hasApiKey) {
    console.error('Falta ANTHROPIC_API_KEY: el set ciego corre una sola vez con los lectores reales.');
    process.exit(2);
  }
  const spend = new SpendMeter(config.spendCapUsd, join(config.dataDir, 'model-spend.json'));
  const client = new Anthropic();
  const opts = { timeoutMs: config.readerTimeoutMs, effort: 'low' as const };
  const rows: { id: string; expected: string; got: string; reasons: string[]; correct: boolean; improper_payment: boolean }[] = [];
  for (const c of cases) {
    const asCase: CaseFile = { id: c.id, bhv_ref: 'BLIND@1', method: 'deterministic', tier: 'reversible', input: { message: c.description, fixture: c.fixture }, expected: { asserts: [], forbidden: [] } };
    const ctx = await materialize(asCase, {
      primary: new AnthropicExtractor(client, config.primaryModel, spend, opts),
      check: new AnthropicExtractor(client, config.checkModel, spend, opts),
      tiebreak: new AnthropicExtractor(client, config.tiebreakModel, spend, opts),
    });
    const inv = Object.values(ctx.state().invoices)[0];
    const got = inv?.status === 'PAID' ? 'PAY' : inv?.status === 'PENDING' ? 'ESCALATE' : inv?.status === 'HELD' || inv?.status === 'EXPIRED' ? 'HOLD' : `OTRO:${inv?.status}`;
    const reasonsOk = c.expected.reasons_any.every((r) => inv?.reasons.includes(r as never));
    const correct = got === c.expected.outcome && (got === 'PAY' || reasonsOk);
    rows.push({ id: c.id, expected: c.expected.outcome, got, reasons: inv?.reasons ?? [], correct, improper_payment: got === 'PAY' && c.expected.outcome !== 'PAY' });
    console.log(`${correct ? 'OK  ' : 'MAL '} ${c.id} esperado ${c.expected.outcome}, obtuvo ${got} ${inv?.reasons.length ? `(${inv.reasons.join(', ')})` : ''}`);
  }
  const autonomousCorrect = rows.filter((r) => r.correct && r.got !== 'ESCALATE').length;
  const summary = {
    cases: rows.length,
    correct: rows.filter((r) => r.correct).length,
    autonomy_correct_pct: Math.round((autonomousCorrect / rows.length) * 1000) / 10,
    improper_payments: rows.filter((r) => r.improper_payment).length,
    spend_usd: Math.round(spend.totalUsd * 10000) / 10000,
  };
  mkdirSync('runs-blind', { recursive: true });
  const path = join('runs-blind', `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`);
  writeFileSync(path, JSON.stringify({ summary, rows }, null, 2) + '\n');
  console.log(`\nSet ciego: ${summary.correct}/${summary.cases} correctas · autonomía correcta ${summary.autonomy_correct_pct} % · pagos indebidos ${summary.improper_payments} · ${path}`);
  process.exit(summary.improper_payments === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
