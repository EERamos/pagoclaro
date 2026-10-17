// Append-only audit log chained by SHA-256: each entry's hash covers the previous hash and the
// entry's canonical content, so editing any entry breaks the chain from that entry on.
import { createHash } from 'node:crypto';

export interface AuditEntry {
  seq: number;
  at: string;
  invoice_id: string | null;
  type: string;
  actor: string;
  data: unknown;
  prev_hash: string;
  hash: string;
}

export const GENESIS = '0'.repeat(64);

/** JSON with object keys sorted, so the same content always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function hashEntry(prev: string, e: Omit<AuditEntry, 'hash' | 'prev_hash'>): string {
  const body = canonical({ seq: e.seq, at: e.at, invoice_id: e.invoice_id, type: e.type, actor: e.actor, data: e.data });
  return createHash('sha256').update(prev).update('\n').update(body).digest('hex');
}

export function makeEntry(prev: AuditEntry | undefined, e: Omit<AuditEntry, 'seq' | 'hash' | 'prev_hash'>): AuditEntry {
  const seq = prev ? prev.seq + 1 : 1;
  const prev_hash = prev ? prev.hash : GENESIS;
  const base = { ...e, seq };
  return { ...base, prev_hash, hash: hashEntry(prev_hash, base) };
}

export type VerifyResult = { ok: true; entries: number } | { ok: false; entries: number; broken_at: number; reason: string };

export function verifyChain(entries: AuditEntry[]): VerifyResult {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return { ok: false, entries: entries.length, broken_at: e.seq, reason: 'secuencia fuera de orden' };
    if (e.prev_hash !== prev) return { ok: false, entries: entries.length, broken_at: e.seq, reason: 'prev_hash no encadena' };
    if (hashEntry(prev, e) !== e.hash) return { ok: false, entries: entries.length, broken_at: e.seq, reason: 'el contenido no coincide con su hash' };
    prev = e.hash;
  }
  return { ok: true, entries: entries.length };
}
