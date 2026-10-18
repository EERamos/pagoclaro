import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('localhost'),
  PAGOCLARO_DATA_DIR: z.string().default('data'),
  PAGOCLARO_ACCESS_CODE: z.string().min(8).optional(),
  PAGOCLARO_WORLD: z.string().default('fixtures/world/northwind.json'),
  EXTRACTOR_MODE: z.enum(['live', 'record', 'replay', 'ollama']).optional(),
  PRIMARY_MODEL: z.string().default('claude-opus-5-5'),
  CHECK_MODEL: z.string().default('claude-haiku-5-5'),
  TIEBREAK_MODEL: z.string().default('claude-sonnet-5-5'),
  MODEL_SPEND_CAP_USD: z.coerce.number().nonnegative().default(50),
  READINGS_DIR: z.string().default('fixtures/readings'),
  OLLAMA_MODEL: z.string().default('qwen3:8b'),
  READER_TIMEOUT_MS: z.coerce.number().int().positive().default(40_000),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  accessCode: string | null;
  worldFile: string;
  extractorMode: 'live' | 'record' | 'replay' | 'ollama';
  primaryModel: string;
  checkModel: string;
  /** Breaks a disagreement, or stands in when the check reader fails (design v3). */
  tiebreakModel: string;
  spendCapUsd: number;
  readingsDir: string;
  ollamaModel: string;
  readerTimeoutMs: number;
  hasApiKey: boolean;
}

/** Reads `.env` (if present) without overriding the real environment. */
function loadDotEnv(file = '.env'): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const value = m[2].replace(/^"(.*)"$/, '$1');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export function loadConfig(): AppConfig {
  loadDotEnv();
  const e = Env.parse(process.env);
  const hasApiKey = !!e.ANTHROPIC_API_KEY;
  return {
    port: e.PORT,
    host: e.HOST,
    dataDir: e.PAGOCLARO_DATA_DIR,
    accessCode: e.PAGOCLARO_ACCESS_CODE ?? null,
    worldFile: e.PAGOCLARO_WORLD,
    extractorMode: e.EXTRACTOR_MODE ?? (hasApiKey ? 'record' : 'replay'),
    primaryModel: e.PRIMARY_MODEL,
    checkModel: e.CHECK_MODEL,
    tiebreakModel: e.TIEBREAK_MODEL,
    spendCapUsd: e.MODEL_SPEND_CAP_USD,
    readingsDir: e.READINGS_DIR,
    ollamaModel: e.OLLAMA_MODEL,
    readerTimeoutMs: e.READER_TIMEOUT_MS,
    hasApiKey,
  };
}

export const paths = (c: AppConfig) => ({
  state: join(c.dataDir, 'state.json'),
  spend: join(c.dataDir, 'model-spend.json'),
  telemetry: join(c.dataDir, 'telemetry.jsonl'),
});
