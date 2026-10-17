// Tool-surface preflight (no-framework binding, spike 9): the code exposes exactly the spec's tools,
// with the spec's final tiers, and the readers get no tools at all.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { INPUT_SCHEMAS, TOOL_TIERS } from '../src/agent/tools';

const spec = readFileSync('docs/agent/spec.md', 'utf8');
const fromSpec = Object.fromEntries([...spec.matchAll(/^### `([a-z_]+)` — tier: (safe|reversible|destructive)$/gm)].map((m) => [m[1], m[2]]));

describe('superficie de herramientas', () => {
  test('las herramientas y sus niveles son exactamente los del spec', () => {
    expect(Object.keys(fromSpec).length).toBe(10);
    expect(TOOL_TIERS).toEqual(fromSpec);
    expect(Object.keys(INPUT_SCHEMAS).sort()).toEqual(Object.keys(fromSpec).sort());
  });

  test('control negativo: una herramienta de más rompe la igualdad', () => {
    expect({ ...TOOL_TIERS, send_money: 'destructive' }).not.toEqual(fromSpec);
  });

  test('BHV-039 los esquemas de entrada rechazan campos desconocidos', () => {
    const r = INPUT_SCHEMAS.record_hold.safeParse({ invoice_id: 'inv_01M540WM10HZCNY6VP91YNCBZV', reasons: ['HARD_CAP'], force: true });
    expect(r.success).toBe(false);
  });

  test('los lectores no reciben herramientas', () => {
    const src = readFileSync('src/extract/extractor.ts', 'utf8');
    expect(src).not.toMatch(/\btools\s*:/);
  });
});
