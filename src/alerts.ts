// The runbook's alarms, computed from the store and the spend meter so they hold in every mode:
// /health and /api/summary carry them, the dashboard shows them, and the server prints one
// "[ALERTA]" line when each one first fires (ship report v1, finding on silent alarms).
import type { State } from './store/store';

export type AlertCode = 'PAYMENT_OUT_OF_RULES' | 'AUDIT_CHAIN_BROKEN' | 'MODEL_SPEND_HIGH' | 'READERS_FAILING';

export interface Alert {
  code: AlertCode;
  value: number;
  threshold: number;
  message: string;
}

/** Share of the spend cap that fires MODEL_SPEND_HIGH (runbook: 80 %, 40 of 50 USD). */
export const SPEND_ALERT_SHARE = 0.8;
/** Newest invoices in a row ending in READER_FAILED that fire READERS_FAILING (runbook: 3). */
export const READER_FAILED_STREAK = 3;

export interface AlertInputs {
  payments_out_of_rules: number;
  audit_chain_ok: boolean;
  model_spend_usd: number;
  model_spend_cap_usd: number;
}

function readerFailedStreak(s: State): number {
  const newest = Object.values(s.invoices)
    .filter((i) => i.status !== 'PROCESSING')
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
  let n = 0;
  for (const i of newest) {
    if (!i.reasons.includes('READER_FAILED')) break;
    n++;
  }
  return n;
}

export function activeAlerts(s: State, m: AlertInputs): Alert[] {
  const out: Alert[] = [];
  if (m.payments_out_of_rules > 0) {
    out.push({ code: 'PAYMENT_OUT_OF_RULES', value: m.payments_out_of_rules, threshold: 1, message: 'hay instrucciones de pago sin una evaluación PAY: detén el agente y anúlalas' });
  }
  if (!m.audit_chain_ok) {
    out.push({ code: 'AUDIT_CHAIN_BROKEN', value: 1, threshold: 1, message: 'la cadena del registro está rota: detén las escrituras y compara con el respaldo' });
  }
  const spendLimit = Math.round(m.model_spend_cap_usd * SPEND_ALERT_SHARE * 100) / 100;
  if (m.model_spend_cap_usd > 0 && m.model_spend_usd >= spendLimit) {
    out.push({ code: 'MODEL_SPEND_HIGH', value: m.model_spend_usd, threshold: spendLimit, message: `el gasto en modelos llegó a ${m.model_spend_usd.toFixed(2)} USD de ${m.model_spend_cap_usd} USD` });
  }
  const streak = readerFailedStreak(s);
  if (streak >= READER_FAILED_STREAK) {
    out.push({ code: 'READERS_FAILING', value: streak, threshold: READER_FAILED_STREAK, message: `${streak} facturas seguidas terminaron con READER_FAILED: revisa la llave y status.anthropic.com` });
  }
  return out;
}

/** Prints each alarm once when it starts firing; a cleared alarm prints again if it returns. */
export function alertNotifier(print: (line: string) => void = (line) => console.warn(line)): (alerts: Alert[]) => void {
  let firing = new Set<AlertCode>();
  return (alerts) => {
    for (const a of alerts) if (!firing.has(a.code)) print(`[ALERTA] ${a.code}: ${a.message}`);
    firing = new Set(alerts.map((a) => a.code));
  };
}
