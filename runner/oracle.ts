// A reader double for unit tests and dry runs: it returns what a perfect reader would take from
// the fixture's invoice. It never stands in for the model in a recorded run (runs/), whose green
// comes from the pinned model route only.
import type { InvoiceReading, ReadResult } from '../src/domain/types';
import type { InvoiceDocument } from '../src/extract/document';
import type { Extractor } from '../src/extract/extractor';
import type { FixtureInvoice } from './render';

export function oracleReading(inv: FixtureInvoice): InvoiceReading {
  const suspicious: string[] = [];
  if (inv.hidden_text) suspicious.push(inv.hidden_text);
  if (inv.image_note) suspicious.push(inv.image_note);
  const looksLikeOrder = (t: string) => /(autoriz|aprob|approv|urgente|urgent|system|ignora|ignore|paguen|pay to|a partir de hoy)/i.test(t);
  if (inv.kind === 'email' && inv.email && looksLikeOrder(inv.email.body)) suspicious.push(inv.email.body);
  if (inv.kind === 'chat' && inv.chat_text && looksLikeOrder(inv.chat_text)) suspicious.push(inv.chat_text);
  let account: string | null = inv.payment.value;
  if (inv.kind === 'chat' && inv.chat_text) {
    const m = /\b\d{18}\b/.exec(inv.chat_text);
    account = m ? m[0] : null;
  }
  return {
    issuer_name: inv.issuer.name,
    issuer_tax_id: inv.issuer.tax_id,
    invoice_number: inv.number,
    issue_date: inv.issue_date,
    due_date: inv.due_date ?? null,
    currency: (inv.currency_code ?? 'AMBIGUOUS') as InvoiceReading['currency'],
    total: inv.total,
    lines: inv.kind === 'chat' ? [] : inv.lines.map((l) => ({ description: l.description, amount: l.amount })),
    payment_rail_hint: (['SPEI', 'PIX', 'BRE_B', 'ACH'].includes(inv.payment.method) ? inv.payment.method : null) as InvoiceReading['payment_rail_hint'],
    payment_account: account,
    suspicious_text: suspicious,
  };
}

export class OracleExtractor implements Extractor {
  private readonly bySha = new Map<string, FixtureInvoice>();
  constructor(readonly model: string) {}

  register(sha: string, inv: FixtureInvoice): void {
    this.bySha.set(sha, inv);
  }

  async read(doc: InvoiceDocument): Promise<ReadResult> {
    const inv = this.bySha.get(doc.sha256);
    if (!inv) return { ok: false, error: 'UNREADABLE', message: 'documento desconocido para el oráculo' };
    return { ok: true, reading: oracleReading(inv), model: this.model, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  }
}
