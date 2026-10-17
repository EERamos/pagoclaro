// Cross-check of the two independent readings (spec §7 Assumption: exact match, after
// normalization, on tax id, invoice number, currency, total in cents and payment account).
import { cents, normAccount, normInvoiceNumber, normTaxId } from './normalize';
import type { InvoiceReading } from './types';

export type CrossField = 'issuer_tax_id' | 'invoice_number' | 'currency' | 'total' | 'payment_account';

export function compareReadings(a: InvoiceReading, b: InvoiceReading): CrossField[] {
  const diff: CrossField[] = [];
  if (normTaxId(a.issuer_tax_id) !== normTaxId(b.issuer_tax_id)) diff.push('issuer_tax_id');
  if (normInvoiceNumber(a.invoice_number) !== normInvoiceNumber(b.invoice_number)) diff.push('invoice_number');
  if (a.currency !== b.currency) diff.push('currency');
  if (cents(a.total) !== cents(b.total)) diff.push('total');
  if (normAccount(a.payment_account) !== normAccount(b.payment_account)) diff.push('payment_account');
  return diff;
}

export function linesTotal(r: InvoiceReading): number | null {
  if (!r.lines || r.lines.length === 0) return null;
  return r.lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);
}

/** Phrases that try to give orders, from both readings, deduplicated. */
export function suspiciousUnion(a: InvoiceReading, b: InvoiceReading | null): string[] {
  const all = [...(a.suspicious_text ?? []), ...(b?.suspicious_text ?? [])].map((s) => s.trim()).filter(Boolean);
  return [...new Set(all)];
}
