// Fixed explanation templates, Spanish and English. Explanations are never written by a model:
// they say exactly what the deterministic rule saw (design §6, spec §9).
import type { RuleCode } from './types';

type Params = Record<string, string | number>;
type Template = { es: (p: Params) => string; en: (p: Params) => string };

const money = (n: unknown, cur: unknown) =>
  `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(cur)}`;
const usd = (n: unknown) => money(n, 'USD');

export const TEMPLATES: Record<RuleCode, { pass: Template; fail: Template }> = {
  HARD_CAP: {
    pass: { es: (p) => `${usd(p.usd)} no rebasa el tope duro por factura de ${usd(p.cap)}.`, en: (p) => `${usd(p.usd)} is within the hard cap per invoice of ${usd(p.cap)}.` },
    fail: { es: (p) => `${usd(p.usd)} rebasa el tope duro por factura de ${usd(p.cap)}: se frena.`, en: (p) => `${usd(p.usd)} exceeds the hard cap per invoice of ${usd(p.cap)}: held.` },
  },
  BUDGET_EXCEEDED: {
    pass: { es: (p) => `Presupuesto de ${p.period}: quedan ${usd(p.remaining)} y la factura usa ${usd(p.usd)}.`, en: (p) => `Budget for ${p.period}: ${usd(p.remaining)} left and the invoice uses ${usd(p.usd)}.` },
    fail: { es: (p) => `Presupuesto de ${p.period} insuficiente: quedan ${usd(p.remaining)} y la factura pide ${usd(p.usd)}.`, en: (p) => `Budget for ${p.period} is short: ${usd(p.remaining)} left and the invoice needs ${usd(p.usd)}.` },
  },
  DUPLICATE: {
    pass: { es: () => 'No hay otra factura con el mismo número de este proveedor pagada o pendiente.', en: () => 'No other invoice with this number from this vendor is paid or pending.' },
    fail: { es: (p) => `Cobro duplicado: la factura ${p.number} de este proveedor ya está ${p.status === 'PAID' ? 'pagada' : 'pendiente'} (${p.ref}).`, en: (p) => `Duplicate charge: invoice ${p.number} from this vendor is already ${p.status === 'PAID' ? 'paid' : 'pending'} (${p.ref}).` },
  },
  PO_BALANCE_EXCEEDED: {
    pass: { es: (p) => `La orden de compra tiene saldo de ${money(p.remaining, p.cur)} para ${money(p.total, p.cur)}.`, en: (p) => `The purchase order has ${money(p.remaining, p.cur)} left for ${money(p.total, p.cur)}.` },
    fail: { es: (p) => `La factura de ${money(p.total, p.cur)} rebasa el saldo de la orden de compra (${money(p.remaining, p.cur)}).`, en: (p) => `The ${money(p.total, p.cur)} invoice exceeds the purchase order balance (${money(p.remaining, p.cur)}).` },
  },
  NOT_APPROVABLE: {
    pass: { es: () => 'Todos los motivos del pendiente se pueden aprobar.', en: () => 'Every reason on the pending item can be approved.' },
    fail: { es: (p) => `La aprobación no puede levantar ${p.codes}: hay que corregir el catálogo o confirmar con el proveedor por otro canal y volver a enviar la factura.`, en: (p) => `Approval cannot lift ${p.codes}: fix the catalog or confirm with the vendor through another channel, then resubmit the invoice.` },
  },
  EXPIRED: {
    pass: { es: () => 'El pendiente sigue vigente.', en: () => 'The pending item is still open.' },
    fail: { es: (p) => `El pendiente venció a las ${p.hours} horas sin aprobación: queda frenado.`, en: (p) => `The pending item expired after ${p.hours} hours without approval: held.` },
  },
  READINGS_DISAGREE: {
    pass: { es: () => 'Las dos lecturas coinciden en identificación fiscal, número, moneda, total y cuenta.', en: () => 'Both readings agree on tax id, number, currency, total and account.' },
    fail: { es: (p) => `Las dos lecturas no coinciden en: ${p.fields}.`, en: (p) => `The two readings disagree on: ${p.fields}.` },
  },
  UNREADABLE: {
    pass: { es: () => 'El documento se pudo leer.', en: () => 'The document could be read.' },
    fail: { es: (p) => `El documento no se pudo leer: ${p.why}.`, en: (p) => `The document could not be read: ${p.why}.` },
  },
  READER_FAILED: {
    pass: { es: () => 'Los dos lectores respondieron.', en: () => 'Both readers answered.' },
    fail: { es: (p) => `Un lector falló también en su reintento (${p.reader}: ${p.error}).`, en: (p) => `A reader failed on its retry too (${p.reader}: ${p.error}).` },
  },
  SUSPICIOUS_TEXT: {
    pass: { es: () => 'El documento no trae frases que intenten dar órdenes.', en: () => 'The document carries no text that tries to give orders.' },
    fail: { es: () => 'El documento trae frases que intentan dar órdenes; se guardan como dato y no se obedecen.', en: () => 'The document carries text that tries to give orders; it is kept as data and not followed.' },
  },
  CURRENCY_AMBIGUOUS: {
    pass: { es: (p) => `La moneda está escrita en la factura: ${p.cur}.`, en: (p) => `The currency is written on the invoice: ${p.cur}.` },
    fail: { es: () => 'La factura no dice la moneda (solo un signo sin código).', en: () => 'The invoice does not state its currency (a bare sign, no code).' },
  },
  LINES_MISMATCH: {
    pass: { es: (p) => (p.none ? 'La factura no trae desglose de líneas.' : `Las líneas suman el total (${money(p.sum, p.cur)}).`), en: (p) => (p.none ? 'The invoice has no line breakdown.' : `The lines add up to the total (${money(p.sum, p.cur)}).`) },
    fail: { es: (p) => `Las líneas suman ${money(p.sum, p.cur)} y el total dice ${money(p.total, p.cur)}.`, en: (p) => `The lines add up to ${money(p.sum, p.cur)} but the total says ${money(p.total, p.cur)}.` },
  },
  NEW_BENEFICIARY: {
    pass: { es: (p) => `Proveedor del catálogo por identificación fiscal: ${p.name}.`, en: (p) => `Catalog vendor by tax id: ${p.name}.` },
    fail: { es: (p) => `La identificación fiscal ${p.taxid} no está en el catálogo de proveedores: beneficiario nuevo.`, en: (p) => `Tax id ${p.taxid} is not in the vendor catalog: new beneficiary.` },
  },
  VENDOR_INACTIVE: {
    pass: { es: () => 'El proveedor está activo.', en: () => 'The vendor is active.' },
    fail: { es: () => 'El proveedor está inactivo en el catálogo.', en: () => 'The vendor is inactive in the catalog.' },
  },
  ACCOUNT_MISMATCH: {
    pass: {
      es: (p) => (p.pending ? `La cuenta de pago (${p.read}) es la cuenta por confirmar del proveedor.` : `La cuenta de pago coincide con la registrada (${p.masked}).`),
      en: (p) => (p.pending ? `The payment account (${p.read}) is the vendor's account waiting for confirmation.` : `The payment account matches the registered one (${p.masked}).`),
    },
    fail: { es: (p) => `La cuenta de pago de la factura (${p.read}) no coincide con lo registrado (${p.masked}).`, en: (p) => `The invoice's payment account (${p.read}) does not match the registered one (${p.masked}).` },
  },
  ACCOUNT_PENDING: {
    pass: { es: () => 'La cuenta de pago no está esperando confirmación.', en: () => 'The payment account is not waiting for confirmation.' },
    fail: {
      es: (p) => `La cuenta de pago (${p.read}) se agregó o cambió en la lista de proveedores y nadie la ha confirmado: una persona distinta de quien la cambió debe confirmarla en Proveedores autorizados antes de pagarle.`,
      en: (p) => `The payment account (${p.read}) was added or changed in the vendor list and nobody has confirmed it: someone other than who changed it must confirm it under Authorized vendors before it is paid.`,
    },
  },
  NO_AGREEMENT: {
    pass: {
      es: (p) => (p.cap ? `Sin acuerdo, dentro del tope para proveedores autorizados: ${usd(p.usd)} de ${usd(p.per_invoice)} por factura y ${usd(p.month)} de ${usd(p.per_month)} este mes.` : `Acuerdo vigente: ${p.ref}.`),
      en: (p) => (p.cap ? `No agreement, within the cap for authorized vendors: ${usd(p.usd)} of ${usd(p.per_invoice)} per invoice and ${usd(p.month)} of ${usd(p.per_month)} this month.` : `Open agreement: ${p.ref}.`),
    },
    fail: { es: (p) => `El proveedor no tiene un acuerdo abierto en ${p.cur}.`, en: (p) => `The vendor has no open agreement in ${p.cur}.` },
  },
  AGREEMENT_MISMATCH: {
    pass: { es: (p) => (p.po ? 'Orden de compra: el monto se valida contra su saldo.' : `Cuadra con el contrato de ${money(p.agreed, p.cur)} (tolerancia ${p.tol} %).`), en: (p) => (p.po ? 'Purchase order: the amount is checked against its balance.' : `Matches the ${money(p.agreed, p.cur)} contract (tolerance ${p.tol}%).`) },
    fail: { es: (p) => `${money(p.total, p.cur)} no cuadra con el contrato de ${money(p.agreed, p.cur)} (tolerancia ${p.tol} %).`, en: (p) => `${money(p.total, p.cur)} does not match the ${money(p.agreed, p.cur)} contract (tolerance ${p.tol}%).` },
  },
  APPROVAL_THRESHOLD: {
    pass: { es: (p) => `${usd(p.usd)} está dentro del límite de autoaprobación de ${usd(p.limit)}.`, en: (p) => `${usd(p.usd)} is within the auto-approval limit of ${usd(p.limit)}.` },
    fail: { es: (p) => `${usd(p.usd)} supera el límite de autoaprobación de ${usd(p.limit)}: requiere una persona.`, en: (p) => `${usd(p.usd)} is above the auto-approval limit of ${usd(p.limit)}: needs a person.` },
  },
  POSSIBLE_DUPLICATE: {
    pass: { es: (p) => `Ningún cobro del mismo monto de este proveedor en ±${p.days} días.`, en: (p) => `No charge for the same amount from this vendor within ±${p.days} days.` },
    fail: { es: (p) => `Posible duplicado: ${p.refs} del mismo proveedor y el mismo monto en ±${p.days} días.`, en: (p) => `Possible duplicate: ${p.refs} from the same vendor for the same amount within ±${p.days} days.` },
  },
  SPLIT_SUSPECTED: {
    pass: { es: (p) => `Pagado al proveedor en ${p.days} días más esta factura: ${usd(p.sum)}.`, en: (p) => `Paid to the vendor in ${p.days} days plus this invoice: ${usd(p.sum)}.` },
    fail: { es: (p) => `Posible cobro partido: ${usd(p.prev)} pagados en ${p.days} días más esta factura suman ${usd(p.sum)}, arriba del límite de ${usd(p.limit)}.`, en: (p) => `Possible split charge: ${usd(p.prev)} paid in ${p.days} days plus this invoice add up to ${usd(p.sum)}, above the ${usd(p.limit)} limit.` },
  },
  NO_FX_RATE: {
    pass: { es: (p) => `Tasa ${p.rate} USD por ${p.cur} del ${p.date} (${p.source}).`, en: (p) => `Rate ${p.rate} USD per ${p.cur} as of ${p.date} (${p.source}).` },
    fail: { es: (p) => `No hay tipo de cambio para ${p.cur} en la tabla: no se puede validar el monto en USD.`, en: (p) => `No exchange rate for ${p.cur} in the table: the USD amount cannot be checked.` },
  },
  STALE_DATE: {
    pass: { es: (p) => `Fecha de emisión ${p.date} dentro del rango.`, en: (p) => `Issue date ${p.date} within range.` },
    fail: { es: (p) => `Fecha de emisión ${p.date} fuera de rango (más de ${p.stale} días atrás o más de ${p.future} días adelante).`, en: (p) => `Issue date ${p.date} out of range (more than ${p.stale} days back or more than ${p.future} days ahead).` },
  },
};

export function describe(code: RuleCode, result: 'PASS' | 'FAIL', params: Params): { message_es: string; message_en: string } {
  const t = TEMPLATES[code][result === 'PASS' ? 'pass' : 'fail'];
  return { message_es: t.es(params), message_en: t.en(params) };
}
