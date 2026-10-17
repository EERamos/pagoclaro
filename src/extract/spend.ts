// Spend meter for the paid readers: every call's cost is added from the provider's usage, and no
// call starts once the cap is reached (design §3: hard cap in code, 50 USD of the owner's credits).
import { existsSync, readFileSync } from 'node:fs';
import { atomicWrite } from '../util/atomic';

/** USD per million tokens (input, output), Anthropic first-party prices as of 2026-10. */
export const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
};

export function costOf(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

interface SpendState {
  total_usd: number;
  calls: number;
  by_model: Record<string, { usd: number; calls: number; input_tokens: number; output_tokens: number }>;
}

export class SpendMeter {
  private state: SpendState = { total_usd: 0, calls: 0, by_model: {} };

  constructor(
    readonly capUsd: number,
    private readonly file: string | null,
  ) {
    if (file && existsSync(file)) {
      try {
        this.state = JSON.parse(readFileSync(file, 'utf8')) as SpendState;
      } catch {
        // A corrupt meter must not reset the spend silently: keep it blocked.
        this.state = { total_usd: capUsd, calls: 0, by_model: {} };
      }
    }
  }

  get totalUsd(): number {
    return this.state.total_usd;
  }

  snapshot(): SpendState {
    return structuredClone(this.state);
  }

  exhausted(): boolean {
    return this.state.total_usd >= this.capUsd;
  }

  add(model: string, inputTokens: number, outputTokens: number): number {
    const usd = costOf(model, inputTokens, outputTokens);
    this.state.total_usd += usd;
    this.state.calls += 1;
    const m = (this.state.by_model[model] ??= { usd: 0, calls: 0, input_tokens: 0, output_tokens: 0 });
    m.usd += usd;
    m.calls += 1;
    m.input_tokens += inputTokens;
    m.output_tokens += outputTokens;
    if (this.file) atomicWrite(this.file, JSON.stringify(this.state, null, 2));
    return usd;
  }
}
