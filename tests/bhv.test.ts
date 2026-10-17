// One test per eval case, through the same harness as the runner but with the test reader double,
// so every BHV has a fast, free test of the core (the green itself is the runner's live run).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { BINDINGS } from '../runner/bindings';
import { checkTrajectory, materialize, type CaseFile } from '../runner/harness';
import { OracleExtractor } from '../runner/oracle';

const cases: CaseFile[] = ['golden', 'adversarial'].flatMap((d) =>
  readdirSync(join('evals', d))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join('evals', d, f), 'utf8')) as CaseFile),
);

describe('BHV (lector de prueba)', () => {
  for (const c of cases) {
    const bhv = c.bhv_ref.split('@')[0];
    test(`${bhv} ${c.id}`, async () => {
      const p = new OracleExtractor('claude-opus-5-5');
      const k = new OracleExtractor('claude-haiku-5-5');
      const ctx = await materialize(c, { primary: p, check: k, onRender: (sha, inv) => (p.register(sha, inv), k.register(sha, inv)) });
      const problems: string[] = [];
      const t = checkTrajectory(c, ctx);
      if (t) problems.push(t);
      const b = BINDINGS[c.id];
      for (const a of c.expected.asserts) {
        const check = b.asserts[a];
        const r = check ? check(ctx) : 'sin verificación ligada';
        if (r) problems.push(`${a}: ${r}`);
      }
      for (const f of c.expected.forbidden) {
        const check = b.forbidden[f];
        const r = check ? check(ctx) : 'sin verificación ligada';
        if (r) problems.push(`${f}: ${r}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
