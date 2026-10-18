// Video kit: `npm run video:prep`. Writes tmp/video/PIN-0418.pdf, a new Pinheiro invoice inside every
// rule (8,450.00 BRL, about 1,521 USD, paid by Pix against a purchase order with room left), to
// upload live on camera. The demo state for the recording comes from `npm run seed --
// --readers=replay --out=data/video --no-approvals`, which this script's npm entry runs first at no
// cost. Pinheiro's paid invoices of the last 7 days plus this one stay under the 5,000 USD that is
// paid without review, as long as PIN-0415 is approved after this upload, as the script says.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

export const PIN_0418: FixtureInvoice = {
  file_name: 'PIN-0418.pdf',
  kind: 'pdf',
  language: 'pt',
  number: 'PIN-0418',
  issue_date: '2026-10-17',
  due_date: '2026-11-16',
  currency_code: 'BRL',
  currency_display: 'BRL',
  issuer: { name: 'Pinheiro Tecnologia Ltda.', tax_id_label: 'CNPJ', tax_id: '12.345.678/0001-90', address: 'Rua Funchal, 418, Vila Olímpia, São Paulo - SP', email: 'financeiro@pinheiro.example.com' },
  bill_to: { name: 'Northwind Labs Inc.', tax_id_label: 'EIN', tax_id: '98-7654321', address: '200 Market St, Wilmington, DE' },
  lines: [
    { description: 'Suporte e manutenção da plataforma, outubro 2026', amount: 6200, amount_display: '6.200,00' },
    { description: 'Horas adicionais de integração (15 h)', amount: 2250, amount_display: '2.250,00' },
  ],
  total: 8450,
  total_display: 'R$ 8.450,00',
  tax_note: null,
  payment: { method: 'PIX', label: 'Chave Pix', value: 'pix@pinheiro.example.com', bank: 'Banco Fictício Paulista' },
};

const out = join('tmp', 'video');
mkdirSync(out, { recursive: true });
const r = await renderInvoice(PIN_0418);
writeFileSync(join(out, r.filename), r.bytes);
console.log(`Factura para subir en el video: ${join(out, r.filename)} (${r.bytes.length} bytes)`);
console.log('Estado para grabar: data/video/state.json (24 facturas; PIN-0415, AUR-2026-0923 y TRP-221 pendientes; la llave Pix nueva de Tradu Pro por confirmar)');
