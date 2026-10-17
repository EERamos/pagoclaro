// Video kit: `npm run video:prep`. Writes tmp/video/ACM-5530.pdf, a new Acme invoice inside every
// rule (1,250.00 USD against a purchase order with 5,360.00 USD left), to upload live on camera.
// The demo state for the recording comes from `npm run seed -- --readers=replay --out=data/video
// --no-approvals`, which this script's npm entry runs first at no cost.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

export const ACM_5530: FixtureInvoice = {
  file_name: 'ACM-5530.pdf',
  kind: 'pdf',
  language: 'en',
  number: 'ACM-5530',
  issue_date: '2026-10-17',
  due_date: '2026-11-16',
  currency_code: 'USD',
  currency_display: 'USD',
  issuer: { name: 'Acme Office Supplies LLC', tax_id_label: 'EIN', tax_id: '45-6789012', address: '88 Commerce Way, Newark, NJ 07102', email: 'ar@acme-office.example.com' },
  bill_to: { name: 'Northwind Labs Inc.', tax_id_label: 'EIN', tax_id: '98-7654321', address: '200 Market St, Wilmington, DE' },
  lines: [
    { description: 'Standing desks (2 units)', amount: 1150, amount_display: '1,150.00' },
    { description: 'Shipping', amount: 100, amount_display: '100.00' },
  ],
  total: 1250,
  total_display: 'USD 1,250.00',
  tax_note: 'Sales tax: exempt (out-of-state shipment)',
  payment: { method: 'ACH', label: 'ACH routing / account', value: '000000002-000555666777', bank: 'Fictional Commerce Bank' },
};

const out = join('tmp', 'video');
mkdirSync(out, { recursive: true });
const r = await renderInvoice(ACM_5530);
writeFileSync(join(out, r.filename), r.bytes);
console.log(`Factura para subir en el video: ${join(out, r.filename)} (${r.bytes.length} bytes)`);
console.log('Estado para grabar: data/video/state.json (23 facturas, PIN-0415 y AUR-2026-0923 pendientes)');
