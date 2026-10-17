// What a reader receives: the raw file, its kind and its hash. Nothing here interprets content.
import { createHash } from 'node:crypto';
import type { DocumentKind } from '../domain/types';

export const MAX_BYTES = 10 * 1024 * 1024;

export interface InvoiceDocument {
  kind: DocumentKind;
  filename: string;
  mediaType: string;
  bytes: Buffer;
  sha256: string;
}

export type DetectResult = { ok: true; doc: InvoiceDocument } | { ok: false; why: string; sha256: string; kind: DocumentKind; mediaType: string };

export function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const startsWith = (b: Buffer, sig: number[]) => sig.every((x, i) => b[i] === x);

export function detectDocument(filename: string, bytes: Buffer): DetectResult {
  const hash = sha256(bytes);
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.') + 1);
  const fail = (why: string, kind: DocumentKind, mediaType: string): DetectResult => ({ ok: false, why, sha256: hash, kind, mediaType });

  if (bytes.length === 0) return fail('el archivo está vacío', 'pdf', 'application/octet-stream');
  if (bytes.length > MAX_BYTES) return fail('el archivo pasa de 10 MB', 'pdf', 'application/octet-stream');

  if (ext === 'pdf') {
    if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return fail('los bytes no forman un PDF válido', 'pdf', 'application/pdf');
    return { ok: true, doc: { kind: 'pdf', filename, mediaType: 'application/pdf', bytes, sha256: hash } };
  }
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, doc: { kind: 'image', filename, mediaType: 'image/png', bytes, sha256: hash } };
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: true, doc: { kind: 'image', filename, mediaType: 'image/jpeg', bytes, sha256: hash } };
    return fail('los bytes no forman una imagen PNG o JPG', 'image', 'image/png');
  }
  if (ext === 'eml') return { ok: true, doc: { kind: 'email', filename, mediaType: 'message/rfc822', bytes, sha256: hash } };
  if (ext === 'txt') return { ok: true, doc: { kind: 'chat', filename, mediaType: 'text/plain', bytes, sha256: hash } };
  return fail(`formato .${ext} no soportado (PDF, PNG, JPG, EML o TXT)`, 'pdf', 'application/octet-stream');
}
