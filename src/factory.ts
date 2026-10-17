import Anthropic from '@anthropic-ai/sdk';
import { PagoClaro } from './agent/pipeline';
import { Toolbox, type ToolOverrides } from './agent/tools';
import type { AppConfig } from './config';
import { AnthropicExtractor, OllamaExtractor, RecordedExtractor, type Extractor } from './extract/extractor';
import { SpendMeter } from './extract/spend';
import type { Store } from './store/store';
import { JsonlTelemetry, type Telemetry } from './telemetry';

export interface Readers {
  primary: Extractor;
  check: Extractor;
  spend: SpendMeter;
  mode: AppConfig['extractorMode'];
}

/** Picks the readers for a mode. `record` reads live and saves; `replay` never calls a model. */
export function buildReaders(config: AppConfig, spendFile: string | null): Readers {
  const spend = new SpendMeter(config.spendCapUsd, spendFile);
  const mode = config.extractorMode;
  if (mode === 'ollama') {
    const o = new OllamaExtractor(config.ollamaModel);
    return { primary: o, check: o, spend, mode };
  }
  if (mode === 'replay') {
    return {
      primary: new RecordedExtractor(config.primaryModel, config.readingsDir, 'replay'),
      check: new RecordedExtractor(config.checkModel, config.readingsDir, 'replay'),
      spend,
      mode,
    };
  }
  const client = new Anthropic();
  const opts = { timeoutMs: config.readerTimeoutMs, effort: 'low' as const };
  const livePrimary = new AnthropicExtractor(client, config.primaryModel, spend, opts);
  const liveCheck = new AnthropicExtractor(client, config.checkModel, spend, opts);
  if (mode === 'live') return { primary: livePrimary, check: liveCheck, spend, mode };
  return {
    primary: new RecordedExtractor(config.primaryModel, config.readingsDir, 'record', livePrimary),
    check: new RecordedExtractor(config.checkModel, config.readingsDir, 'record', liveCheck),
    spend,
    mode,
  };
}

export interface Built {
  agent: PagoClaro;
  tools: Toolbox;
  telemetry: Telemetry;
}

export function createPagoClaro(opts: {
  store: Store;
  primary: Extractor;
  check: Extractor;
  now?: () => Date;
  overrides?: ToolOverrides;
  telemetry?: Telemetry;
}): Built {
  const now = opts.now ?? (() => new Date());
  const tools = new Toolbox({ store: opts.store, primary: opts.primary, check: opts.check, now, overrides: opts.overrides });
  const telemetry = opts.telemetry ?? new JsonlTelemetry(null, now);
  const agent = new PagoClaro(opts.store, tools, now, telemetry);
  return { agent, tools, telemetry };
}
