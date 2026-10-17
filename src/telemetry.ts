// One event per invoice operation, OTel GenAI attribute names, never the document's content:
// no text, no tax ids, no accounts (spec BHV-033, stack row "No message content in telemetry").
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TelemetryInput {
  op: string;
  invoice_id: string;
  kind: string;
  outcome: string;
  failed_rules: string[];
  policy_version: number | null;
  latency_ms: number;
  models: { model: string; input_tokens: number; output_tokens: number; cost_usd: number }[];
}

export type TelemetryEvent = Record<string, string | number | string[] | null>;

export interface Telemetry {
  event(e: TelemetryInput): TelemetryEvent;
  readonly events: TelemetryEvent[];
}

const SAFE_CODE = /^[A-Z_]{2,40}$/;

export function toEvent(e: TelemetryInput, at: string): TelemetryEvent {
  const ev: TelemetryEvent = {
    'service.name': 'pagoclaro',
    'event.time': at,
    'pagoclaro.op': e.op,
    'pagoclaro.invoice.id': e.invoice_id,
    'pagoclaro.document.kind': e.kind,
    'pagoclaro.outcome': e.outcome,
    'pagoclaro.failed_rules': e.failed_rules.filter((c) => SAFE_CODE.test(c)),
    'pagoclaro.policy.version': e.policy_version,
    'pagoclaro.latency_ms': e.latency_ms,
    'gen_ai.operation.name': 'chat',
    'gen_ai.provider.name': e.models.length ? 'anthropic' : null,
    'gen_ai.request.model': e.models.map((m) => m.model),
    'gen_ai.usage.input_tokens': e.models.reduce((s, m) => s + m.input_tokens, 0),
    'gen_ai.usage.output_tokens': e.models.reduce((s, m) => s + m.output_tokens, 0),
    'pagoclaro.cost_usd': Math.round(e.models.reduce((s, m) => s + m.cost_usd, 0) * 1e6) / 1e6,
  };
  return ev;
}

export class JsonlTelemetry implements Telemetry {
  readonly events: TelemetryEvent[] = [];

  constructor(
    private readonly file: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  event(e: TelemetryInput): TelemetryEvent {
    const ev = toEvent(e, this.now().toISOString());
    this.events.push(ev);
    if (this.events.length > 500) this.events.shift();
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      appendFileSync(this.file, `${JSON.stringify(ev)}\n`);
    }
    return ev;
  }
}
