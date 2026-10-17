/* PagoClaro dashboard. Vanilla JS, no build. Live mode talks to the API; static mode (GitHub
   Pages) reads demo-data.json, a snapshot of a real run, and disables writes. */
(() => {
  'use strict';

  const T = {
    es: {
      skip: 'Saltar al contenido', tagline: 'Cuentas por pagar con reglas claras', actingAs: 'Actúa como', accessCode: 'Código',
      tabInbox: 'Bandeja', tabRules: 'Reglas', tabCatalog: 'Catálogo', tabAudit: 'Registro', tabHow: 'Cómo decide',
      inbox: 'Facturas', upload: 'Subir factura', uploadHint: 'PDF, foto, correo .eml o chat .txt · hasta 10 MB',
      colInvoice: 'Factura', colAmount: 'Monto', colStatus: 'Decisión', pickOne: 'Elige una factura para ver por qué se decidió así.',
      all: 'Todas', PAID: 'Pagada', HELD: 'Frenada', PENDING: 'Pendiente', REJECTED: 'Rechazada', EXPIRED: 'Vencida', VOIDED: 'Anulada', ERROR: 'Sin decisión', PROCESSING: 'Procesando',
      fall: 'Todas', fPAID: 'Pagadas', fHELD: 'Frenadas', fPENDING: 'Pendientes', fREJECTED: 'Rechazadas', fEXPIRED: 'Vencidas', fVOIDED: 'Anuladas', fERROR: 'Sin decisión', emptyFilter: 'No hay facturas en este filtro.', na: 'n/d',
      reading: 'Leyendo con Opus 5.5 y Haiku 5.5…', approving: 'Reevaluando con las reglas vigentes…', approvedToast: 'Aprobación registrada', rejectedToast: 'Rechazo registrado', voidedToast: 'Instrucción anulada', savedToast: 'Reglas guardadas como nueva versión',
      vPAIDby: 'Pagada con la aprobación de {who}: la reevaluación con las reglas vigentes lo permitió.',
      kProcessed: 'Procesadas', kPaid: 'Pagadas', kHeld: 'Frenadas', kPending: 'Pendientes', kAutonomy: 'Resueltas sin persona', kOut: 'Pagos fuera de reglas', kChain: 'Registro', kSpend: 'Gasto en modelos',
      chainOk: 'íntegro', chainBad: 'roto', of: 'de',
      alarm: 'Alarma', aPAYMENT_OUT_OF_RULES: 'hay instrucciones de pago sin una evaluación PAY: detén el agente y anúlalas.', aAUDIT_CHAIN_BROKEN: 'la cadena del registro está rota: detén las escrituras y compara con el respaldo.', aMODEL_SPEND_HIGH: 'el gasto en modelos llegó al 80 % del tope.', aREADERS_FAILING: 'varias facturas seguidas no se pudieron leer: revisa la llave y status.anthropic.com.',
      vPAID: 'Pagada dentro de las reglas: se emitió una instrucción de pago simulada.', vHELD: 'Frenada: una regla dura lo impide.', vPENDING: 'Escalada: necesita a una persona.', vREJECTED: 'Rechazada por una persona.', vEXPIRED: 'Venció sin aprobación y quedó frenada.', vVOIDED: 'Pagada y después anulada por una persona.', vERROR: 'Sin decisión final: se puede volver a procesar.',
      why: 'Por qué', readings: 'Las dos lecturas', field: 'Campo', primary: 'Principal', check: 'Verificación', orders: 'Texto con órdenes, tratado como dato', payment: 'Instrucción de pago', simulated: 'SIMULADA · no mueve dinero', rail: 'Riel', amount: 'Monto', usd: 'En USD', rate: 'Tasa', beneficiary: 'Beneficiario', account: 'Cuenta', provenance: 'Procedencia', audit: 'Registro de esta factura', approveTitle: 'Decisión humana', note: 'Nota (se guarda como texto)', approve: 'Aprobar', reject: 'Rechazar', voidPay: 'Anular instrucción', chooseReading: 'Lectura que vale', reason: 'Motivo',
      approvable: 'Una aprobación puede levantar: umbral, posible duplicado, fraccionamiento, acuerdo, beneficiario nuevo y fecha. Nunca: cuenta distinta, texto con órdenes, moneda ambigua o sin tasa, líneas que no suman ni archivos ilegibles. Las reglas de frenar siguen valiendo.',
      rulesTitle: 'Reglas vigentes', save: 'Guardar como nueva versión', whatIf: 'Simular con estas reglas', versions: 'Versiones', whatIfRes: 'Simulación', changed: 'cambiarían', compared: 'decisiones comparadas',
      vendors: 'Proveedores', agreements: 'Acuerdos', fx: 'Tipos de cambio', verify: 'Verificar la cadena', entries: 'entradas',
      staticBanner: 'Demo estática: es una foto de una corrida real con los lectores Opus 5.5 y Haiku 5.5. Para subir facturas, aprobar o cambiar reglas, corre PagoClaro en local (npm start).',
      writesOff: 'Esta instancia no acepta escrituras.', needCode: 'Escribe el código de acceso arriba.', uploaded: 'Factura procesada', failed: 'No se pudo',
      rule_auto: 'Autoaprobación hasta (USD)', rule_cap: 'Tope duro por factura (USD)', rule_budget: 'Presupuesto mensual (USD)', rule_tol: 'Tolerancia contra contrato (%)', rule_dup: 'Ventana de posible duplicado (días)', rule_split: 'Ventana de fraccionamiento (días)', rule_stale: 'Antigüedad máxima (días)', rule_future: 'Fecha futura tolerada (días)', rule_timeout: 'Vence un pendiente (horas)',
    },
    en: {
      skip: 'Skip to content', tagline: 'Accounts payable with clear rules', actingAs: 'Acting as', accessCode: 'Code',
      tabInbox: 'Inbox', tabRules: 'Rules', tabCatalog: 'Catalog', tabAudit: 'Audit log', tabHow: 'How it decides',
      inbox: 'Invoices', upload: 'Upload invoice', uploadHint: 'PDF, photo, .eml email or .txt chat · up to 10 MB',
      colInvoice: 'Invoice', colAmount: 'Amount', colStatus: 'Decision', pickOne: 'Pick an invoice to see why it was decided that way.',
      all: 'All', PAID: 'Paid', HELD: 'Held', PENDING: 'Pending', REJECTED: 'Rejected', EXPIRED: 'Expired', VOIDED: 'Voided', ERROR: 'No decision', PROCESSING: 'Processing',
      fall: 'All', fPAID: 'Paid', fHELD: 'Held', fPENDING: 'Pending', fREJECTED: 'Rejected', fEXPIRED: 'Expired', fVOIDED: 'Voided', fERROR: 'No decision', emptyFilter: 'No invoices in this filter.', na: 'n/a',
      reading: 'Reading with Opus 5.5 and Haiku 5.5…', approving: 'Re-running the current rules…', approvedToast: 'Approval recorded', rejectedToast: 'Rejection recorded', voidedToast: 'Instruction voided', savedToast: 'Rules saved as a new version',
      vPAIDby: 'Paid with the approval of {who}: re-running the current rules allowed it.',
      kProcessed: 'Processed', kPaid: 'Paid', kHeld: 'Held', kPending: 'Pending', kAutonomy: 'Decided without a person', kOut: 'Payments outside rules', kChain: 'Audit log', kSpend: 'Model spend',
      chainOk: 'intact', chainBad: 'broken', of: 'of',
      alarm: 'Alarm', aPAYMENT_OUT_OF_RULES: 'there are payment instructions without a PAY evaluation: stop the agent and void them.', aAUDIT_CHAIN_BROKEN: 'the audit chain is broken: stop writes and compare with the backup.', aMODEL_SPEND_HIGH: 'model spend reached 80% of the cap.', aREADERS_FAILING: 'several invoices in a row could not be read: check the key and status.anthropic.com.',
      vPAID: 'Paid within the rules: a simulated payment instruction was issued.', vHELD: 'Held: a hard rule blocks it.', vPENDING: 'Escalated: needs a person.', vREJECTED: 'Rejected by a person.', vEXPIRED: 'Expired without approval and was held.', vVOIDED: 'Paid, then voided by a person.', vERROR: 'No final decision: it can be processed again.',
      why: 'Why', readings: 'The two readings', field: 'Field', primary: 'Primary', check: 'Check', orders: 'Text giving orders, kept as data', payment: 'Payment instruction', simulated: 'SIMULATED · moves no money', rail: 'Rail', amount: 'Amount', usd: 'In USD', rate: 'Rate', beneficiary: 'Beneficiary', account: 'Account', provenance: 'Provenance', audit: 'Audit log for this invoice', approveTitle: 'Human decision', note: 'Note (kept as text)', approve: 'Approve', reject: 'Reject', voidPay: 'Void instruction', chooseReading: 'Reading that holds', reason: 'Reason',
      approvable: 'An approval can lift: threshold, possible duplicate, split charge, agreement, new beneficiary and date. Never: a different account, text giving orders, an ambiguous or unrated currency, lines that do not add up or unreadable files. Hold rules still apply.',
      rulesTitle: 'Current rules', save: 'Save as a new version', whatIf: 'Simulate with these rules', versions: 'Versions', whatIfRes: 'Simulation', changed: 'would change', compared: 'decisions compared',
      vendors: 'Vendors', agreements: 'Agreements', fx: 'Exchange rates', verify: 'Verify the chain', entries: 'entries',
      staticBanner: 'Static demo: a snapshot of a real run with the Opus 5.5 and Haiku 5.5 readers. To upload invoices, approve or change rules, run PagoClaro locally (npm start).',
      writesOff: 'This instance does not accept writes.', needCode: 'Type the access code above.', uploaded: 'Invoice processed', failed: 'Could not',
      rule_auto: 'Auto-approve up to (USD)', rule_cap: 'Hard cap per invoice (USD)', rule_budget: 'Monthly budget (USD)', rule_tol: 'Contract tolerance (%)', rule_dup: 'Possible duplicate window (days)', rule_split: 'Split window (days)', rule_stale: 'Max age (days)', rule_future: 'Future date tolerance (days)', rule_timeout: 'Pending expires after (hours)',
    },
  };
  const RULE_FIELDS = [
    ['auto_approve_up_to_usd', 'rule_auto'], ['hard_cap_per_invoice_usd', 'rule_cap'], ['monthly_budget_usd', 'rule_budget'], ['contract_tolerance_pct', 'rule_tol'],
    ['possible_duplicate_window_days', 'rule_dup'], ['split_window_days', 'rule_split'], ['stale_after_days', 'rule_stale'], ['future_tolerance_days', 'rule_future'], ['pending_timeout_hours', 'rule_timeout'],
  ];

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const S = { lang: store.get('pc.lang', 'es'), mode: 'live', summary: null, details: {}, selected: null, filter: 'all', tab: 'inbox', staticData: null };
  const t = (k) => (T[S.lang] && T[S.lang][k]) || T.es[k] || k;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n, cur) => (n === null || n === undefined ? t('na') : `${Number(n).toLocaleString(S.lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: cur === 'COP' ? 0 : 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`);
  const when = (iso) => (iso ? new Date(iso).toLocaleString(S.lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : t('na'));
  /** Marks a button busy (spinner, disabled) while an async action runs. */
  async function busy(btn, label, fn) {
    if (!btn) return fn();
    const prev = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    if (label) btn.textContent = label;
    try { return await fn(); } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = prev; }
  }

  function toast(msg, bad) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast${bad ? ' bad' : ''}`;
    el.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => (el.hidden = true), 4200);
  }

  // ---------------- data ----------------
  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || `HTTP ${res.status}`), { body, status: res.status });
    return body;
  }
  async function loadSummary() {
    if (S.mode === 'static') return S.staticData.summary;
    return api('/api/summary');
  }
  async function loadDetail(id) {
    if (S.mode === 'static') return S.staticData.details[id];
    return api(`/api/invoices/${id}`);
  }
  function writeHeaders() {
    return { 'x-access-code': $('#accessCode').value.trim() };
  }
  function canWrite() {
    if (S.mode === 'static' || !S.summary?.writes) { toast(t('writesOff'), true); return false; }
    if (!$('#accessCode').value.trim()) { toast(t('needCode'), true); return false; }
    return true;
  }

  // ---------------- render: shell ----------------
  function applyI18n() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    $('#langBtn').textContent = S.lang === 'es' ? 'EN' : 'ES';
    $('#langBtn').setAttribute('aria-label', S.lang === 'es' ? 'Switch to English' : 'Cambiar a español');
    const b = $('#staticBanner');
    b.hidden = S.mode !== 'static';
    b.textContent = t('staticBanner');
  }

  function renderKpis() {
    const m = S.summary.metrics;
    const k = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    $('#kpis').innerHTML = [
      k(t('kProcessed'), m.processed),
      k(t('kPaid'), m.paid, `${fmt(m.usd_paid, 'USD')}`),
      k(t('kHeld'), m.held + m.expired + m.rejected),
      k(t('kPending'), m.pending),
      k(t('kAutonomy'), `${m.autonomy_pct}%`, `${m.decided_by_agent} ${t('of')} ${m.processed}`),
      k(t('kOut'), m.payments_out_of_rules, '', m.payments_out_of_rules === 0 ? 'good' : 'bad'),
      k(t('kChain'), m.audit_chain_ok ? '✓' : '×', `${m.audit_entries} ${t('entries')} · ${m.audit_chain_ok ? t('chainOk') : t('chainBad')}`, m.audit_chain_ok ? 'good' : 'bad'),
      k(t('kSpend'), `$${Number(m.model_spend_usd).toFixed(2)}`, `${t('of')} $${m.model_spend_cap_usd}`),
    ].join('');
    const alerts = m.alerts || [];
    const ab = $('#alertBanner');
    ab.hidden = alerts.length === 0;
    ab.innerHTML = alerts.map((a) => `<div><strong>${esc(t('alarm'))} · ${esc(a.code)}</strong> ${esc(t(`a${a.code}`))}</div>`).join('');
    const mp = $('#modePill');
    mp.textContent = S.mode === 'static' ? 'DEMO' : `API · ${S.summary.mode}`;
    mp.className = `pill${S.mode === 'static' ? '' : ' live'}`;
  }

  const ORDER = ['all', 'PAID', 'PENDING', 'HELD', 'REJECTED', 'EXPIRED', 'VOIDED', 'ERROR'];
  function renderFilters() {
    const inv = S.summary.invoices;
    const count = (f) => (f === 'all' ? inv.length : inv.filter((i) => i.status === f).length);
    $('#filters').innerHTML = ORDER.filter((f) => f === 'all' || count(f) > 0)
      .map((f) => `<button type="button" class="chip" data-f="${f}" aria-pressed="${S.filter === f}">${esc(t(f === 'all' ? 'fall' : `f${f}`))}<span class="n">${count(f)}</span></button>`)
      .join('');
  }

  function renderRows() {
    const inv = S.summary.invoices.filter((i) => S.filter === 'all' || i.status === S.filter);
    if (inv.length === 0) { $('#rows').innerHTML = `<tr class="list-empty"><td colspan="3">${esc(t('emptyFilter'))}</td></tr>`; return; }
    $('#rows').innerHTML = inv
      .map((i) => `<tr class="row" tabindex="0" data-id="${esc(i.id)}" aria-selected="${S.selected === i.id}">
        <td><div class="inv-name">${esc(i.invoice_number || i.filename)}</div><div class="inv-sub">${esc(i.issuer_name || t('na'))} · ${esc(i.kind)}</div></td>
        <td><div class="amount">${fmt(i.total, i.currency === 'AMBIGUOUS' ? '$?' : i.currency)}</div><div class="amount-usd">${i.amount_usd !== null && i.amount_usd !== undefined ? fmt(i.amount_usd, 'USD') : ''}</div></td>
        <td><span class="badge b-${esc(i.status)}">${esc(t(i.status))}</span><div class="reasons">${i.reasons.slice(0, 3).map((r) => `<span class="code">${esc(r)}</span>`).join('')}</div></td>
      </tr>`)
      .join('');
  }

  // ---------------- render: detail ----------------
  const FIELDS = [['issuer_tax_id', 'RFC/NIT/CNPJ/EIN'], ['invoice_number', '#'], ['currency', 'Moneda / Currency'], ['total', 'Total'], ['payment_account', 'Cuenta / Account'], ['issue_date', 'Fecha / Date']];
  function renderDetail(d) {
    if (!d) { $('#detail').innerHTML = `<div class="empty">${esc(t('pickOne'))}</div>`; return; }
    const i = d.invoice;
    const ev = i.evaluation;
    const msg = (r) => (S.lang === 'es' ? r.message_es : r.message_en);
    const p = i.readings.primary && i.readings.primary.ok ? i.readings.primary : null;
    const c = i.readings.check && i.readings.check.ok ? i.readings.check : null;
    const norm = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9@]/g, '');
    const susp = [...new Set([...(p?.reading.suspicious_text || []), ...(c?.reading.suspicious_text || [])])];
    const rules = ev ? ev.rules : [];
    const rank = (r) => (r.result === 'FAIL' ? 0 : r.lifted_by ? 1 : 2);
    const sortedRules = [...rules].sort((a, b) => rank(a) - rank(b));
    const provenance = i.provenance || null;
    const pend = i.pending && !i.pending.resolved_at ? i.pending : null;
    const html = [];
    html.push(`<div class="d-head"><div><div class="d-title">${esc(i.invoice_number || i.document.filename)}</div>
      <div class="d-meta"><span>${esc(i.issuer_name || t('na'))}</span><span>${esc(i.document.filename)}</span><span>${esc(when(i.received_at))}</span><span class="mono">${esc(i.id)}</span></div></div>
      <div class="d-amount"><div class="big">${fmt(i.total, i.currency === 'AMBIGUOUS' ? '$?' : i.currency)}</div><div class="muted small">${i.amount_usd !== null && i.amount_usd !== undefined ? fmt(i.amount_usd, 'USD') : ''}</div><span class="badge b-${esc(i.status)}">${esc(t(i.status))}</span></div></div>`);
    const verdict = i.status === 'PAID' && ev && ev.approval ? t('vPAIDby').replace('{who}', ev.approval.approver) : t(`v${i.status}`);
    html.push(`<div class="section"><div class="verdict ${esc(i.status)}">${esc(verdict)}${i.reasons.length ? ` <span class="mono">(${i.reasons.map(esc).join(', ')})</span>` : ''}</div></div>`);
    if (susp.length) html.push(`<div class="section"><h3>${esc(t('orders'))}</h3><div class="suspicious">${susp.map((s) => `<q>${esc(s)}</q>`).join('')}</div></div>`);
    if (sortedRules.length) {
      const li = (r) => `<li class="rule ${r.result === 'PASS' ? (r.lifted_by ? 'pass lifted' : 'pass') : `fail ${r.outcome_if_fail}`}"><span class="g" aria-hidden="true">${r.result === 'PASS' ? (r.lifted_by ? '↑' : '✓') : r.outcome_if_fail === 'HOLD' ? '×' : '!'}</span><div><div class="name">${esc(r.rule)} · ${r.result === 'PASS' ? (r.lifted_by ? `PASS (${esc(r.lifted_by)})` : 'PASS') : `FAIL → ${r.outcome_if_fail}`}</div><div class="msg">${esc(msg(r))}</div></div></li>`;
      const top = sortedRules.filter((r) => rank(r) < 2);
      const passes = sortedRules.filter((r) => rank(r) === 2);
      const passLabel = S.lang === 'es' ? `${passes.length} reglas en PASS` : `${passes.length} rules passed`;
      html.push(`<div class="section"><h3>${esc(t('why'))} · v${esc(ev.policy_version)}${ev.approval ? ` · ${esc(ev.approval.approver)}` : ''}</h3>${top.length ? `<ul class="rules">${top.map(li).join('')}</ul>` : ''}${passes.length ? `<details class="passes"${top.length ? '' : ' open'}><summary>${esc(passLabel)}</summary><ul class="rules">${passes.map(li).join('')}</ul></details>` : ''}</div>`);
    }
    if (p || c) {
      const row = ([k, label]) => {
        const a = p ? p.reading[k] : null;
        const b = c ? c.reading[k] : null;
        const diff = p && c && k !== 'issue_date' && (k === 'total' ? Math.round(Number(a) * 100) !== Math.round(Number(b) * 100) : norm(a) !== norm(b));
        const show = (v) => (v === null || v === undefined || v === '' ? t('na') : k === 'total' ? fmt(v) : v);
        return `<tr><th scope="row">${esc(label)}</th><td>${esc(show(a))}</td><td class="${diff ? 'diff' : ''}">${esc(show(b))}${diff ? ' ≠' : ''}</td></tr>`;
      };
      html.push(`<div class="section"><h3>${esc(t('readings'))}</h3><table class="readings"><thead><tr><th>${esc(t('field'))}</th><th>${esc(t('primary'))} · ${esc(p?.model || t('na'))}</th><th>${esc(t('check'))} · ${esc(c?.model || t('na'))}</th></tr></thead><tbody>${FIELDS.map(row).join('')}</tbody></table></div>`);
    }
    if (i.payment) {
      const pay = i.payment;
      html.push(`<div class="section"><h3>${esc(t('payment'))} <span class="sim">${esc(t('simulated'))}</span></h3><div class="paycard">
        <div><div class="k">${esc(t('rail'))}</div><div class="v">${esc(pay.rail)}</div></div>
        <div><div class="k">${esc(t('amount'))}</div><div class="v">${fmt(pay.amount, pay.currency)}</div></div>
        <div><div class="k">${esc(t('usd'))}</div><div class="v">${fmt(pay.amount_usd, 'USD')}</div></div>
        <div><div class="k">${esc(t('rate'))}</div><div class="v">${esc(pay.fx.rate)} · ${esc(pay.fx.date)}</div></div>
        <div><div class="k">${esc(t('beneficiary'))}</div><div class="v">${esc(pay.beneficiary)}</div></div>
        <div><div class="k">${esc(t('account'))}</div><div class="v mono">${esc(pay.account_masked)}</div></div>
      </div>${pay.voided_at ? `<p class="bad-text small">${esc(t('VOIDED'))} · ${esc(pay.voided_by)} · ${when(pay.voided_at)}</p>` : ''}</div>`);
    }
    if (provenance) {
      html.push(`<div class="section"><h3>${esc(t('provenance'))}</h3><div class="prov">${Object.entries(provenance).map(([k, v]) => `<span class="tag" title="${esc(v.cite)}"><b>${esc(v.tag)}</b> ${esc(k)}</span>`).join('')}</div></div>`);
    }
    if (pend) {
      const needChoice = pend.reasons.includes('READINGS_DISAGREE');
      html.push(`<div class="section"><h3>${esc(t('approveTitle'))}</h3><div class="actions">
        <p class="small muted">${esc(t('approvable'))}</p>
        ${needChoice ? `<label class="small">${esc(t('chooseReading'))} <select id="confirmReading"><option value="primary">${esc(t('primary'))}</option><option value="check">${esc(t('check'))}</option></select></label>` : ''}
        <label class="small" for="note">${esc(t('note'))}</label><textarea id="note" maxlength="500"></textarea>
        <div class="row"><button class="btn ok" type="button" data-act="approve">${esc(t('approve'))}</button><button class="btn danger" type="button" data-act="reject">${esc(t('reject'))}</button></div>
      </div></div>`);
    }
    if (i.payment && !i.payment.voided_at && S.mode !== 'static') {
      html.push(`<div class="section"><div class="row"><button class="btn danger" type="button" data-act="void" data-pay="${esc(i.payment.id)}">${esc(t('voidPay'))}</button></div></div>`);
    }
    html.push(`<div class="section"><h3>${esc(t('audit'))}</h3><ul class="timeline">${d.audit
      .map((e) => `<li><div><b>${esc(e.type)}</b> · ${esc(e.actor)} · ${when(e.at)}</div><div class="h">#${e.seq} · ${esc(e.hash.slice(0, 16))}… ← ${esc(e.prev_hash.slice(0, 10))}…</div></li>`)
      .join('')}</ul></div>`);
    $('#detail').innerHTML = html.join('');
  }

  // ---------------- other views ----------------
  async function renderRules() {
    const el = $('#view-rules');
    const r = S.mode === 'static' ? S.staticData.rules : await api('/api/rules');
    el.innerHTML = `<div class="grid2"><div class="panel pad"><h2>${esc(t('rulesTitle'))} · v${esc(r.current.version)}</h2>
      <form class="form" id="rulesForm" style="margin-top:14px">${RULE_FIELDS.map(([k, label]) => `<label>${esc(t(label))}<input name="${k}" type="number" step="any" value="${esc(r.current[k])}"></label>`).join('')}</form>
      <div class="row" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" type="button" id="whatIfBtn" ${S.mode === 'static' ? 'disabled' : ''}>${esc(t('whatIf'))}</button><button class="btn primary" type="button" id="saveRules" ${S.mode === 'static' ? 'disabled' : ''}>${esc(t('save'))}</button></div>
      <div id="whatIfOut" class="small" style="margin-top:12px"></div></div>
      <div class="panel pad"><h2>${esc(t('versions'))}</h2><table class="simple" style="margin-top:10px"><thead><tr><th>v</th><th>${esc(t('actingAs'))}</th><th></th></tr></thead><tbody>${r.versions.map((v) => `<tr><td class="mono">v${esc(v.version)}</td><td>${esc(v.approved_by)}</td><td>${when(v.at)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function readRulesForm() {
    const f = $('#rulesForm');
    const out = {};
    RULE_FIELDS.forEach(([k]) => (out[k] = Number(f.elements[k].value)));
    return out;
  }
  async function renderCatalog() {
    const el = $('#view-catalog');
    const c = S.mode === 'static' ? S.staticData.catalog : await api('/api/catalog');
    el.innerHTML = `<div class="grid2"><div class="panel pad"><h2>${esc(t('vendors'))}</h2><table class="simple" style="margin-top:10px"><thead><tr><th>${esc(t('beneficiary'))}</th><th>ID</th><th>${esc(t('rail'))}</th><th>${esc(t('account'))}</th></tr></thead><tbody>${c.vendors.map((v) => `<tr><td>${esc(v.name)}<div class="muted small">${esc(v.country)} · ${esc(v.currency)}</div></td><td class="mono">${esc(v.tax_id)}</td><td>${esc(v.rail)}</td><td class="mono">${esc(v.account)}</td></tr>`).join('')}</tbody></table></div>
      <div class="panel pad"><h2>${esc(t('agreements'))}</h2><table class="simple" style="margin-top:10px"><thead><tr><th>ID</th><th></th><th>${esc(t('amount'))}</th></tr></thead><tbody>${c.agreements.map((a) => `<tr><td class="mono">${esc(a.id)}<div class="muted small">${esc(a.status)}</div></td><td>${esc(a.kind)}</td><td>${a.kind === 'CONTRACT' ? `${fmt(a.amount_per_period, a.currency)} / mes` : `${fmt(a.remaining, a.currency)} ${esc(t('of'))} ${fmt(a.total, a.currency)}`}</td></tr>`).join('')}</tbody></table>
      <h2 style="margin-top:18px">${esc(t('fx'))}</h2><p class="small muted">${esc(c.fx_table.date)} · ${esc(c.fx_table.source)}</p><table class="simple"><tbody>${Object.entries(c.fx_table.rates).map(([k, v]) => `<tr><td class="mono">1 ${esc(k)}</td><td class="mono">${esc(v)} USD</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  async function renderAudit() {
    const el = $('#view-audit');
    const a = S.mode === 'static' ? S.staticData.audit : await api('/api/audit');
    el.innerHTML = `<div class="panel pad"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2>${esc(t('tabAudit'))} · ${a.entries.length} ${esc(t('entries'))}</h2><span class="${a.verify.ok ? 'ok-text' : 'bad-text'}">${a.verify.ok ? '✓' : '×'} ${esc(a.verify.ok ? t('chainOk') : `${t('chainBad')} #${a.verify.broken_at}`)}</span></div>
      <div class="table-wrap" style="margin-top:10px;max-height:70vh"><table class="simple"><thead><tr><th>#</th><th></th><th></th><th>hash</th></tr></thead><tbody>${[...a.entries].reverse().map((e) => `<tr><td class="mono">${e.seq}</td><td><b>${esc(e.type)}</b><div class="muted small">${esc(e.actor)} · ${when(e.at)}</div></td><td class="mono small">${esc(e.invoice_id || '')}</td><td class="mono small">${esc(e.hash.slice(0, 20))}…</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderHow() {
    const es = S.lang === 'es';
    $('#view-how').innerHTML = `<div class="panel pad how"><h2>${es ? 'El modelo lee; las reglas deciden' : 'The model reads; the rules decide'}</h2>
      <div class="flow">
        <div class="step model"><b>1 · ${es ? 'Lectura principal' : 'Primary reading'}</b><span>Claude Opus 5.5 · ${es ? 'salida con esquema cerrado, sin herramientas' : 'closed-schema output, no tools'}</span></div>
        <div class="step model"><b>2 · ${es ? 'Segunda lectura' : 'Second reading'}</b><span>Claude Haiku 5.5 · ${es ? 'independiente; si no coinciden, escala' : 'independent; if they disagree, escalate'}</span></div>
        <div class="step"><b>3 · ${es ? 'Cruce con lo registrado' : 'Match against records'}</b><span>${es ? 'proveedor por identificación fiscal, cuenta, contrato u orden de compra, libro' : 'vendor by tax id, account, contract or PO, ledger'}</span></div>
        <div class="step rules"><b>4 · ${es ? 'Motor de reglas' : 'Rule engine'}</b><span>${es ? 'determinista: FRENAR > ESCALAR > PAGAR' : 'deterministic: HOLD > ESCALATE > PAY'}</span></div>
        <div class="step"><b>5 · ${es ? 'Registro encadenado' : 'Chained audit log'}</b><span>${es ? 'cada regla, su porqué en ES/EN, tasa, modelos y hash' : 'every rule, its why in ES/EN, rate, models and hash'}</span></div>
      </div>
      <ol>
        <li>${es ? 'El texto de una factura es dato, nunca instrucción: una frase que da órdenes se copia y la factura se escala.' : 'Invoice text is data, never instruction: a sentence giving orders is copied and the invoice is escalated.'}</li>
        <li>${es ? 'Ningún modelo decide un pago. El motor no lee texto libre y la aprobación humana vuelve a evaluar con las reglas vigentes.' : 'No model decides a payment. The engine reads no free text and a human approval re-runs the current rules.'}</li>
        <li>${es ? 'Las instrucciones de pago son simuladas por riel (SPEI, Pix, Bre-B, ACH); la ejecución real queda fuera de alcance.' : 'Payment instructions are simulated per rail (SPEI, Pix, Bre-B, ACH); real execution is out of scope.'}</li>
        <li>${es ? 'Una prueba de propiedad con 20,000 casos al azar demuestra: PAGAR implica que toda regla dura pasó.' : 'A property test over 20,000 random cases shows: PAY implies every hard rule passed.'}</li>
      </ol></div>`;
  }

  // ---------------- flows ----------------
  async function refresh(keepSelection = true) {
    S.summary = await loadSummary();
    renderKpis();
    renderFilters();
    renderRows();
    if (keepSelection && S.selected) await select(S.selected, false);
  }
  async function select(id, scroll = true) {
    S.selected = id;
    renderRows();
    const d = await loadDetail(id);
    renderDetail(d);
    if (scroll && window.matchMedia('(max-width: 1100px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function upload(file) {
    if (!canWrite()) return;
    const buf = await file.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    await busy($('#pickBtn'), t('reading'), async () => {
      try {
        const r = await api('/api/invoices', { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ file_name: file.name, content_base64: btoa(bin), actor: $('#actor').value.trim() }) });
        toast(`${t('uploaded')}: ${t(r.status)}${r.reasons.length ? ` (${r.reasons.join(', ')})` : ''}`);
        S.selected = r.invoice_id;
        S.filter = 'all';
        await refresh();
      } catch (e) {
        toast(`${t('failed')}: ${e.message}`, true);
      }
    });
  }
  async function act(kind, payId, btn) {
    if (!canWrite()) return;
    const id = S.selected;
    const note = $('#note')?.value.trim();
    await busy(btn, kind === 'approve' ? t('approving') : null, async () => {
      try {
        let r;
        if (kind === 'approve') {
          const confirm = $('#confirmReading')?.value;
          r = await api(`/api/invoices/${id}/approve`, { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ actor: $('#actor').value.trim(), ...(note ? { note } : {}), ...(confirm ? { confirm_reading: confirm } : {}) }) });
          toast(`${t('approvedToast')}: ${t(r.status)}${r.reasons.length ? ` (${r.reasons.join(', ')})` : ''}`);
        } else if (kind === 'reject') {
          await api(`/api/invoices/${id}/reject`, { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ actor: $('#actor').value.trim(), reason: note || (S.lang === 'es' ? 'rechazada en el tablero' : 'rejected in the dashboard') }) });
          toast(t('rejectedToast'));
        } else if (kind === 'void') {
          await api(`/api/payments/${payId}/void`, { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ actor: $('#actor').value.trim(), reason: S.lang === 'es' ? 'anulada en el tablero' : 'voided in the dashboard' }) });
          toast(t('voidedToast'));
        }
        await refresh();
      } catch (e) {
        toast(`${t('failed')}: ${e.message}`, true);
      }
    });
  }
  async function showTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${tab}`));
    if (tab === 'rules') await renderRules();
    if (tab === 'catalog') await renderCatalog();
    if (tab === 'audit') await renderAudit();
    if (tab === 'how') renderHow();
  }

  // ---------------- events ----------------
  document.addEventListener('click', async (e) => {
    const chip = e.target.closest('.chip');
    if (chip) { S.filter = chip.dataset.f; renderFilters(); renderRows(); return; }
    const row = e.target.closest('tr.row');
    if (row) { select(row.dataset.id); return; }
    const tab = e.target.closest('.tab');
    if (tab) { showTab(tab.dataset.tab); return; }
    const a = e.target.closest('[data-act]');
    if (a) { act(a.dataset.act, a.dataset.pay, a); return; }
    if (e.target.id === 'pickBtn') { if (canWrite()) $('#file').click(); return; }
    if (e.target.id === 'langBtn') { S.lang = S.lang === 'es' ? 'en' : 'es'; store.set('pc.lang', S.lang); applyI18n(); await refresh(); await showTab(S.tab); return; }
    if (e.target.id === 'whatIfBtn') {
      try {
        const r = await api('/api/what-if', { method: 'POST', body: JSON.stringify({ rules: readRulesForm() }) });
        $('#whatIfOut').innerHTML = `<b>${esc(t('whatIfRes'))}:</b> ${r.changed} ${esc(t('changed'))} · ${r.compared} ${esc(t('compared'))}<ul>${r.changes.map((c) => `<li class="mono">${esc(c.invoice_number || c.invoice_id)}: ${esc(c.from)} → ${esc(c.to)}</li>`).join('')}</ul>`;
      } catch (err) { toast(`${t('failed')}: ${err.message}`, true); }
      return;
    }
    if (e.target.id === 'saveRules') {
      if (!canWrite()) return;
      try { await api('/api/rules', { method: 'PUT', headers: writeHeaders(), body: JSON.stringify({ actor: $('#actor').value.trim(), rules: readRulesForm() }) }); toast(t('savedToast')); await renderRules(); await refresh(); } catch (err) { toast(`${t('failed')}: ${err.message}`, true); }
    }
  });
  document.addEventListener('keydown', (e) => {
    const row = e.target.closest && e.target.closest('tr.row');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(row.dataset.id); }
  });
  $('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) upload(f); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) upload(f); });
  $('#actor').value = store.get('pc.actor', 'luis.tesoreria');
  $('#actor').addEventListener('change', () => store.set('pc.actor', $('#actor').value.trim()));

  // ---------------- boot ----------------
  (async () => {
    try {
      const forced = new URLSearchParams(location.search).get('mode') === 'static';
      if (forced) throw new Error('static');
      await api('/api/summary');
      S.mode = 'live';
    } catch {
      S.mode = 'static';
      S.staticData = await fetch('demo-data.json').then((r) => r.json());
    }
    applyI18n();
    await refresh(false);
    const first = S.summary.invoices[0];
    if (first) await select(first.id, false);
  })();
})();
