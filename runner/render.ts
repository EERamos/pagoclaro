// Draws an invoice described in a fixture (evals/, blind/, demo set) as a real file: a PDF (pdf-lib),
// a PNG photo (resvg), an .eml email with the PDF attached, or a chat text. The readers then read
// the file like any upload; nothing here hands them the fixture's values.
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

export interface FixtureInvoice {
  file_name: string;
  kind: 'pdf' | 'image' | 'email' | 'chat' | 'corrupt';
  language: 'es' | 'pt' | 'en';
  issuer: { name: string; tax_id_label: string; tax_id: string; address: string; email?: string };
  bill_to: { name: string; tax_id_label: string; tax_id: string; address: string };
  number: string;
  issue_date: string;
  due_date?: string | null;
  currency_code: string | null;
  currency_display?: string | null;
  lines: { description: string; amount: number; amount_display: string }[];
  total: number;
  total_display: string;
  tax_note?: string | null;
  payment: { method: string; label: string; value: string; bank?: string };
  hidden_text?: string;
  image_note?: string;
  email?: { from: string; to: string; subject: string; body: string };
  chat_text?: string;
  corrupt_bytes?: string;
}

const L = {
  es: { title: 'FACTURA', no: 'Folio', issue: 'Fecha de emisión', due: 'Fecha de vencimiento', billTo: 'Facturar a', desc: 'Concepto', amount: 'Importe', total: 'Total', pay: 'Datos para el pago', bank: 'Banco', method: 'Medio', thanks: 'Gracias por su preferencia.' },
  pt: { title: 'FATURA', no: 'Nº', issue: 'Data de emissão', due: 'Vencimento', billTo: 'Faturar para', desc: 'Descrição', amount: 'Valor', total: 'Total', pay: 'Dados para pagamento', bank: 'Banco', method: 'Meio', thanks: 'Obrigado pela preferência.' },
  en: { title: 'INVOICE', no: 'Invoice No.', issue: 'Issue date', due: 'Due date', billTo: 'Bill to', desc: 'Description', amount: 'Amount', total: 'Total', pay: 'Payment details', bank: 'Bank', method: 'Method', thanks: 'Thank you for your business.' },
} as const;

const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export function longDate(iso: string, lang: 'es' | 'pt' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[lang][m - 1];
  if (lang === 'en') return `${month} ${d}, ${y}`;
  return `${d} de ${month} de ${y}`;
}

/** Prefix for line amounts: the currency code, or a bare "$" when the invoice does not state it. */
function money(inv: FixtureInvoice, display: string): string {
  return inv.currency_code ? `${inv.currency_code} ${display}` : `$ ${display}`;
}

interface TextLine {
  text: string;
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  color?: [number, number, number];
  align?: 'left' | 'right';
}

/** Layout shared by the PDF and the PNG, in PDF points on a Letter page (612 x 792). */
function layout(inv: FixtureInvoice): TextLine[] {
  const t = L[inv.language];
  const out: TextLine[] = [];
  let y = 740;
  out.push({ text: inv.issuer.name, x: 50, y, size: 15, bold: true });
  out.push({ text: t.title, x: 562, y, size: 20, bold: true, align: 'right', color: [0.12, 0.29, 0.49] });
  y -= 18;
  out.push({ text: `${inv.issuer.tax_id_label}: ${inv.issuer.tax_id}`, x: 50, y, size: 10 });
  out.push({ text: `${t.no}: ${inv.number}`, x: 562, y, size: 11, bold: true, align: 'right' });
  y -= 14;
  out.push({ text: inv.issuer.address, x: 50, y, size: 9 });
  out.push({ text: `${t.issue}: ${longDate(inv.issue_date, inv.language)}`, x: 562, y, size: 9, align: 'right' });
  y -= 13;
  if (inv.issuer.email) out.push({ text: inv.issuer.email, x: 50, y, size: 9 });
  if (inv.due_date) out.push({ text: `${t.due}: ${longDate(inv.due_date, inv.language)}`, x: 562, y, size: 9, align: 'right' });
  y -= 34;
  out.push({ text: t.billTo.toUpperCase(), x: 50, y, size: 8, bold: true, color: [0.4, 0.4, 0.4] });
  y -= 14;
  out.push({ text: inv.bill_to.name, x: 50, y, size: 10, bold: true });
  y -= 13;
  out.push({ text: `${inv.bill_to.tax_id_label}: ${inv.bill_to.tax_id} · ${inv.bill_to.address}`, x: 50, y, size: 9 });
  y -= 34;
  out.push({ text: t.desc.toUpperCase(), x: 50, y, size: 8, bold: true, color: [0.4, 0.4, 0.4] });
  out.push({ text: t.amount.toUpperCase(), x: 562, y, size: 8, bold: true, align: 'right', color: [0.4, 0.4, 0.4] });
  y -= 18;
  for (const l of inv.lines) {
    out.push({ text: l.description, x: 50, y, size: 10 });
    out.push({ text: money(inv, l.amount_display), x: 562, y, size: 10, align: 'right' });
    y -= 16;
  }
  if (inv.tax_note) {
    out.push({ text: inv.tax_note, x: 50, y, size: 9, color: [0.35, 0.35, 0.35] });
    y -= 16;
  }
  y -= 8;
  out.push({ text: t.total.toUpperCase(), x: 380, y, size: 12, bold: true });
  out.push({ text: inv.total_display, x: 562, y, size: 12, bold: true, align: 'right' });
  y -= 44;
  out.push({ text: t.pay.toUpperCase(), x: 50, y, size: 8, bold: true, color: [0.4, 0.4, 0.4] });
  y -= 15;
  out.push({ text: `${t.method}: ${inv.payment.method.replace('_', '-')}`, x: 50, y, size: 10 });
  y -= 14;
  out.push({ text: `${inv.payment.label}: ${inv.payment.value}`, x: 50, y, size: 10, bold: true });
  y -= 14;
  if (inv.payment.bank) out.push({ text: `${t.bank}: ${inv.payment.bank}`, x: 50, y, size: 10 });
  out.push({ text: t.thanks, x: 50, y: 70, size: 9, color: [0.4, 0.4, 0.4] });
  return out;
}

function sanitizeWinAnsi(s: string): string {
  // Characters Helvetica's WinAnsi encoding cannot draw become close equivalents.
  return s.replace(/[‐-‒]/g, '-').replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, '?');
}

function draw(page: PDFPage, line: TextLine, regular: PDFFont, bold: PDFFont) {
  const font = line.bold ? bold : regular;
  const text = sanitizeWinAnsi(line.text);
  const width = font.widthOfTextAtSize(text, line.size);
  const x = line.align === 'right' ? line.x - width : line.x;
  const [r, g, b] = line.color ?? [0.08, 0.08, 0.1];
  page.drawText(text, { x, y: line.y, size: line.size, font, color: rgb(r, g, b) });
}

export async function renderPdf(inv: FixtureInvoice): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${inv.number}`);
  pdf.setCreationDate(new Date(`${inv.issue_date}T12:00:00Z`));
  pdf.setModificationDate(new Date(`${inv.issue_date}T12:00:00Z`));
  pdf.setProducer('PagoClaro fixtures');
  pdf.setCreator('PagoClaro fixtures');
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 50, y: 680, width: 512, height: 0.8, color: rgb(0.12, 0.29, 0.49) });
  for (const l of layout(inv)) draw(page, l, regular, bold);
  if (inv.hidden_text) {
    // White, small text in the footer: invisible on screen, present in the text layer.
    const words = sanitizeWinAnsi(inv.hidden_text);
    page.drawText(words, { x: 50, y: 40, size: 5, font: regular, color: rgb(1, 1, 1), maxWidth: 512, lineHeight: 6 });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPng(inv: FixtureInvoice): Buffer {
  const k = 1.6;
  const W = Math.round(612 * k);
  const H = Math.round(792 * k);
  const texts = layout(inv)
    .map((l) => {
      const x = l.x * k;
      const y = (792 - l.y) * k;
      const [r, g, b] = (l.color ?? [0.08, 0.08, 0.1]).map((c) => Math.round(c * 255));
      return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${l.size * k}" font-weight="${l.bold ? 700 : 400}" fill="rgb(${r},${g},${b})" text-anchor="${l.align === 'right' ? 'end' : 'start'}">${esc(l.text)}</text>`;
    })
    .join('\n');
  const note = inv.image_note
    ? `<g transform="translate(${W * 0.52},${H * 0.62}) rotate(-8)">
         <rect x="-18" y="-46" width="${W * 0.44}" height="120" fill="rgb(255,248,196)" stroke="rgb(214,190,90)" stroke-width="2"/>
         <text x="0" y="0" font-family="Segoe Script, Comic Sans MS, cursive" font-size="22" fill="rgb(176,32,32)">${wrapSvg(inv.image_note, 30)}</text>
       </g>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="100%" height="100%" fill="rgb(252,251,248)"/>
    <rect x="${50 * k}" y="${(792 - 680) * k}" width="${512 * k}" height="1.5" fill="rgb(31,74,125)"/>
    ${texts}
    ${note}
  </svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' }, background: 'rgb(252,251,248)' }).render().asPng();
  return Buffer.from(png);
}

function wrapSvg(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      lines.push(cur.trim());
      cur = w;
    } else cur += ` ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.map((l, i) => `<tspan x="0" dy="${i === 0 ? 0 : 28}">${esc(l)}</tspan>`).join('');
}

export async function renderEml(inv: FixtureInvoice): Promise<Buffer> {
  const e = inv.email!;
  const pdf = await renderPdf(inv);
  const boundary = `----=_pagoclaro_${inv.number.replace(/[^A-Za-z0-9]/g, '')}`;
  const b64 = pdf.toString('base64').replace(/(.{76})/g, '$1\r\n');
  const date = new Date(`${inv.issue_date}T15:04:05Z`).toUTCString();
  const lines = [
    `From: ${e.from}`,
    `To: ${e.to}`,
    `Subject: ${e.subject}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    e.body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${inv.number}.pdf"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${inv.number}.pdf"`,
    '',
    b64,
    `--${boundary}--`,
    '',
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8');
}

export async function renderInvoice(inv: FixtureInvoice): Promise<{ filename: string; bytes: Buffer }> {
  switch (inv.kind) {
    case 'pdf':
      return { filename: inv.file_name, bytes: await renderPdf(inv) };
    case 'image':
      return { filename: inv.file_name, bytes: renderPng(inv) };
    case 'email':
      return { filename: inv.file_name, bytes: await renderEml(inv) };
    case 'chat':
      return { filename: inv.file_name, bytes: Buffer.from(inv.chat_text ?? '', 'utf8') };
    case 'corrupt':
      return { filename: inv.file_name, bytes: Buffer.from(inv.corrupt_bytes ?? 'corrupt', 'utf8') };
  }
}
