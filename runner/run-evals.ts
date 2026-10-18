// The suite runner: `npm run evals`. Loads evals/ read-only, runs each case its tier's number of
// times through the real core and the pinned model route, checks trajectory, asserts and
// forbidden entries, and writes a new runs/<run-id>.json. Exit 0 only when every case meets its
// threshold and no adversarial run failed.
//
// PAGOCLARO_EVAL_READERS=oracle swaps the readers for a test double to dry-run the harness; such a
// run is written to tmp/runs-dry/, never to runs/, and never counts as the green.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../src/config';
import type { ReadResult } from '../src/domain/types';
import type { InvoiceDocument } from '../src/extract/document';
import { AnthropicExtractor, type Extractor } from '../src/extract/extractor';
import { SpendMeter } from '../src/extract/spend';
import { BINDINGS } from './bindings';
import { checkTrajectory, materialize, type CaseFile, type Readers } from './harness';
import { OracleExtractor } from './oracle';

const RUNNER = 'npm run evals';
const mode = process.env.PAGOCLARO_EVAL_READERS === 'oracle' ? 'oracle' : 'live';
const config = loadConfig();

/**
 * Live reader that also keeps each reading as the run's evidence, in data/eval-readings/RUN_ID/
 * (git-ignored), never in fixtures/readings/: the demo's readings are `npm run seed`'s (ship v1).
 */
class TeeExtractor implements Extractor {
  constructor(private readonly inner: Extractor, private readonly dir: string) {}
  get model() {
    return this.inner.model;
  }
  async read(doc: InvoiceDocument): Promise<ReadResult> {
    const r = await this.inner.read(doc);
    if (r.ok) {
      const d = join(this.dir, this.inner.model);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, `${doc.sha256}.json`), JSON.stringify(r, null, 2));
    }
    return r;
  }
}

function readersFor(spend: SpendMeter | null, readingsOut: string): Readers {
  if (mode === 'oracle') {
    const p = new OracleExtractor(config.primaryModel);
    const c = new OracleExtractor(config.checkModel);
    const t = new OracleExtractor(config.tiebreakModel);
    return { primary: p, check: c, tiebreak: t, onRender: (sha, inv) => (p.register(sha, inv), c.register(sha, inv), t.register(sha, inv)) };
  }
  const client = new Anthropic();
  const opts = { timeoutMs: config.readerTimeoutMs, effort: 'low' as const };
  return {
    primary: new TeeExtractor(new AnthropicExtractor(client, config.primaryModel, spend!, opts), readingsOut),
    check: new TeeExtractor(new AnthropicExtractor(client, config.checkModel, spend!, opts), readingsOut),
    tiebreak: new TeeExtractor(new AnthropicExtractor(client, config.tiebreakModel, spend!, opts), readingsOut),
  };
}

function loadCases(): CaseFile[] {
  const out: CaseFile[] = [];
  for (const dir of ['golden', 'adversarial']) {
    for (const f of readdirSync(join('evals', dir)).filter((x) => x.endsWith('.json')).sort()) {
      const c = JSON.parse(readFileSync(join('evals', dir, f), 'utf8')) as CaseFile;
      if (c.id !== f.replace('.json', '')) throw new Error(`${dir}/${f}: id no coincide con el archivo`);
      out.push(c);
    }
  }
  return out;
}

async function runOnce(c: CaseFile, spend: SpendMeter | null, readingsOut: string): Promise<{ passed: boolean; detail?: string }> {
  const b = BINDINGS[c.id];
  if (!b) return { passed: false, detail: 'el caso no tiene verificaciones ligadas en el runner' };
  try {
    const ctx = await materialize(c, readersFor(spend, readingsOut));
    const problems: string[] = [];
    const t = checkTrajectory(c, ctx);
    if (t) problems.push(t);
    for (const a of c.expected.asserts) {
      const check = b.asserts[a];
      if (!check) problems.push(`assert sin verificación ligada: "${a}"`);
      else {
        const r = check(ctx);
        if (r) problems.push(`assert "${a}": ${r}`);
      }
    }
    for (const f of c.expected.forbidden) {
      const check = b.forbidden[f];
      if (!check) problems.push(`forbidden sin verificación ligada: "${f}"`);
      else {
        const r = check(ctx);
        if (r) problems.push(`forbidden "${f}": ${r}`);
      }
    }
    return problems.length ? { passed: false, detail: problems.join(' | ') } : { passed: true };
  } catch (e) {
    return { passed: false, detail: `error del arnés: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function main() {
  if (mode === 'live' && !config.hasApiKey) {
    console.error('Falta ANTHROPIC_API_KEY en el entorno o en .env: la suite corre con los lectores reales (Opus 5.5, Haiku 5.5 y Sonnet 5.5).');
    process.exit(2);
  }
  const cfg = JSON.parse(readFileSync('evals/config.json', 'utf8')) as {
    agent_name: string;
    spec_version: number;
    date: string;
    thresholds: Record<string, { runs: number; passes_required: number }>;
  };
  const cases = loadCases();
  const spend = mode === 'live' ? new SpendMeter(config.spendCapUsd, join(config.dataDir, 'model-spend.json')) : null;
  const started = new Date();
  const runId = started.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const readingsOut = join(config.dataDir, 'eval-readings', runId);
  const results: { id: string; runs: { passed: boolean; detail?: string }[] }[] = [];
  const concurrency = mode === 'live' ? 4 : 8;
  const queue = [...cases];
  const byId = new Map<string, { id: string; runs: { passed: boolean; detail?: string }[] }>();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const c = queue.shift()!;
        const th = cfg.thresholds[c.tier];
        const runs: { passed: boolean; detail?: string }[] = [];
        for (let k = 0; k < th.runs; k++) runs.push(await runOnce(c, spend, readingsOut));
        byId.set(c.id, { id: c.id, runs });
        const ok = runs.filter((r) => r.passed).length;
        console.log(`${ok >= th.passes_required && (c.method !== 'adversarial' || ok === runs.length) ? 'PASS' : 'FAIL'} ${c.id} (${c.bhv_ref}, ${c.tier}) ${ok}/${runs.length}${runs.find((r) => !r.passed)?.detail ? `  ${runs.find((r) => !r.passed)!.detail}` : ''}`);
      }
    }),
  );
  for (const c of cases) results.push(byId.get(c.id)!);
  let green = true;
  for (const c of cases) {
    const r = byId.get(c.id)!;
    const th = cfg.thresholds[c.tier];
    const ok = r.runs.filter((x) => x.passed).length;
    if (ok < th.passes_required) green = false;
    if (c.method === 'adversarial' && ok !== r.runs.length) green = false;
  }
  const exit = green ? 0 : 1;
  const file = {
    agent_name: cfg.agent_name,
    spec_version: cfg.spec_version,
    evals_date: cfg.date,
    runner: RUNNER,
    started_at: started.toISOString().replace(/\.\d+Z$/, 'Z'),
    finished_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    exit_code: exit,
    cases: results,
  };
  const dir = mode === 'live' ? 'runs' : join('tmp', 'runs-dry');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${runId}.json`);
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
  const passed = results.filter((r) => r.runs.every((x) => x.passed)).length;
  console.log(`\n${passed}/${results.length} casos verdes · ${path}${spend ? ` · gasto acumulado ${spend.totalUsd.toFixed(4)} USD de ${spend.capUsd}` : ' · lectores de prueba (no cuenta como verde)'}`);
  process.exit(exit);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
