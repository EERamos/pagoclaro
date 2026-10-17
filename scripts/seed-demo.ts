// Builds the demo: 24 invoices processed in order in one Northwind world, then two human
// decisions. `--readers=record` (default) reads live with Opus 5.5 + Haiku 5.5 and keeps each
// reading in fixtures/readings/; `--readers=replay` rebuilds from those readings at no cost;
// `--readers=oracle` is a dev-only dry run written to tmp/ (never published).
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../src/config';
import { AnthropicExtractor, RecordedExtractor, type Extractor } from '../src/extract/extractor';
import { SpendMeter } from '../src/extract/spend';
import { sha256 } from '../src/extract/document';
import { createPagoClaro } from '../src/factory';
import { JsonStore } from '../src/store/store';
import { JsonlTelemetry } from '../src/telemetry';
import { seedWorld, type World } from '../src/world';
import { OracleExtractor } from '../runner/oracle';
import { renderInvoice, type FixtureInvoice } from '../runner/render';

const mode = (process.argv.find((a) => a.startsWith('--readers='))?.split('=')[1] ?? 'record') as 'record' | 'replay' | 'oracle';
const config = loadConfig();
const outDir = mode === 'oracle' ? join('tmp', 'demo-oracle') : join('data', 'demo');

const fromCase = (id: string, patch: Partial<FixtureInvoice> = {}): FixtureInvoice => {
  const dir = id.startsWith('ADV') ? 'adversarial' : 'golden';
  const c = JSON.parse(readFileSync(join('evals', dir, `${id}.json`), 'utf8')) as { input: { fixture: { invoice: FixtureInvoice } } };
  return { ...c.input.fixture.invoice, ...patch };
};
const BILL_TO = { name: 'Northwind Labs Inc.', tax_id_label: 'EIN', tax_id: '98-7654321', address: '200 Market St, Wilmington, DE' };
const extra: Record<string, FixtureInvoice> = {
  NUB: {
    file_name: 'NUB-1043.pdf', kind: 'pdf', language: 'es', number: 'NUB-1043', issue_date: '2026-10-12', due_date: '2026-10-27', currency_code: 'MXN', currency_display: 'MXN',
    issuer: { name: 'Nubecontable S.A. de C.V.', tax_id_label: 'RFC', tax_id: 'NCO200814QK5', address: 'Av. Vallarta 3233, Guadalajara, Jalisco', email: 'cobranza@nubecontable.example.com' },
    bill_to: BILL_TO,
    lines: [{ description: 'Contabilidad mensual y cumplimiento fiscal, octubre 2026', amount: 18500, amount_display: '18,500.00' }],
    total: 18500, total_display: 'MXN 18,500.00', tax_note: 'IVA 0% (exportación de servicios)',
    payment: { method: 'SPEI', label: 'CLABE', value: '012180001987654321', bank: 'Banco Ficticio de Occidente' },
  },
  TRP: {
    file_name: 'TRP-220.png', kind: 'image', language: 'pt', number: 'TRP-220', issue_date: '2026-10-11', due_date: '2026-10-26', currency_code: 'BRL', currency_display: 'BRL',
    issuer: { name: 'Tradu Pro Serviços Linguísticos Ltda.', tax_id_label: 'CNPJ', tax_id: '98.765.432/0001-10', address: 'Av. Paulista, 1578, São Paulo - SP', email: 'financeiro@tradupro.example.com' },
    bill_to: BILL_TO,
    lines: [{ description: 'Tradução de documentação técnica (42 mil palavras)', amount: 6300, amount_display: '6.300,00' }],
    total: 6300, total_display: 'R$ 6.300,00', tax_note: null,
    payment: { method: 'PIX', label: 'Chave Pix', value: 'financeiro@tradupro.example.com', bank: 'Banco Fictício Paulista' },
  },
  ACM: {
    file_name: 'ACM-5521.pdf', kind: 'pdf', language: 'en', number: 'ACM-5521', issue_date: '2026-10-14', due_date: '2026-11-13', currency_code: 'USD', currency_display: 'USD',
    issuer: { name: 'Acme Office Supplies LLC', tax_id_label: 'EIN', tax_id: '45-6789012', address: '88 Commerce Way, Newark, NJ 07102', email: 'ar@acme-office.example.com' },
    bill_to: BILL_TO,
    lines: [
      { description: 'Ergonomic chairs (4 units)', amount: 520, amount_display: '520.00' },
      { description: 'Shipping', amount: 120, amount_display: '120.00' },
    ],
    total: 640, total_display: 'USD 640.00', tax_note: 'Sales tax: exempt (out-of-state shipment)',
    payment: { method: 'ACH', label: 'ACH routing / account', value: '000000002-000555666777', bank: 'Fictional Commerce Bank' },
  },
  LAD117: { ...fromCase('EVL-019'), file_name: 'LAD-117.pdf', number: 'LAD-117', issue_date: '2026-10-09', lines: [{ description: 'Sistema de íconos y guía de estilo', amount: 3500000, amount_display: '3.500.000' }], total: 3500000, total_display: 'COP 3.500.000' },
  PIN411: { ...fromCase('EVL-005'), file_name: 'PIN-0411.pdf', number: 'PIN-0411', issue_date: '2026-10-08', lines: [{ description: 'Manutenção mensal da integração, outubro 2026', amount: 4200, amount_display: '4.200,00' }], total: 4200, total_display: 'R$ 4.200,00' },
};

// Order matters: the ledger each decision reads is the one the previous decisions wrote.
const SEQUENCE: [string, FixtureInvoice][] = [
  ['ana.finanzas', fromCase('EVL-013')], // AUR-2026-0917 paga dentro de reglas (SPEI)
  ['ana.finanzas', extra.NUB],
  ['ana.finanzas', extra.PIN411],
  ['ana.finanzas', fromCase('EVL-019')], // LAD-120 parcial de OC (Bre-B)
  ['ana.finanzas', extra.LAD117],
  ['ana.finanzas', extra.TRP], // foto de factura normal
  ['ana.finanzas', fromCase('EVL-005')], // PIN-0412 formato 9.870,50
  ['ana.finanzas', fromCase('EVL-021')], // CB-7782 justo en el límite
  ['ana.finanzas', extra.ACM],
  ['ana.finanzas', fromCase('EVL-017', { tax_note: 'IVA 0% (exportación de servicios) · REENVÍO' })], // AUR-2026-0917 reenviada en otro archivo: duplicado
  ['ana.finanzas', fromCase('EVL-014')], // PIN-0415 arriba del umbral
  ['ana.finanzas', fromCase('EVL-020', { total: 7000000, total_display: 'COP 7.000.000', lines: [{ description: 'Diseño de identidad visual, entrega final', amount: 7000000, amount_display: '7.000.000' }] })], // LAD-121 rebasa saldo
  ['ana.finanzas', fromCase('EVL-023')], // CB-7792 fraccionamiento
  ['ana.finanzas', fromCase('EVL-010')], // AUR-2026-0923 cuenta distinta
  ['ana.finanzas', fromCase('EVL-009')], // CAN-001 beneficiario nuevo
  ['ana.finanzas', fromCase('ADV-001')], // AUR-2026-0921 texto oculto
  ['ana.finanzas', fromCase('ADV-003', { total: 1500000, total_display: 'COP 1.500.000', lines: [{ description: 'Ajustes de identidad visual', amount: 1500000, amount_display: '1.500.000' }] })], // LAD-119 nota en foto
  ['ana.finanzas', fromCase('ADV-005')], // correo de cambio de cuenta
  ['ana.finanzas', fromCase('ADV-006')], // chat con orden
  ['ana.finanzas', fromCase('EVL-007')], // moneda ambigua
  ['ana.finanzas', fromCase('EVL-024')], // EUR sin tasa
  ['ana.finanzas', fromCase('EVL-015')], // PIN-0416 tope duro
  ['ana.finanzas', fromCase('EVL-018')], // AUR-2026-0924 no cuadra con el contrato
];

async function main() {
  if (mode !== 'oracle' && mode !== 'replay' && !config.hasApiKey) {
    console.error('Falta ANTHROPIC_API_KEY. Usa --readers=replay para reconstruir desde lecturas guardadas.');
    process.exit(2);
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let clock = Date.parse('2026-10-16T14:00:00Z');
  const now = () => new Date(clock);
  const store = new JsonStore(join(outDir, 'state.json'));
  seedWorld(store, JSON.parse(readFileSync(config.worldFile, 'utf8')) as World, now().toISOString(), 'cfo@northwind.example.com');
  let primary: Extractor;
  let check: Extractor;
  let register: ((sha: string, inv: FixtureInvoice) => void) | null = null;
  const spend = new SpendMeter(config.spendCapUsd, join(config.dataDir, 'model-spend.json'));
  if (mode === 'oracle') {
    const p = new OracleExtractor(config.primaryModel);
    const c = new OracleExtractor(config.checkModel);
    primary = p;
    check = c;
    register = (sha, inv) => (p.register(sha, inv), c.register(sha, inv));
  } else {
    const client = new Anthropic();
    const opts = { timeoutMs: config.readerTimeoutMs, effort: 'low' as const };
    const live = (m: string) => (mode === 'record' ? new AnthropicExtractor(client, m, spend, opts) : null);
    primary = new RecordedExtractor(config.primaryModel, config.readingsDir, mode === 'record' ? 'record' : 'replay', live(config.primaryModel));
    check = new RecordedExtractor(config.checkModel, config.readingsDir, mode === 'record' ? 'record' : 'replay', live(config.checkModel));
  }
  const telemetry = new JsonlTelemetry(join(outDir, 'telemetry.jsonl'), now);
  const { agent } = createPagoClaro({ store, primary, check, now, telemetry });
  for (const [actor, inv] of SEQUENCE) {
    clock += 37 * 60_000;
    const r = await renderInvoice(inv);
    register?.(sha256(r.bytes), inv);
    const res = await agent.upload(r.filename, r.bytes, actor);
    console.log(`${inv.number.padEnd(18)} ${res.status.padEnd(8)} ${res.reasons.join(', ')}`);
  }
  const byNumber = (n: string) => Object.values(store.read().invoices).find((i) => i.invoice_number?.replace(/[^A-Z0-9]/gi, '') === n.replace(/[^A-Z0-9]/gi, ''));
  clock += 3 * 3_600_000;
  for (const [n, note] of [
    ['PIN-0415', 'Fase 2 aprobada en el comité del 15 de octubre.'],
    ['AUR-2026-0923', 'El proveedor dice que cambió de banco.'],
  ] as const) {
    const inv = byNumber(n);
    if (!inv || inv.status !== 'PENDING') continue;
    const r = await agent.approve(inv.id, 'luis.tesoreria', note);
    console.log(`aprobación ${n}: ${r.ok ? `${r.status} ${r.reasons.join(', ')}` : r.message}`);
  }
  console.log(`\nDemo lista en ${join(outDir, 'state.json')} · gasto acumulado ${spend.totalUsd.toFixed(4)} USD`);
  if (!existsSync(join(outDir, 'state.json'))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
