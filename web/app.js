/* PagoClaro: the finance team's screen. Plain JS, no build, no framework.
   Live mode talks to the API. Static mode (GitHub Pages) reads demo-data.json, a snapshot of a
   real run, and turns every write off. Everything a person reads is in plain words; codes,
   models and hashes stay behind "Ver detalle técnico". */
(() => {
  'use strict';

  // ---------------------------------------------------------------- words
  const T = {
    es: {
      skip: 'Saltar al contenido', navLabel: 'Secciones', navInvoices: 'Facturas', navVendors: 'Proveedores autorizados', navVendorsShort: 'Proveedores', navSettings: 'Ajustes', navHistory: 'Historial',
      yourName: 'Tu nombre', accessCode: 'Código de acceso', langAria: 'Switch to English', langBtn: 'EN',
      footMade: 'Hecho para el reto Blinka del Hackathon 30X', footSim: 'Los pagos son simulados: no se mueve dinero real.',
      staticNotice: 'Demo de solo lectura: es una foto de una corrida real. Para subir facturas, aprobar o cambiar ajustes, abre PagoClaro en tu equipo.',
      readOnlyServer: 'Este servidor es de solo lectura: puedes ver todo, pero no hacer cambios.',
      loading: 'Cargando…', loadFail: 'No se pudo cargar esta sección. Revisa tu conexión e intenta de nuevo.', bootFail: 'No se pudo abrir PagoClaro. Revisa tu conexión y recarga la página.',
      // statuses
      st_PAID: 'Pagada', st_PENDING: 'Necesita tu revisión', st_HELD: 'Frenada', st_REJECTED: 'Rechazada', st_EXPIRED: 'Vencida', st_VOIDED: 'Pago anulado', st_ERROR: 'No se pudo procesar', st_PROCESSING: 'Procesando',
      // summary band
      f_all: 'Todas', f_review: 'Por revisar', f_paid: 'Pagadas', f_stopped: 'Frenadas', filterAria: 'Mostrar facturas', amountPaid: 'Monto pagado', outOfRules: 'Pagos fuera de reglas: {n}',
      // charts
      insTitle: 'Panorama', insHint: 'Toca una barra para ver esas facturas.',
      c_decided: 'Cómo se decidieron', c_alone: 'PagoClaro resolvió {n} de {t} sin pedir ayuda ({p} %).', c_segAria: '{g}: {n} facturas, {p} %. Mostrar en la lista.',
      c_why: 'Por qué pidieron a una persona', c_whyNone: 'Ninguna factura necesita a una persona ahora.', c_whyAria: '{r}: {n} facturas. Mostrar en la lista.', c_whyMore: 'y {n} motivos más',
      c_budget: 'Presupuesto del mes', c_budgetLine: 'Van {used} de {budget}.', c_budgetLeft: 'Quedan {left} este mes.', c_budgetOver: 'Se pasó por {over}: lo nuevo se frena.', c_budgetAria: 'Presupuesto usado: {p} %',
      c_paidTo: 'A quién se le pagó', c_paidNone: 'Todavía no se ha pagado ninguna factura.', c_paidN1: '1 factura', c_paidNn: '{n} facturas', c_paidAria: '{v}: {amt} en {n}. Mostrar en la lista.',
      facetReason: 'Mostrando: {r}', facetVendor: 'Mostrando: {v}', facetClear: 'Ver todas',
      lim_title: 'Contra tus límites', lim_amount: 'Esta factura', lim_auto: 'Sin revisión hasta {v}', lim_cap: 'Tope {v}',
      lim_under: '{amt}: usa el {p} % de lo que se paga sin revisión.', lim_over: '{amt}: pasa por {d} lo que se paga sin revisión, así que necesita a una persona.', lim_overPaid: '{amt}: pasó por {d} lo que se paga sin revisión, por eso la aprobó una persona antes de pagarla.', lim_overCap: '{amt}: pasa el tope por factura de {cap}, así que no se paga ni con aprobación.',
      lim_aria: '{amt} contra {auto} sin revisión y {cap} de tope',
      c_segUsdAria: '{g}: {usd}, {p} % del dinero. Mostrar en la lista.', c_byCount: 'Por número de facturas', c_byMoney: 'Por dinero (USD)',
      c_readers: 'Los dos lectores coincidieron en {a} de {n}.', c_readersTie: 'Los dos lectores coincidieron en {a} de {n}; en {t} desempató un tercero.',
      c_budgetNone: 'Todavía no hay datos del presupuesto de este mes.', c_toSettings: 'Ver el presupuesto en Ajustes',
      c_kUsed: 'Ya usado', c_kWaiting: 'Si apruebas lo pendiente', c_ifAll: 'Si apruebas lo pendiente ({w}), llegarías a {all} ({p}).', c_ifAllOver: 'Si apruebas lo pendiente ({w}), llegarías a {all}: te pasarías por {over}.',
      c_paidMore: 'y {n} proveedores más',
      unblockLine1: '1 factura ({usd}) espera a que alguien confirme la cuenta nueva de {who}.', unblockLineN: '{n} facturas ({usd}) esperan a que alguien confirme cuentas nuevas: {who}.', unblockSee: 'Ver cuáles', unblockGo: 'Ir a Proveedores', facetAccount: 'Mostrando: esperan una cuenta por confirmar',
      dueNow: 'vence ya', dueH: 'vence en {h} h', dueD: 'vence en {d} días',
      p_title: 'Camino de la factura', p_received: 'Recibida', p_read: 'Leída', p_readOk: 'Dos lectores coincidieron', p_readTie: 'Desempató un tercer lector', p_readSecond: 'Un tercer lector suplió al segundo',
      p_readDiff: 'Las lecturas no coinciden', p_readFail: 'No se pudo leer', p_readNone: 'Sin lectura', p_rules: 'Tus reglas', p_rulesV: '{p} de {n} cumplidas', p_rulesNone: 'Aún no se revisaron',
      p_result: 'Resultado', p_paid: 'Pagada por {rail} (simulado)', p_wait: 'Espera a una persona', p_waitUntil: 'Espera a una persona hasta el {d}', p_held: 'Frenada: no se pagó',
      p_rejected: 'Rechazada', p_expired: 'Venció sin pagarse', p_voided: 'Pago anulado', p_error: 'No se pudo procesar',
      poLine: 'Usado {used} de {total} ({p}).', poWait: 'Esperan decisión {w} más.', poWaitOver: 'Esperan decisión {w} más, y no alcanzaría el saldo.',
      waiting1u: '1 factura ({usd}) espera por esta cuenta.', waitingNu: '{n} facturas ({usd}) esperan por esta cuenta.',
      attention: 'Atención:', alertOut: 'Hay {n} pagos fuera de reglas. Revísalos en el historial.', alertChain: 'El historial no cuadra. Mira el detalle técnico en Historial.',
      // list
      upload: 'Subir factura', uploadHint: 'o arrástrala aquí. PDF, foto, correo o chat, hasta 10 MB.', uploadOff: 'En esta demo no se pueden subir facturas.', reading: 'Leyendo la factura…', tooBig: 'El archivo pasa de 10 MB. Prueba con uno más liviano.',
      uploadedToast: 'Factura revisada: {st}.', emptyFilter: 'No hay facturas en este grupo.', emptyAll: 'Todavía no hay facturas. Sube la primera y PagoClaro te dirá si la paga, la frena o te la deja para revisar.',
      andMore: ' (y {n} motivo más)', andMoreN: ' (y {n} motivos más)',
      l_PAID: 'Pagada dentro de tus reglas.', l_REJECTED: 'Una persona la rechazó.', l_EXPIRED: 'Nadie la revisó a tiempo.', l_VOIDED: 'Se anuló el pago.', l_ERROR: 'Hubo un problema al procesarla.', l_PROCESSING: 'PagoClaro la está revisando.',
      // detail
      pickOne: 'Elige una factura para ver qué decidió PagoClaro y por qué.', backToList: 'Volver a la lista', showing: 'Factura {n}: {st}.',
      invoiceN: 'Factura {n}', arrived: 'llegó el {d}', uploadedBy: 'la subió {who}', approxUsd: '≈ {v}', noTotal: 'Sin total',
      v_PAID: 'PagoClaro la pagó porque cumplió todas tus reglas.', v_PAIDby: 'Se pagó con la aprobación de {who}, después de volver a revisar tus reglas.',
      v_PENDING1: 'Necesita tu revisión porque {r}.', v_PENDINGn: 'Necesita tu revisión por {n} motivos:',
      v_HELD1: 'PagoClaro la frenó porque {r}. No se pagó.', v_HELDn: 'PagoClaro la frenó por {n} motivos y no se pagó:',
      v_HELDby1: 'No se pagó aunque {who} la aprobó, porque {r}.', v_HELDbyN: 'No se pagó aunque {who} la aprobó. Estos motivos no se resuelven aprobando:',
      v_HELDbyBlocked: ' Eso no se resuelve aprobando.',
      v_REJECTED: '{who} la rechazó.', v_REJECTEDwhy: '{who} la rechazó: “{why}”.', v_EXPIRED: 'Venció: nadie la revisó a tiempo, así que no se pagó.',
      v_VOIDED: 'Se pagó y después {who} anuló el pago.', v_ERROR: 'No se pudo procesar. Puedes volver a subirla.', v_PROCESSING: 'PagoClaro la está revisando.',
      someone: 'una persona', suspicious: 'Frase sospechosa en el documento (no se obedeció)',
      decideTitle: 'Tu decisión', note: 'Nota (opcional)', notePh: 'Por ejemplo: aprobada en el comité del martes', approve: 'Aprobar', reject: 'Rechazar', approving: 'Revisando tus reglas…', rejecting: 'Rechazando…',
      approveHelp: 'Al aprobar, PagoClaro vuelve a revisar tus reglas y la paga solo si todo lo demás se cumple.', expiresHelp: 'Si nadie decide antes del {d}, vence y no se paga.',
      blockedWarn: 'Aunque la apruebes, no se pagará: {r}.', fixAccount: 'Si el proveedor de verdad cambió de cuenta, regístrala y que otra persona la confirme en Proveedores autorizados.',
      fixPending: 'Si ya confirmaste la cuenta nueva en Proveedores autorizados, puedes aprobarla; si no, confírmala primero.', selfUpload: 'Tú subiste esta factura: otra persona debe aprobarla.',
      staticDecide: 'En esta demo no se puede aprobar ni rechazar.',
      chooseTitle: 'Las lecturas de la factura no coinciden', chooseHelp: 'Elige la que corresponde al documento. Ya está marcada la sugerida.', r_primary: 'Primera lectura', r_check: 'Segunda lectura', r_tiebreak: 'Lectura de desempate', suggested: 'sugerida',
      fl_issuer_tax_id: 'Identificación fiscal', fl_invoice_number: 'Número', fl_currency: 'Moneda', fl_total: 'Total', fl_payment_account: 'Cuenta de pago', fl_issue_date: 'Fecha', fl_issuer_name: 'Emisor', fl_due_date: 'Vence', fl_lines: 'Líneas', fl_suspicious_text: 'Frases con órdenes',
      approvedPaid: 'Aprobada y pagada.', approvedNot: 'Quedó aprobada, pero no se pagó: {st}. Mira el porqué en la factura.', rejectedToast: 'Factura rechazada.', rejectDefault: 'Rechazada sin nota',
      payTitle: 'Pago', payLine: 'Se emitió una orden de pago por {rail}: {amt} a la cuenta {acc}.', paySim: 'Es una simulación: no se movió dinero real.', payVoided: '{who} anuló este pago el {d}.',
      voidPay: 'Anular pago', voidAsk: '¿Anular este pago? La factura quedará como “Pago anulado”.', voidReason: 'Motivo (opcional)', voidConfirm: 'Sí, anular el pago', voidKeep: 'No anular', voiding: 'Anulando…', voidedToast: 'Pago anulado.', voidDefault: 'Anulado desde PagoClaro',
      factsTitle: 'Datos de la factura', k_vendor: 'Proveedor', k_account: 'Cuenta de pago', k_agreement: 'Acuerdo', k_rate: 'Tipo de cambio', k_dates: 'Fecha', k_doc: 'Documento',
      vendorOk: 'autorizado', vendorOff: 'desactivado', vendorNone: 'No está en tu lista de proveedores autorizados', accOk: 'la registrada', accBad: 'no coincide con la registrada ({acc})', datesLine: '{d}, vence el {due}',
      agrContract: 'Contrato de {amt} al mes', agrPO: 'Orden de compra: quedan {rem} de {tot}', agrNone: 'Sin contrato ni orden de compra',
      kind_pdf: 'PDF', kind_image: 'Foto', kind_email: 'Correo', kind_chat: 'Chat', curAmbiguous: 'sin moneda', curOther: 'otra moneda',
      histTitle: 'Historial de esta factura', techTitle: 'Ver detalle técnico',
      t_readings: 'Lecturas lado a lado', t_field: 'Campo', t_rules: 'Cada regla con su resultado · reglas v{v}', t_rule: 'Regla', t_result: 'Resultado', t_msg: 'Mensaje', t_prov: 'Procedencia de cada dato', t_doc: 'Documento', t_log: 'Registro encadenado', t_none: 'Sin lectura', t_lifted: 'PASS (aprobó {who})',
      // reasons
      // history fallbacks
      h_received: '{who} subió la factura {file}.', h_paidAuto: 'PagoClaro pagó {num} por {amt} porque cumplió todas las reglas. Pago simulado.', h_paidBy: 'Se pagó {num} por {amt} con la aprobación de {who}. Pago simulado.',
      h_hold: 'PagoClaro frenó {num} porque {r}.', h_holdPlain: 'PagoClaro frenó {num}.', h_holdBy: 'No se pagó {num} aunque {who} la aprobó, porque {r}.', h_expired: '{num} venció sin que nadie la revisara y no se pagó.',
      h_escalate: 'PagoClaro dejó {num} para revisión porque {r}.', h_escalatePlain: 'PagoClaro dejó {num} para revisión.', h_unconfirmed: 'PagoClaro no pudo confirmar la lectura de {num}: {r}.', h_error: 'No se pudo procesar {num}. Se puede volver a subir.',
      h_approved: '{who} aprobó {num}.', h_approvedNote: '{who} aprobó {num} con la nota “{note}”.', h_refused: '{who} intentó aprobar {num}, pero quien sube una factura no puede aprobarla.',
      h_rejected: '{who} rechazó {num}: “{why}”.', h_voided: '{who} anuló el pago de {num}: “{why}”.', h_rulesLoaded: 'Se cargaron los ajustes iniciales (versión {v}).', h_rulesChanged: '{who} cambió los ajustes (versión {v}).',
      h_vendor: '{who} actualizó la lista de proveedores autorizados{name}.', h_generic: '{who} registró un cambio.', theInvoice: 'la factura',
      // errors
      network: 'No se pudo conectar con PagoClaro. Revisa tu conexión e intenta de nuevo.', notYet: 'Esta versión del servidor todavía no permite esto.', readOnly: 'Esta demo es de solo lectura.',
      needName: 'Escribe tu nombre arriba, con letras, números, punto o guion.', needCode: 'Escribe el código de acceso arriba para hacer cambios.',
      E_BAD_ACCESS_CODE: 'El código de acceso no es correcto.', E_WRITES_DISABLED: 'Este servidor no acepta cambios.', E_SELF_APPROVAL: 'Quien subió una factura no puede aprobarla. Pide a otra persona que la apruebe.',
      E_SAME_ACTOR: 'Quien cambió la cuenta no puede confirmarla. Pide a otra persona que la confirme.', E_REASON_REQUIRED: 'Escribe el motivo del cambio de cuenta.', E_VERIFICATION_NOTE_REQUIRED: 'Escribe cómo verificaste la cuenta, con al menos 10 caracteres.',
      E_DUPLICATE_TAX_ID: 'Ya hay un proveedor con esa identificación fiscal.', E_NOT_PENDING: 'Esta factura ya no espera una decisión. Recarga para ver su estado.', E_CONFIRM_READING: 'Elige cuál lectura es la correcta.',
      E_ALREADY_VOIDED: 'Ese pago ya estaba anulado.', E_INVALID_RULES: 'Revisa los ajustes: {msg}', E_INVALID_REQUEST: 'Revisa los datos: {msg}', E_NOT_FOUND: 'No se encontró.',
      // vendors
      vTitle: 'Proveedores autorizados', vLead: 'PagoClaro solo le paga por su cuenta a estos proveedores, y solo a su cuenta confirmada.', addVendor: 'Agregar proveedor',
      addTitle: 'Agregar proveedor', addLead: 'Su cuenta queda por confirmar: otra persona debe verificarla antes de que PagoClaro le pague.', vName: 'Nombre o razón social', vCountry: 'País', vTax: 'Identificación fiscal ({label})', vCurrency: 'Moneda', vRail: 'Forma de pago', vAccount: 'Cuenta',
      acc_SPEI: 'CLABE de 18 dígitos', acc_PIX: 'Llave Pix (correo, teléfono o CNPJ)', acc_BRE_B: 'Llave o cuenta Bre-B', acc_ACH: 'Ruta y número de cuenta',
      addSave: 'Agregar a la lista', cancel: 'Cancelar', saving: 'Guardando…', required: 'Falta este dato.', vendorAdded: 'Proveedor agregado. Su cuenta queda por confirmar.',
      active: 'Activo', inactive: 'Desactivado', deactivate: 'Desactivar', reactivate: 'Reactivar', vendorOffToast: 'Proveedor desactivado: PagoClaro ya no le paga solo.', vendorOnToast: 'Proveedor reactivado.',
      changeAccount: 'Cambiar cuenta', newAccount: 'Cuenta nueva', reason: 'Motivo del cambio', reasonPh: 'Por ejemplo: avisó por correo que cambió de banco', saveAccount: 'Guardar cuenta nueva',
      newAccountHelp: 'La cuenta nueva queda por confirmar: PagoClaro sigue pagando a la cuenta confirmada hasta que otra persona confirme la nueva.', accountChanged: 'Cuenta nueva guardada. Falta que otra persona la confirme.',
      paidBy: 'Se le paga por {rail}', noAccount: 'Sin cuenta confirmada', agreementK: 'Acuerdo',
      pendingAcc: 'Cuenta nueva por confirmar: {acc}', pendingBy: 'La cambió {who} el {d}.', pendingWhy: 'Motivo: “{r}”.', waiting1: '1 factura espera por esta cuenta.', waitingN: '{n} facturas esperan por esta cuenta.',
      confirmAccount: 'Confirmar cuenta', howVerified: '¿Cómo verificaste la cuenta?', howPh: 'Por ejemplo: llamé al teléfono registrado y lo confirmó Laura Pérez', howHelp: 'Verifícala por otro canal, no por el mismo correo o factura que trajo el cambio.',
      youChanged: 'Tú hiciste este cambio: otra persona debe confirmarlo.', min10: 'Escribe al menos 10 caracteres.', confirmed: 'Cuenta confirmada.', confirmedWaiting1: 'Cuenta confirmada. 1 factura esperaba por ella y sigue en Facturas, por revisar.', confirmedWaitingN: 'Cuenta confirmada. {n} facturas esperaban por ella y siguen en Facturas, por revisar.',
      vEmpty: 'Todavía no hay proveedores autorizados. Agrega el primero para que PagoClaro pueda pagarle.',
      c_MX: 'México', c_CO: 'Colombia', c_BR: 'Brasil', c_US: 'Estados Unidos',
      // settings
      sTitle: 'Ajustes', sLead: 'PagoClaro paga solo lo que cumple estos ajustes. Lo demás te lo deja para revisar o lo frena.',
      howTitle: 'Así decide PagoClaro', howLead: 'Cada factura pasa por los mismos tres pasos. Tú pones los números; PagoClaro solo los aplica.',
      how1T: 'Lee la factura', how1: 'Dos lectores de IA la leen por separado. Si no coinciden, un tercero desempata; si sigue la duda, te la pasa.',
      how2T: 'La compara con tus reglas', how2: 'Proveedor autorizado, cuenta confirmada, monto, contrato, presupuesto y que no esté repetida.',
      how3T: 'Decide y te dice por qué', how3: 'La paga, te la deja para revisar o la frena. Cada paso queda en el Historial.',
      howPayT: 'Se paga sola', howPayL: 'Solo si cumple todo esto:',
      howPay: ['El proveedor está autorizado y su cuenta es la confirmada.', 'Su monto es de {limit} o menos.', 'Cuadra con su contrato u orden de compra.', 'Cabe en el presupuesto del mes y no está repetida.'],
      howRevT: 'Te pide revisión', howRevL: 'Si algo necesita a una persona:',
      howRev: ['Su monto pasa de {limit}.', 'El proveedor no está autorizado o su cuenta cambió.', 'Se sale de su contrato más de {tol}, o parece repetida o partida.', 'Las lecturas no coinciden o el texto trae órdenes.'],
      howRevF: 'Tú decides. Si nadie lo hace en {hours}, vence y no se paga.',
      howStopT: 'Se frena', howStopL: 'No se paga ni con aprobación:',
      howStop: ['Pasa del tope de {cap} por factura.', 'Ya no cabe en el presupuesto de {budget} del mes.', 'Ya hay una factura con el mismo número de ese proveedor.', 'Pasa de lo que queda en su orden de compra.'],
      howFoot: 'Aunque apruebes una factura, PagoClaro vuelve a revisar los topes justo antes de pagar. Toca un número para ir a su ajuste.',
      howSee0: 'Ninguna por ahora', howSee1: 'Ver 1 factura', howSeeN: 'Ver {n} facturas', howGoto: 'Ir a este ajuste', howLink: 'Así decide PagoClaro',
      g_when: 'Cuándo pagar sin preguntarte', gd_when: 'Lo que cumpla esto se paga solo.', g_limits: 'Límites que nunca se pasan', gd_limits: 'Por encima de esto no se paga, ni con aprobación.',
      g_repeat: 'Cobros repetidos', gd_repeat: 'Para detectar facturas duplicadas o partidas.', g_dates: 'Fechas y plazos', gd_dates: 'Qué fechas se aceptan y cuánto espera una revisión.',
      s_auto_approve_up_to_usd: 'Pagar sin revisión hasta', sh_auto_approve_up_to_usd: 'Por encima de este monto, la factura espera tu revisión.',
      s_contract_tolerance_pct: 'Tolerancia contra el contrato', sh_contract_tolerance_pct: 'Cuánto puede variar el monto frente a lo pactado.',
      s_no_agreement: 'Proveedores autorizados sin acuerdo', s_no_agreement_sentence: ['hasta', 'por factura y', 'por mes'], sh_no_agreement: 'Con 0, toda factura de un proveedor sin contrato ni orden de compra espera tu revisión.',
      s_hard_cap_per_invoice_usd: 'Tope por factura', sh_hard_cap_per_invoice_usd: 'Una factura por encima de esto no se paga.',
      s_monthly_budget_usd: 'Presupuesto del mes', sh_monthly_budget_usd: 'Lo máximo que se paga en total cada mes.',
      s_possible_duplicate_window_days: 'Buscar facturas parecidas en', sh_possible_duplicate_window_days: 'Mismo proveedor y mismo monto en este plazo: te la deja para revisar.',
      s_split_window_days: 'Buscar cobros partidos en', sh_split_window_days: 'Varias facturas del mismo proveedor que juntas pasan del monto sin revisión.',
      s_stale_after_days: 'Antigüedad máxima de una factura', sh_stale_after_days: 'Una factura más vieja que esto espera tu revisión.',
      s_future_tolerance_days: 'Fecha adelantada aceptada', sh_future_tolerance_days: 'Cuántos días en el futuro puede venir fechada.',
      s_pending_timeout_hours: 'Tiempo para revisar', sh_pending_timeout_hours: 'Si nadie decide en este plazo, la factura vence y no se paga.',
      u_usd: 'USD', u_pct: '%', u_days: 'días', u_hours: 'horas', changed: 'cambiado',
      whatIf: 'Ver qué cambiaría', simulating: 'Comparando…', save: 'Guardar', noChanges: 'Sin cambios', dirty1: '1 cambio sin guardar', dirtyN: '{n} cambios sin guardar', staticSettings: 'En esta demo los ajustes son de solo lectura.',
      versionLine: 'Versión {v}, guardada por {who} el {d}.', versionOnly: 'Versión {v}.', savedToast: 'Ajustes guardados. Las facturas nuevas se revisan con ellos.',
      wiNone: 'Con estos ajustes ninguna de las {n} decisiones del agente cambiaría.', wiSome1: 'Con estos ajustes cambiaría 1 de {n} decisiones del agente:', wiSomeN: 'Con estos ajustes cambiarían {c} de {n} decisiones del agente:', wiRow: '{inv}: hoy {from}; con estos ajustes {to}.',
      o_now_PAY: 'se paga', o_now_HOLD: 'se frena', o_now_ESCALATE: 'pide revisión', o_new_PAY: 'se pagaría', o_new_HOLD: 'se frenaría', o_new_ESCALATE: 'pediría revisión',
      o_k_PAY: 'Se pagan solas', o_k_ESCALATE: 'Piden revisión', o_k_HOLD: 'Se frenan', o_new_PAY_pl: 'se pagarían solas', o_new_ESCALATE_pl: 'pedirían revisión', o_new_HOLD_pl: 'se frenarían', o_new_PAY_1: 'se pagaría sola', o_new_ESCALATE_1: 'pediría revisión', o_new_HOLD_1: 'se frenaría',
      wiToday: 'Hoy', wiWith: 'Con estos ajustes', wiMore: '{n} más {what}', wiLess: '{n} menos {what}', wiDelta: 'Con estos ajustes, {list}.',
      hitNone: 'No ha detenido ninguna factura.', hit1: 'Detuvo 1 de {total} facturas · ver', hitN: 'Detuvo {n} de {total} facturas · ver', hitAria: '{n} de {total} facturas tienen este motivo. Verlas en Facturas.',
      capLtAuto: '«Pagar sin revisión hasta» no puede ser mayor que el «Tope por factura».', badNumber: 'Escribe un número entre {min} y {max}.', badInt: 'Escribe un número entero entre {min} y {max}.',
      fxTitle: 'Tipos de cambio que usa PagoClaro', fxLine: 'Tabla del {d}. {src}.',
      // history
      hTitle: 'Historial', hLead: 'Todo lo que pasó, en orden: qué decidió PagoClaro, qué decidió cada persona y qué cambió.', chainOk: 'Completo y sin alteraciones', chainBad: 'No cuadra desde el registro {n}', chainCount1: '1 registro', chainCountN: '{n} registros',
      seeInvoice: 'Ver factura', more: 'Mostrar más', today: 'Hoy', yesterday: 'Ayer', hEmpty: 'Todavía no hay nada en el historial.', spend: 'Gasto en lectura de facturas: {s} de {cap} USD.', t_entries: 'Registro completo',
    },
    en: {
      skip: 'Skip to content', navLabel: 'Sections', navInvoices: 'Invoices', navVendors: 'Approved vendors', navVendorsShort: 'Vendors', navSettings: 'Settings', navHistory: 'History',
      yourName: 'Your name', accessCode: 'Access code', langAria: 'Cambiar a español', langBtn: 'ES',
      footMade: 'Made for the Blinka challenge at Hackathon 30X', footSim: 'Payments are simulated: no real money moves.',
      staticNotice: 'Read-only demo: a snapshot of a real run. To upload invoices, approve or change settings, run PagoClaro on your computer.',
      readOnlyServer: 'This server is read-only: you can see everything but cannot make changes.',
      loading: 'Loading…', loadFail: 'This section could not load. Check your connection and try again.', bootFail: 'PagoClaro could not open. Check your connection and reload the page.',
      st_PAID: 'Paid', st_PENDING: 'Needs your review', st_HELD: 'Stopped', st_REJECTED: 'Rejected', st_EXPIRED: 'Expired', st_VOIDED: 'Payment canceled', st_ERROR: 'Could not be processed', st_PROCESSING: 'Processing',
      f_all: 'All', f_review: 'To review', f_paid: 'Paid', f_stopped: 'Stopped', filterAria: 'Show invoices', amountPaid: 'Amount paid', outOfRules: 'Payments outside the rules: {n}',
      // charts
      insTitle: 'At a glance', insHint: 'Tap a bar to see those invoices.',
      c_decided: 'How they were decided', c_alone: 'PagoClaro settled {n} of {t} without asking for help ({p}%).', c_segAria: '{g}: {n} invoices, {p}%. Show them in the list.',
      c_why: 'Why a person was needed', c_whyNone: 'No invoice needs a person right now.', c_whyAria: '{r}: {n} invoices. Show them in the list.', c_whyMore: 'and {n} more reasons',
      c_budget: "This month's budget", c_budgetLine: '{used} of {budget} used.', c_budgetLeft: '{left} left this month.', c_budgetOver: 'Over by {over}: anything new is held.', c_budgetAria: 'Budget used: {p}%',
      c_paidTo: 'Who was paid', c_paidNone: 'No invoice has been paid yet.', c_paidN1: '1 invoice', c_paidNn: '{n} invoices', c_paidAria: '{v}: {amt} in {n}. Show them in the list.',
      facetReason: 'Showing: {r}', facetVendor: 'Showing: {v}', facetClear: 'See all',
      lim_title: 'Against your limits', lim_amount: 'This invoice', lim_auto: 'No review up to {v}', lim_cap: 'Cap {v}',
      lim_under: '{amt}: uses {p}% of what is paid without review.', lim_over: '{amt}: {d} over what is paid without review, so it needs a person.', lim_overPaid: '{amt}: {d} over what is paid without review, so a person approved it before it was paid.', lim_overCap: '{amt}: over the {cap} cap per invoice, so it is not paid even with an approval.',
      lim_aria: '{amt} against {auto} without review and a {cap} cap',
      c_segUsdAria: '{g}: {usd}, {p}% of the money. Show them in the list.', c_byCount: 'By number of invoices', c_byMoney: 'By money (USD)',
      c_readers: 'Both readers agreed on {a} of {n}.', c_readersTie: 'Both readers agreed on {a} of {n}; a third one broke the tie on {t}.',
      c_budgetNone: 'There is no budget data for this month yet.', c_toSettings: 'See the budget in Settings',
      c_kUsed: 'Already used', c_kWaiting: 'If you approve what waits', c_ifAll: 'If you approve what waits ({w}), you would reach {all} ({p}).', c_ifAllOver: 'If you approve what waits ({w}), you would reach {all}: {over} over.',
      c_paidMore: 'and {n} more vendors',
      unblockLine1: '1 invoice ({usd}) waits for someone to confirm the new account of {who}.', unblockLineN: '{n} invoices ({usd}) wait for someone to confirm new accounts: {who}.', unblockSee: 'See which', unblockGo: 'Go to Vendors', facetAccount: 'Showing: waiting for an account to be confirmed',
      dueNow: 'due now', dueH: 'due in {h} h', dueD: 'due in {d} days',
      p_title: "The invoice's path", p_received: 'Received', p_read: 'Read', p_readOk: 'Both readers agreed', p_readTie: 'A third reader broke the tie', p_readSecond: 'A third reader stood in for the second',
      p_readDiff: 'The readings do not match', p_readFail: 'Could not be read', p_readNone: 'No reading', p_rules: 'Your rules', p_rulesV: '{p} of {n} met', p_rulesNone: 'Not checked yet',
      p_result: 'Result', p_paid: 'Paid by {rail} (simulated)', p_wait: 'Waits for a person', p_waitUntil: 'Waits for a person until {d}', p_held: 'Held: not paid',
      p_rejected: 'Rejected', p_expired: 'Expired unpaid', p_voided: 'Payment voided', p_error: 'Could not be processed',
      poLine: '{used} of {total} used ({p}).', poWait: '{w} more waits for a decision.', poWaitOver: '{w} more waits for a decision, and the balance would not cover it.',
      waiting1u: '1 invoice ({usd}) waits for this account.', waitingNu: '{n} invoices ({usd}) wait for this account.',
      attention: 'Heads up:', alertOut: 'There are {n} payments outside the rules. Check them in History.', alertChain: 'The history does not add up. See the technical details in History.',
      upload: 'Upload invoice', uploadHint: 'or drop it here. PDF, photo, email or chat, up to 10 MB.', uploadOff: 'Invoices cannot be uploaded in this demo.', reading: 'Reading the invoice…', tooBig: 'The file is over 10 MB. Try a smaller one.',
      uploadedToast: 'Invoice checked: {st}.', emptyFilter: 'No invoices in this group.', emptyAll: 'No invoices yet. Upload the first one and PagoClaro will tell you whether it pays it, stops it or leaves it for your review.',
      andMore: ' (and {n} more reason)', andMoreN: ' (and {n} more reasons)',
      l_PAID: 'Paid within your rules.', l_REJECTED: 'A person rejected it.', l_EXPIRED: 'Nobody reviewed it in time.', l_VOIDED: 'The payment was canceled.', l_ERROR: 'Something went wrong while processing it.', l_PROCESSING: 'PagoClaro is checking it.',
      pickOne: 'Pick an invoice to see what PagoClaro decided and why.', backToList: 'Back to the list', showing: 'Invoice {n}: {st}.',
      invoiceN: 'Invoice {n}', arrived: 'arrived {d}', uploadedBy: 'uploaded by {who}', approxUsd: '≈ {v}', noTotal: 'No total',
      v_PAID: 'PagoClaro paid it because it met all your rules.', v_PAIDby: 'Paid with the approval of {who}, after checking your rules again.',
      v_PENDING1: 'Needs your review because {r}.', v_PENDINGn: 'Needs your review for {n} reasons:',
      v_HELD1: 'PagoClaro stopped it because {r}. It was not paid.', v_HELDn: 'PagoClaro stopped it for {n} reasons and it was not paid:',
      v_HELDby1: 'Not paid even though {who} approved it, because {r}.', v_HELDbyN: 'Not paid even though {who} approved it. An approval cannot clear these:',
      v_HELDbyBlocked: ' An approval cannot clear that.',
      v_REJECTED: '{who} rejected it.', v_REJECTEDwhy: '{who} rejected it: “{why}”.', v_EXPIRED: 'Expired: nobody reviewed it in time, so it was not paid.',
      v_VOIDED: 'It was paid and then {who} canceled the payment.', v_ERROR: 'It could not be processed. You can upload it again.', v_PROCESSING: 'PagoClaro is checking it.',
      someone: 'a person', suspicious: 'Suspicious sentence in the document (not followed)',
      decideTitle: 'Your decision', note: 'Note (optional)', notePh: 'For example: approved at Tuesday’s committee', approve: 'Approve', reject: 'Reject', approving: 'Checking your rules…', rejecting: 'Rejecting…',
      approveHelp: 'When you approve, PagoClaro checks your rules again and pays it only if everything else holds.', expiresHelp: 'If nobody decides before {d}, it expires and is not paid.',
      blockedWarn: 'Even if you approve it, it will not be paid: {r}.', fixAccount: 'If the vendor really changed accounts, register the new one and have another person confirm it in Approved vendors.',
      fixPending: 'If the new account is already confirmed in Approved vendors, you can approve it; if not, confirm it first.', selfUpload: 'You uploaded this invoice: another person must approve it.',
      staticDecide: 'Approving and rejecting are off in this demo.',
      chooseTitle: 'The readings of the invoice do not match', chooseHelp: 'Pick the one that matches the document. The suggested one is already selected.', r_primary: 'First reading', r_check: 'Second reading', r_tiebreak: 'Tie-break reading', suggested: 'suggested',
      fl_issuer_tax_id: 'Tax ID', fl_invoice_number: 'Number', fl_currency: 'Currency', fl_total: 'Total', fl_payment_account: 'Payment account', fl_issue_date: 'Date', fl_issuer_name: 'Issuer', fl_due_date: 'Due', fl_lines: 'Lines', fl_suspicious_text: 'Sentences giving orders',
      approvedPaid: 'Approved and paid.', approvedNot: 'Approved, but not paid: {st}. See why in the invoice.', rejectedToast: 'Invoice rejected.', rejectDefault: 'Rejected without a note',
      payTitle: 'Payment', payLine: 'A payment order was issued by {rail}: {amt} to account {acc}.', paySim: 'It is a simulation: no real money moved.', payVoided: '{who} canceled this payment on {d}.',
      voidPay: 'Cancel payment', voidAsk: 'Cancel this payment? The invoice will show “Payment canceled”.', voidReason: 'Reason (optional)', voidConfirm: 'Yes, cancel the payment', voidKeep: 'Keep it', voiding: 'Canceling…', voidedToast: 'Payment canceled.', voidDefault: 'Canceled from PagoClaro',
      factsTitle: 'Invoice details', k_vendor: 'Vendor', k_account: 'Payment account', k_agreement: 'Agreement', k_rate: 'Exchange rate', k_dates: 'Date', k_doc: 'Document',
      vendorOk: 'approved', vendorOff: 'deactivated', vendorNone: 'Not on your approved vendors list', accOk: 'the registered one', accBad: 'does not match the registered one ({acc})', datesLine: '{d}, due {due}',
      agrContract: 'Contract for {amt} a month', agrPO: 'Purchase order: {rem} left of {tot}', agrNone: 'No contract or purchase order',
      kind_pdf: 'PDF', kind_image: 'Photo', kind_email: 'Email', kind_chat: 'Chat', curAmbiguous: 'no currency', curOther: 'other currency',
      histTitle: 'History of this invoice', techTitle: 'See technical details',
      t_readings: 'Readings side by side', t_field: 'Field', t_rules: 'Each rule and its result · rules v{v}', t_rule: 'Rule', t_result: 'Result', t_msg: 'Message', t_prov: 'Where each fact came from', t_doc: 'Document', t_log: 'Chained log', t_none: 'No reading', t_lifted: 'PASS (approved by {who})',
      h_received: '{who} uploaded the invoice {file}.', h_paidAuto: 'PagoClaro paid {num} for {amt} because it met all the rules. Simulated payment.', h_paidBy: '{num} was paid for {amt} with the approval of {who}. Simulated payment.',
      h_hold: 'PagoClaro stopped {num} because {r}.', h_holdPlain: 'PagoClaro stopped {num}.', h_holdBy: '{num} was not paid even though {who} approved it, because {r}.', h_expired: '{num} expired without anyone reviewing it and was not paid.',
      h_escalate: 'PagoClaro left {num} for review because {r}.', h_escalatePlain: 'PagoClaro left {num} for review.', h_unconfirmed: 'PagoClaro could not confirm the reading of {num}: {r}.', h_error: '{num} could not be processed. It can be uploaded again.',
      h_approved: '{who} approved {num}.', h_approvedNote: '{who} approved {num} with the note “{note}”.', h_refused: '{who} tried to approve {num}, but whoever uploads an invoice cannot approve it.',
      h_rejected: '{who} rejected {num}: “{why}”.', h_voided: '{who} canceled the payment of {num}: “{why}”.', h_rulesLoaded: 'The initial settings were loaded (version {v}).', h_rulesChanged: '{who} changed the settings (version {v}).',
      h_vendor: '{who} updated the approved vendors list{name}.', h_generic: '{who} recorded a change.', theInvoice: 'the invoice',
      network: 'Could not reach PagoClaro. Check your connection and try again.', notYet: 'This server version does not support this yet.', readOnly: 'This demo is read-only.',
      needName: 'Type your name above, with letters, numbers, dots or dashes.', needCode: 'Type the access code above to make changes.',
      E_BAD_ACCESS_CODE: 'The access code is not correct.', E_WRITES_DISABLED: 'This server does not accept changes.', E_SELF_APPROVAL: 'Whoever uploaded an invoice cannot approve it. Ask another person to approve it.',
      E_SAME_ACTOR: 'Whoever changed the account cannot confirm it. Ask another person to confirm it.', E_REASON_REQUIRED: 'Type the reason for the account change.', E_VERIFICATION_NOTE_REQUIRED: 'Type how you verified the account, with at least 10 characters.',
      E_DUPLICATE_TAX_ID: 'There is already a vendor with that tax ID.', E_NOT_PENDING: 'This invoice is no longer waiting for a decision. Reload to see its status.', E_CONFIRM_READING: 'Pick which reading is correct.',
      E_ALREADY_VOIDED: 'That payment was already canceled.', E_INVALID_RULES: 'Check the settings: {msg}', E_INVALID_REQUEST: 'Check the data: {msg}', E_NOT_FOUND: 'Not found.',
      vTitle: 'Approved vendors', vLead: 'PagoClaro pays on its own only these vendors, and only to their confirmed account.', addVendor: 'Add vendor',
      addTitle: 'Add vendor', addLead: 'Its account stays pending: another person must verify it before PagoClaro pays it.', vName: 'Name or legal name', vCountry: 'Country', vTax: 'Tax ID ({label})', vCurrency: 'Currency', vRail: 'Payment method', vAccount: 'Account',
      acc_SPEI: '18-digit CLABE', acc_PIX: 'Pix key (email, phone or CNPJ)', acc_BRE_B: 'Bre-B key or account', acc_ACH: 'Routing and account number',
      addSave: 'Add to the list', cancel: 'Cancel', saving: 'Saving…', required: 'This is missing.', vendorAdded: 'Vendor added. Its account is pending confirmation.',
      active: 'Active', inactive: 'Deactivated', deactivate: 'Deactivate', reactivate: 'Reactivate', vendorOffToast: 'Vendor deactivated: PagoClaro no longer pays it on its own.', vendorOnToast: 'Vendor reactivated.',
      changeAccount: 'Change account', newAccount: 'New account', reason: 'Reason for the change', reasonPh: 'For example: emailed that they changed banks', saveAccount: 'Save new account',
      newAccountHelp: 'The new account stays pending: PagoClaro keeps paying the confirmed account until another person confirms the new one.', accountChanged: 'New account saved. Another person still has to confirm it.',
      paidBy: 'Paid by {rail}', noAccount: 'No confirmed account', agreementK: 'Agreement',
      pendingAcc: 'New account pending confirmation: {acc}', pendingBy: '{who} changed it on {d}.', pendingWhy: 'Reason: “{r}”.', waiting1: '1 invoice is waiting for this account.', waitingN: '{n} invoices are waiting for this account.',
      confirmAccount: 'Confirm account', howVerified: 'How did you verify the account?', howPh: 'For example: I called the registered phone and Laura Pérez confirmed it', howHelp: 'Verify it through another channel, not the same email or invoice that brought the change.',
      youChanged: 'You made this change: another person must confirm it.', min10: 'Type at least 10 characters.', confirmed: 'Account confirmed.', confirmedWaiting1: 'Account confirmed. 1 invoice was waiting for it and is still in Invoices, to review.', confirmedWaitingN: 'Account confirmed. {n} invoices were waiting for it and are still in Invoices, to review.',
      vEmpty: 'No approved vendors yet. Add the first one so PagoClaro can pay it.',
      c_MX: 'Mexico', c_CO: 'Colombia', c_BR: 'Brazil', c_US: 'United States',
      sTitle: 'Settings', sLead: 'PagoClaro pays only what meets these settings. Everything else waits for your review or is stopped.',
      howTitle: 'How PagoClaro decides', howLead: 'Every invoice goes through the same three steps. You set the numbers; PagoClaro only applies them.',
      how1T: 'Reads the invoice', how1: 'Two AI readers read it separately. If they disagree, a third one breaks the tie; if there is still doubt, it comes to you.',
      how2T: 'Checks it against your rules', how2: 'Approved vendor, confirmed account, amount, contract, budget and that it is not repeated.',
      how3T: 'Decides and tells you why', how3: 'It pays it, leaves it for your review or stops it. Every step stays in History.',
      howPayT: 'Paid on its own', howPayL: 'Only if it meets all of this:',
      howPay: ['The vendor is approved and its account is the confirmed one.', 'Its amount is {limit} or less.', 'It matches its contract or purchase order.', 'It fits the monthly budget and is not repeated.'],
      howRevT: 'Asks for your review', howRevL: 'When something needs a person:',
      howRev: ['Its amount is over {limit}.', 'The vendor is not approved or its account changed.', 'It is off its contract by more than {tol}, or looks repeated or split.', 'The readings disagree or the text gives orders.'],
      howRevF: 'You decide. If nobody does within {hours}, it expires and is not paid.',
      howStopT: 'Stopped', howStopL: 'Not paid, not even with an approval:',
      howStop: ['It is over the {cap} cap per invoice.', 'The {budget} monthly budget no longer covers it.', 'That vendor already sent an invoice with the same number.', 'It is over what is left on its purchase order.'],
      howFoot: 'Even when you approve an invoice, PagoClaro checks the caps again right before paying. Tap a number to go to its setting.',
      howSee0: 'None for now', howSee1: 'See 1 invoice', howSeeN: 'See {n} invoices', howGoto: 'Go to this setting', howLink: 'How PagoClaro decides',
      g_when: 'When to pay without asking you', gd_when: 'Whatever meets this is paid on its own.', g_limits: 'Limits that are never crossed', gd_limits: 'Nothing above this is paid, not even with an approval.',
      g_repeat: 'Repeated charges', gd_repeat: 'To catch duplicated or split invoices.', g_dates: 'Dates and deadlines', gd_dates: 'Which dates are accepted and how long a review waits.',
      s_auto_approve_up_to_usd: 'Pay without review up to', sh_auto_approve_up_to_usd: 'Above this amount, the invoice waits for your review.',
      s_contract_tolerance_pct: 'Tolerance against the contract', sh_contract_tolerance_pct: 'How much the amount may differ from what was agreed.',
      s_no_agreement: 'Approved vendors without an agreement', s_no_agreement_sentence: ['up to', 'per invoice and', 'per month'], sh_no_agreement: 'At 0, every invoice from a vendor with no contract or purchase order waits for your review.',
      s_hard_cap_per_invoice_usd: 'Cap per invoice', sh_hard_cap_per_invoice_usd: 'An invoice above this is not paid.',
      s_monthly_budget_usd: 'Monthly budget', sh_monthly_budget_usd: 'The most that is paid in total each month.',
      s_possible_duplicate_window_days: 'Look for similar invoices within', sh_possible_duplicate_window_days: 'Same vendor and same amount within this window: it waits for your review.',
      s_split_window_days: 'Look for split charges within', sh_split_window_days: 'Several invoices from the same vendor that together go over the no-review amount.',
      s_stale_after_days: 'Oldest invoice accepted', sh_stale_after_days: 'An invoice older than this waits for your review.',
      s_future_tolerance_days: 'Future date accepted', sh_future_tolerance_days: 'How many days ahead an invoice may be dated.',
      s_pending_timeout_hours: 'Time to review', sh_pending_timeout_hours: 'If nobody decides within this time, the invoice expires and is not paid.',
      u_usd: 'USD', u_pct: '%', u_days: 'days', u_hours: 'hours', changed: 'changed',
      whatIf: 'See what would change', simulating: 'Comparing…', save: 'Save', noChanges: 'No changes', dirty1: '1 unsaved change', dirtyN: '{n} unsaved changes', staticSettings: 'Settings are read-only in this demo.',
      versionLine: 'Version {v}, saved by {who} on {d}.', versionOnly: 'Version {v}.', savedToast: 'Settings saved. New invoices are checked with them.',
      wiNone: 'With these settings none of the agent’s {n} decisions would change.', wiSome1: 'With these settings 1 of the agent’s {n} decisions would change:', wiSomeN: 'With these settings {c} of the agent’s {n} decisions would change:', wiRow: '{inv}: today it {from}; with these settings it {to}.',
      o_now_PAY: 'is paid', o_now_HOLD: 'is stopped', o_now_ESCALATE: 'asks for review', o_new_PAY: 'would be paid', o_new_HOLD: 'would be stopped', o_new_ESCALATE: 'would ask for review',
      o_k_PAY: 'Paid on their own', o_k_ESCALATE: 'Ask for review', o_k_HOLD: 'Stopped', o_new_PAY_pl: 'would be paid on their own', o_new_ESCALATE_pl: 'would ask for review', o_new_HOLD_pl: 'would be stopped', o_new_PAY_1: 'would be paid on its own', o_new_ESCALATE_1: 'would ask for review', o_new_HOLD_1: 'would be stopped',
      wiToday: 'Today', wiWith: 'With these settings', wiMore: '{n} more {what}', wiLess: '{n} fewer {what}', wiDelta: 'With these settings, {list}.',
      hitNone: 'Has not stopped any invoice.', hit1: 'Stopped 1 of {total} invoices · see', hitN: 'Stopped {n} of {total} invoices · see', hitAria: '{n} of {total} invoices have this reason. See them in Invoices.',
      capLtAuto: '“Pay without review up to” cannot be higher than the “Cap per invoice”.', badNumber: 'Type a number between {min} and {max}.', badInt: 'Type a whole number between {min} and {max}.',
      fxTitle: 'Exchange rates PagoClaro uses', fxLine: 'Table from {d}. {src}.',
      hTitle: 'History', hLead: 'Everything that happened, in order: what PagoClaro decided, what each person decided and what changed.', chainOk: 'Complete and unaltered', chainBad: 'Does not add up from record {n}', chainCount1: '1 record', chainCountN: '{n} records',
      seeInvoice: 'See invoice', more: 'Show more', today: 'Today', yesterday: 'Yesterday', hEmpty: 'Nothing in the history yet.', spend: 'Spent reading invoices: {s} of {cap} USD.', t_entries: 'Full log',
    },
  };

  /* Plain words for each rule the agent can fail. c carries numbers when the detail has them. */
  const REASONS = {
    es: {
      APPROVAL_THRESHOLD: (c) => (c.limit ? `pasa de ${c.limit}, el monto que se paga sin revisión` : 'pasa del monto que se paga sin revisión'),
      HARD_CAP: (c) => (c.cap ? `pasa del tope por factura de ${c.cap}` : 'pasa del tope por factura'),
      BUDGET_EXCEEDED: () => 'ya no alcanza el presupuesto del mes',
      DUPLICATE: () => 'ya hay una factura con el mismo número de este proveedor',
      POSSIBLE_DUPLICATE: (c) => (c.dups ? `se parece a ${c.dups}: mismo proveedor y mismo monto en pocos días` : 'se parece a otra factura reciente del mismo proveedor y por el mismo monto'),
      SPLIT_SUSPECTED: (c) => (c.splitDays && c.limit ? `parece un cobro partido: con lo pagado a este proveedor en los últimos ${c.splitDays} días pasa de ${c.limit}` : 'parece un cobro partido en varias facturas'),
      PO_BALANCE_EXCEEDED: (c) => (c.poLeft ? `pasa de lo que queda en la orden de compra (${c.poLeft})` : 'pasa de lo que queda en la orden de compra'),
      NOT_APPROVABLE: () => 'tiene un problema que una aprobación no puede resolver',
      EXPIRED: () => 'nadie la revisó a tiempo',
      READINGS_DISAGREE: () => 'las lecturas de la factura no coinciden',
      UNREADABLE: () => 'no se pudo leer el documento',
      READER_FAILED: () => 'la lectura del documento falló',
      SUSPICIOUS_TEXT: () => 'el documento trae frases que intentan dar órdenes',
      CURRENCY_AMBIGUOUS: () => 'no dice en qué moneda está',
      LINES_MISMATCH: () => 'las líneas no suman el total',
      NEW_BENEFICIARY: () => 'el proveedor no está en tu lista de proveedores autorizados',
      VENDOR_INACTIVE: () => 'el proveedor está desactivado',
      ACCOUNT_MISMATCH: (c) => (c.accRead && c.accReg ? `la cuenta de pago (${c.accRead}) no es la registrada (${c.accReg})` : 'la cuenta de pago no es la registrada'),
      ACCOUNT_PENDING: () => 'la cuenta de pago todavía está por confirmar',
      NO_AGREEMENT: () => 'no hay contrato ni orden de compra con este proveedor',
      AGREEMENT_MISMATCH: (c) => (c.agreed ? `no cuadra con el contrato de ${c.agreed} al mes${c.tol != null ? ` (tolerancia de ${c.tol} %)` : ''}` : 'no cuadra con el contrato'),
      NO_FX_RATE: () => 'no hay tipo de cambio para su moneda',
      STALE_DATE: () => 'la fecha de la factura está fuera de rango',
      _: () => 'no cumplió una de tus reglas',
    },
    en: {
      APPROVAL_THRESHOLD: (c) => (c.limit ? `it is over ${c.limit}, the amount paid without review` : 'it is over the amount paid without review'),
      HARD_CAP: (c) => (c.cap ? `it is over the ${c.cap} cap per invoice` : 'it is over the cap per invoice'),
      BUDGET_EXCEEDED: () => 'the monthly budget no longer covers it',
      DUPLICATE: () => 'there is already an invoice with the same number from this vendor',
      POSSIBLE_DUPLICATE: (c) => (c.dups ? `it looks like ${c.dups}: same vendor and same amount within a few days` : 'it looks like another recent invoice from the same vendor for the same amount'),
      SPLIT_SUSPECTED: (c) => (c.splitDays && c.limit ? `it looks like a split charge: with what was paid to this vendor in the last ${c.splitDays} days it goes over ${c.limit}` : 'it looks like a charge split into several invoices'),
      PO_BALANCE_EXCEEDED: (c) => (c.poLeft ? `it is over what is left on the purchase order (${c.poLeft})` : 'it is over what is left on the purchase order'),
      NOT_APPROVABLE: () => 'it has a problem an approval cannot clear',
      EXPIRED: () => 'nobody reviewed it in time',
      READINGS_DISAGREE: () => 'the readings of the invoice do not match',
      UNREADABLE: () => 'the document could not be read',
      READER_FAILED: () => 'reading the document failed',
      SUSPICIOUS_TEXT: () => 'the document carries sentences that try to give orders',
      CURRENCY_AMBIGUOUS: () => 'it does not say which currency it is in',
      LINES_MISMATCH: () => 'the lines do not add up to the total',
      NEW_BENEFICIARY: () => 'the vendor is not on your approved vendors list',
      VENDOR_INACTIVE: () => 'the vendor is deactivated',
      ACCOUNT_MISMATCH: (c) => (c.accRead && c.accReg ? `the payment account (${c.accRead}) is not the registered one (${c.accReg})` : 'the payment account is not the registered one'),
      ACCOUNT_PENDING: () => 'the payment account is still pending confirmation',
      NO_AGREEMENT: () => 'there is no contract or purchase order with this vendor',
      AGREEMENT_MISMATCH: (c) => (c.agreed ? `it does not match the ${c.agreed} monthly contract${c.tol != null ? ` (${c.tol}% tolerance)` : ''}` : 'it does not match the contract'),
      NO_FX_RATE: () => 'there is no exchange rate for its currency',
      STALE_DATE: () => 'the invoice date is out of range',
      _: () => 'it did not meet one of your rules',
    },
  };
  /* Short labels for the "why" chart: a few words each, no codes. */
  const SHORT = {
    es: {
      APPROVAL_THRESHOLD: 'Pasa del monto sin revisión', HARD_CAP: 'Pasa del tope por factura', BUDGET_EXCEEDED: 'Sin presupuesto del mes', DUPLICATE: 'Factura repetida',
      POSSIBLE_DUPLICATE: 'Parecida a otra reciente', SPLIT_SUSPECTED: 'Parece un cobro partido', PO_BALANCE_EXCEEDED: 'Pasa del saldo de la orden', EXPIRED: 'Nadie la revisó a tiempo',
      READINGS_DISAGREE: 'Las lecturas no coinciden', UNREADABLE: 'No se pudo leer', READER_FAILED: 'Falló la lectura', SUSPICIOUS_TEXT: 'Trae frases con órdenes',
      CURRENCY_AMBIGUOUS: 'No dice la moneda', LINES_MISMATCH: 'Las líneas no suman', NEW_BENEFICIARY: 'Proveedor no autorizado', VENDOR_INACTIVE: 'Proveedor desactivado',
      ACCOUNT_MISMATCH: 'Cuenta distinta a la registrada', ACCOUNT_PENDING: 'Cuenta por confirmar', NO_AGREEMENT: 'Sin contrato ni orden', AGREEMENT_MISMATCH: 'No cuadra con el contrato',
      NO_FX_RATE: 'Sin tipo de cambio', STALE_DATE: 'Fecha fuera de rango', NOT_APPROVABLE: 'Aprobar no lo resuelve',
    },
    en: {
      APPROVAL_THRESHOLD: 'Over the no-review amount', HARD_CAP: 'Over the cap per invoice', BUDGET_EXCEEDED: 'Out of monthly budget', DUPLICATE: 'Repeated invoice',
      POSSIBLE_DUPLICATE: 'Like a recent one', SPLIT_SUSPECTED: 'Looks like a split charge', PO_BALANCE_EXCEEDED: 'Over the purchase order', EXPIRED: 'Nobody reviewed it in time',
      READINGS_DISAGREE: 'Readings do not match', UNREADABLE: 'Could not be read', READER_FAILED: 'Reading failed', SUSPICIOUS_TEXT: 'Text giving orders',
      CURRENCY_AMBIGUOUS: 'No currency stated', LINES_MISMATCH: 'Lines do not add up', NEW_BENEFICIARY: 'Vendor not approved', VENDOR_INACTIVE: 'Vendor deactivated',
      ACCOUNT_MISMATCH: 'Not the registered account', ACCOUNT_PENDING: 'Account not confirmed', NO_AGREEMENT: 'No contract or order', AGREEMENT_MISMATCH: 'Off the contract',
      NO_FX_RATE: 'No exchange rate', STALE_DATE: 'Date out of range', NOT_APPROVABLE: 'Approval cannot fix it',
    },
  };
  /* Reasons that hold an invoice (never paid, not even with an approval). */
  const HOLD_REASONS = new Set(['HARD_CAP', 'BUDGET_EXCEEDED', 'DUPLICATE', 'PO_BALANCE_EXCEEDED', 'NOT_APPROVABLE', 'EXPIRED']);
  /* Reasons an approval can clear (spec v3). Anything else stays after an approval. */
  const APPROVABLE = new Set(['APPROVAL_THRESHOLD', 'POSSIBLE_DUPLICATE', 'SPLIT_SUSPECTED', 'AGREEMENT_MISMATCH', 'NO_AGREEMENT', 'NEW_BENEFICIARY', 'STALE_DATE', 'READINGS_DISAGREE']);
  const TONE = { PAID: 'ok', PENDING: 'warn', HELD: 'stop', REJECTED: 'neutral', EXPIRED: 'neutral', VOIDED: 'neutral', ERROR: 'neutral', PROCESSING: 'neutral' };
  const GROUPS = { all: null, review: ['PENDING'], paid: ['PAID'], stopped: ['HELD', 'REJECTED', 'EXPIRED', 'VOIDED', 'ERROR'] };
  const GROUP_TONE = { all: null, review: 'warn', paid: 'ok', stopped: 'stop' };
  const RAIL = { SPEI: 'SPEI', PIX: 'Pix', BRE_B: 'Bre-B', ACH: 'ACH' };
  const COUNTRY = { MX: { cur: 'MXN', rail: 'SPEI', tax: 'RFC' }, CO: { cur: 'COP', rail: 'BRE_B', tax: 'NIT' }, BR: { cur: 'BRL', rail: 'PIX', tax: 'CNPJ' }, US: { cur: 'USD', rail: 'ACH', tax: 'EIN' } };
  const READ_FIELDS = ['issuer_tax_id', 'invoice_number', 'currency', 'total', 'payment_account'];
  const SETTINGS = [
    { id: 'when', fields: ['auto_approve_up_to_usd', 'contract_tolerance_pct', 'no_agreement'] },
    { id: 'limits', fields: ['hard_cap_per_invoice_usd', 'monthly_budget_usd'] },
    { id: 'repeat', fields: ['possible_duplicate_window_days', 'split_window_days'] },
    { id: 'dates', fields: ['stale_after_days', 'future_tolerance_days', 'pending_timeout_hours'] },
  ];
  const FIELD = {
    auto_approve_up_to_usd: { unit: 'usd', min: 0, max: 1e9 },
    contract_tolerance_pct: { unit: 'pct', min: 0, max: 50 },
    no_agreement_max_per_invoice_usd: { unit: 'usd', min: 0, max: 1e9 },
    no_agreement_max_per_month_usd: { unit: 'usd', min: 0, max: 1e10 },
    hard_cap_per_invoice_usd: { unit: 'usd', min: 0.01, max: 1e9 },
    monthly_budget_usd: { unit: 'usd', min: 0, max: 1e10 },
    possible_duplicate_window_days: { unit: 'days', min: 0, max: 90, int: true },
    split_window_days: { unit: 'days', min: 0, max: 90, int: true },
    stale_after_days: { unit: 'days', min: 1, max: 3650, int: true },
    future_tolerance_days: { unit: 'days', min: 0, max: 365, int: true },
    pending_timeout_hours: { unit: 'hours', min: 1, max: 1440, int: true },
  };
  const VIEWS = ['facturas', 'proveedores', 'ajustes', 'historial'];
  const ACTOR_RE = /^[\p{L}0-9._@ -]{2,60}$/u;

  const ICON = {
    ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.4 10.3l2.4 2.4 4.8-5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 5.8v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="13.9" r="1.05" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.4 14.6l9.2-9.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    neutral: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="6.1" r="1.05" fill="currentColor"/></svg>',
  };

  // ---------------------------------------------------------------- state and helpers
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const S = {
    lang: store.get('pc.lang', 'es') === 'en' ? 'en' : 'es',
    mode: 'live', summary: null, staticData: null, invMap: {}, filter: 'all', facet: null, view: 'facturas',
    selected: null, detail: null, detailToken: 0, techOpen: false, voidOpen: false,
    catalog: null, vForm: false, vEdit: null, rules: null, whatIf: null, audit: null, histLimit: 80,
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const t = (k) => (T[S.lang][k] ?? T.es[k] ?? k);
  const fill = (s, p = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] === undefined || p[k] === null ? '' : String(p[k])));
  const tf = (k, p) => fill(t(k), p);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  /** A person's note quoted inside a sentence: the sentence brings its own final period. */
  const quoted = (s) => String(s ?? '').trim().replace(/[.\s]+$/, '');
  const locale = () => (S.lang === 'es' ? 'es-MX' : 'en-US');
  const listJoin = (arr) => {
    const a = arr.filter(Boolean);
    if (a.length <= 1) return a[0] || '';
    const y = S.lang === 'es' ? ' y ' : ' and ';
    return `${a.slice(0, -1).join(', ')}${y}${a[a.length - 1]}`;
  };
  const writesOn = () => S.mode === 'live' && !!S.summary?.writes;
  const normName = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const actorName = (a) => (a === 'pagoclaro' ? 'PagoClaro' : a || t('someone'));

  function number(n, cur) {
    if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    const d = cur === 'COP' && Number.isInteger(v) ? 0 : 2;
    return v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function curLabel(cur) {
    if (cur === 'AMBIGUOUS') return t('curAmbiguous');
    if (cur === 'OTHER') return t('curOther');
    return cur || '';
  }
  const moneyText = (n, cur) => { const v = number(n, cur); return v ? `${v} ${curLabel(cur)}`.trim() : ''; };
  const moneyHtml = (n, cur) => { const v = number(n, cur); return v ? `<span class="money">${esc(v)}<span class="cur"> ${esc(curLabel(cur))}</span></span>` : `<span class="muted">${esc(t('noTotal'))}</span>`; };
  const plainNum = (n) => Number(n).toLocaleString(locale(), { maximumFractionDigits: 4 });
  /* Spanish uses a 24-hour clock: "15:10" reads cleaner than "03:10 p.m." in a sentence. */
  const dt = (iso, opts) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(locale(), opts.hour && S.lang === 'es' ? { ...opts, hourCycle: 'h23' } : opts).format(d);
  };
  const when = (iso) => dt(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dayShort = (iso) => dt(iso, { day: 'numeric', month: 'short' });
  const whenShort = (iso) => dt(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dateOnly = (iso) => dt(String(iso).length === 10 ? `${iso}T12:00:00` : iso, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeOnly = (iso) => dt(iso, { hour: '2-digit', minute: '2-digit' });
  const stWord = (st) => t(`st_${st}`);
  const chip = (st) => `<span class="chip t-${TONE[st] || 'neutral'}">${esc(stWord(st))}</span>`;
  const reasonText = (code, c = {}) => (REASONS[S.lang][code] || REASONS[S.lang]._)(c);

  /** Marks a button busy (spinner, disabled) while an async action runs. */
  async function busy(btn, label, fn) {
    if (!btn) return fn();
    const prev = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    if (label) btn.textContent = label;
    try { return await fn(); } finally {
      if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = prev; }
    }
  }
  function toast(msg, bad) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast${bad ? ' bad' : ''}`;
    el.setAttribute('role', bad ? 'alert' : 'status');
    el.hidden = false;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => { el.hidden = true; }, bad ? 7000 : 4500);
  }
  function announce(msg) { const el = $('#announce'); el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); }

  // ---------------------------------------------------------------- data
  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
    } catch {
      throw Object.assign(new Error(t('network')), { status: 0, code: 'NETWORK' });
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw Object.assign(new Error(body.message || `HTTP ${res.status}`), { status: res.status, code: body.error, body });
    return body;
  }
  function errText(e) {
    if (e.code === 'NETWORK') return t('network');
    if (e.status === 404 && (!e.code || e.code === 'Not Found')) return t('notYet');
    const k = `E_${e.code}`;
    if (T.es[k]) return tf(k, { msg: e.message });
    return e.message || t('network');
  }
  function canWrite() {
    if (S.mode === 'static') { toast(t('readOnly'), true); return false; }
    if (!S.summary?.writes) { toast(t('E_WRITES_DISABLED'), true); return false; }
    if (!ACTOR_RE.test($('#actor').value.trim())) { toast(t('needName'), true); $('#actor').focus(); return false; }
    if (!$('#accessCode').value.trim()) { toast(t('needCode'), true); $('#accessCode').focus(); return false; }
    return true;
  }
  /** Sends a write with the access code and the person's name. Returns null when it failed.
      onErr may show the error next to a field and return true to skip the toast. */
  async function write(method, path, body, btn, label, onErr) {
    if (!canWrite()) return null;
    return busy(btn, label, async () => {
      try {
        return await api(path, { method, headers: { 'x-access-code': $('#accessCode').value.trim() }, body: JSON.stringify({ actor: $('#actor').value.trim(), ...body }) });
      } catch (e) {
        if (!(onErr && onErr(e))) toast(errText(e), true);
        return null;
      }
    });
  }
  /** Shows an API error under a form field when it belongs to one. */
  const inlineErr = (map) => (e) => {
    const el = map[e.code];
    if (!el) return false;
    fieldError(el, errText(e));
    el.focus();
    return true;
  };
  async function loadSummary() {
    S.summary = S.mode === 'static' ? S.staticData.summary : await api('/api/summary');
    S.invMap = Object.fromEntries((S.summary.invoices || []).map((i) => [i.id, i]));
  }
  async function loadDetail(id) {
    if (S.mode === 'static') return S.staticData.details?.[id] || null;
    return api(`/api/invoices/${encodeURIComponent(id)}`);
  }

  // ---------------------------------------------------------------- shell
  function applyI18n() {
    document.documentElement.lang = S.lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    const lb = $('#langBtn');
    lb.textContent = t('langBtn');
    lb.setAttribute('lang', S.lang === 'es' ? 'en' : 'es');
    lb.setAttribute('aria-label', t('langAria'));
    const n = $('#staticNotice');
    const msg = S.mode === 'static' ? t('staticNotice') : S.summary && !S.summary.writes ? t('readOnlyServer') : '';
    n.hidden = !msg;
    n.innerHTML = msg ? `<p>${ICON.info}<span>${esc(msg)}</span></p>` : '';
    $('#who').hidden = !writesOn();
    const off = !writesOn();
    $('#pickBtn').disabled = off;
    $('#uploadHint').textContent = off ? t('uploadOff') : t('uploadHint');
    const titles = { facturas: 'navInvoices', proveedores: 'navVendors', ajustes: 'navSettings', historial: 'navHistory' };
    document.title = `PagoClaro · ${t(titles[S.view])}`;
  }
  function renderNav() {
    $$('.nav a').forEach((a) => (a.dataset.view === S.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const pending = (S.summary?.invoices || []).filter((i) => i.status === 'PENDING').length;
    const c = $('#navCount');
    c.hidden = !pending;
    c.innerHTML = `<span aria-hidden="true">${pending}</span><span class="sr">, ${pending} ${esc(t('f_review').toLowerCase())}</span>`;
  }

  // ---------------------------------------------------------------- Facturas
  function renderAlerts() {
    const m = S.summary.metrics || {};
    const items = [];
    for (const a of m.alerts || []) items.push(a.message || a.code);
    if (m.payments_out_of_rules > 0) items.push(tf('alertOut', { n: m.payments_out_of_rules }));
    if (m.audit_chain_ok === false) items.push(t('alertChain'));
    $('#alerts').innerHTML = items.map((x) => `<p class="alert">${ICON.warn}<span><b>${esc(t('attention'))}</b> ${esc(x)}</span></p>`).join('');
    $('#alerts').hidden = !items.length;
  }
  function inGroup(inv, g) { return !GROUPS[g] || GROUPS[g].includes(inv.status); }
  function renderSummary() {
    const inv = S.summary.invoices || [];
    const m = S.summary.metrics || {};
    const out = Number(m.payments_out_of_rules || 0);
    const btn = (g) => {
      const n = inv.filter((i) => inGroup(i, g)).length;
      const tone = GROUP_TONE[g];
      return `<button type="button" class="filter${tone ? ` t-${tone}` : ''}" data-filter="${g}" aria-pressed="${S.filter === g}"><span class="f-label">${tone ? '<i aria-hidden="true"></i>' : ''}${esc(t(`f_${g}`))}</span><span class="f-num">${n}</span></button>`;
    };
    $('#summary').innerHTML = `<div class="filters" role="group" aria-label="${esc(t('filterAria'))}">${['all', 'paid', 'review', 'stopped'].map(btn).join('')}</div>
      <div class="paid-total"><span class="f-label">${esc(t('amountPaid'))}</span><span class="f-num">${moneyHtml(m.usd_paid ?? 0, 'USD')}</span>
      <span class="trust${out ? ' bad' : ''}">${out ? ICON.stop : ICON.ok}${esc(tf('outOfRules', { n: out }))}</span></div>`;
  }
  /**
   * A chart's filter on top of the state filter: one reason (only what still needs a person, from the
   * Panorama, or every invoice it touched, from Ajustes), one vendor that was paid, or the invoices
   * waiting on an account to be confirmed.
   */
  function inFacet(inv) {
    const f = S.facet;
    if (!f) return true;
    if (f.kind === 'reason') return (inv.reasons || []).includes(f.value) && (f.scope === 'all' || WHY_STATES.has(inv.status));
    if (f.kind === 'account') return inv.status === 'PENDING' && (inv.reasons || []).includes('ACCOUNT_PENDING');
    return inv.status === 'PAID' && (inv.issuer_name || inv.filename) === f.value;
  }
  /** Pending first, the one that expires soonest on top. */
  function sortedInvoices() {
    const inv = (S.summary.invoices || []).filter((i) => inGroup(i, S.filter) && inFacet(i));
    const pend = inv.filter((i) => i.status === 'PENDING').sort((a, b) => String(a.expires_at || '9').localeCompare(String(b.expires_at || '9')));
    return [...pend, ...inv.filter((i) => i.status !== 'PENDING')];
  }
  /** The clock the data is read against: now, or the moment the static snapshot was taken. */
  function nowRef() {
    if (S.mode !== 'static') return Date.now();
    const ats = (S.summary?.invoices || []).map((i) => Date.parse(i.received_at)).filter(Number.isFinite);
    return ats.length ? Math.max(...ats) : Date.now();
  }
  function expiresIn(iso) {
    const h = Math.round((Date.parse(iso) - nowRef()) / 3_600_000);
    if (!Number.isFinite(h)) return '';
    if (h <= 0) return t('dueNow');
    return h < 48 ? tf('dueH', { h }) : tf('dueD', { d: Math.round(h / 24) });
  }

  // ---- charts: plain HTML and CSS, every number also written in words
  const WHY_STATES = new Set(['PENDING', 'HELD']);
  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
  const usdShort = (n) => `${Number(n).toLocaleString(locale(), { maximumFractionDigits: 0 })} USD`;
  const usdCompact = (n) => (n >= 1000 ? `${Number(n / 1000).toLocaleString(locale(), { maximumFractionDigits: n >= 10000 ? 0 : 1 })}k` : String(Math.round(n)));
  const pctTxt = (p) => `${p}${S.lang === 'es' ? ' ' : ''}%`;
  /** By number and by money: half of the invoices can be a quarter of the money. */
  function decidedChart(inv, m) {
    const groups = ['paid', 'review', 'stopped'].map((g) => {
      const mine = inv.filter((i) => inGroup(i, g));
      return { g, n: mine.length, usd: mine.reduce((a, i) => a + Number(i.amount_usd || 0), 0) };
    });
    const total = inv.length;
    const totalUsd = groups.reduce((a, s) => a + s.usd, 0);
    const bar = (key, label) => groups.filter((s) => s[key] > 0).map((s) => `<button type="button" class="seg t-${GROUP_TONE[s.g]}" style="flex-grow:${s[key]}" data-filter="${s.g}" aria-pressed="${S.filter === s.g}"
        aria-label="${esc(tf(key === 'n' ? 'c_segAria' : 'c_segUsdAria', { g: t(`f_${s.g}`), n: s.n, usd: usdShort(s.usd), p: pct(s[key], key === 'n' ? total : totalUsd) }))}"><span>${esc(label(s))}</span></button>`).join('');
    const legend = groups.filter((s) => s.n).map((s) => `<li class="t-${GROUP_TONE[s.g]}"><i aria-hidden="true"></i>${esc(t(`f_${s.g}`))} <b>${s.n}</b> <span class="usd">· ${esc(usdShort(s.usd))}</span></li>`).join('');
    const alone = m.processed ? `<p class="c-note">${esc(tf('c_alone', { n: m.decided_by_agent ?? 0, t: m.processed, p: plainNum(m.autonomy_pct ?? 0) }))}</p>` : '';
    const read = inv.filter((i) => i.readers);
    const agree = read.filter((i) => i.readers === 'agree').length;
    const tie = read.filter((i) => i.readers === 'tiebreak' || i.readers === 'second_reader').length;
    const readers = read.length ? `<p class="c-note">${esc(tie ? tf('c_readersTie', { a: agree, n: read.length, t: tie }) : tf('c_readers', { a: agree, n: read.length }))}</p>` : '';
    return `<div class="c-cell"><h4>${esc(t('c_decided'))}</h4>
      <p class="rowlab"><span>${esc(t('c_byCount'))}</span></p><div class="stack">${bar('n', (s) => s.n)}</div>
      ${totalUsd > 0 ? `<p class="rowlab"><span>${esc(t('c_byMoney'))}</span></p><div class="stack money">${bar('usd', (s) => usdCompact(s.usd))}</div>` : ''}
      <ul class="legend">${legend}</ul>${alone}${readers}</div>`;
  }
  function hbars(rows, max) {
    return `<ul class="hbars">${rows.map((r) => `<li><button type="button" class="hbar${r.tone ? ` t-${r.tone}` : ''}" ${r.data} aria-pressed="${r.on}" aria-label="${esc(r.aria)}">
      <span class="h-label">${esc(r.label)}</span><span class="h-val">${esc(r.value)}</span>
      <span class="h-track" aria-hidden="true"><span class="h-fill" style="--w:${Math.max(3, (r.n / max) * 100).toFixed(1)}%"></span></span></button></li>`).join('')}</ul>`;
  }
  function whyChart(inv) {
    const count = {};
    for (const i of inv) if (WHY_STATES.has(i.status)) for (const c of new Set(i.reasons || [])) if (c !== 'NOT_APPROVABLE') count[c] = (count[c] || 0) + 1;
    // What stops a payment for good reads first, then what a person can still clear.
    const all = Object.entries(count).sort((a, b) => Number(HOLD_REASONS.has(b[0])) - Number(HOLD_REASONS.has(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!all.length) return `<div class="c-cell"><h4>${esc(t('c_why'))}</h4><p class="c-empty">${esc(t('c_whyNone'))}</p></div>`;
    const top = all.slice(0, 5);
    const max = Math.max(...top.map(([, n]) => n));
    const rows = top.map(([code, n]) => {
      const label = SHORT[S.lang][code] || reasonText(code);
      return { label, value: String(n), n, tone: HOLD_REASONS.has(code) ? 'stop' : 'warn', data: `data-facet="reason" data-value="${esc(code)}"`, on: S.facet?.kind === 'reason' && S.facet.value === code, aria: tf('c_whyAria', { r: label, n }) };
    });
    const more = all.length > top.length ? `<p class="c-note">${esc(tf('c_whyMore', { n: all.length - top.length }))}</p>` : '';
    return `<div class="c-cell"><h4>${esc(t('c_why'))}</h4>${hbars(rows, max)}${more}</div>`;
  }
  /** What is already used, and where approving everything that waits would take the month. */
  function budgetChart(m, inv) {
    const b = m.budget;
    const head = `<h4>${esc(t('c_budget'))}${b?.period ? ` <span class="c-period">${esc(dt(`${b.period}-15T12:00:00`, { month: 'long', year: 'numeric' }))}</span>` : ''}</h4>`;
    if (!b || !b.budget_usd) return `<div class="c-cell">${head}<p class="c-empty">${esc(t('c_budgetNone'))}</p><a class="c-link" href="#ajustes">${esc(t('c_toSettings'))}</a></div>`;
    const waiting = inv.filter((i) => i.status === 'PENDING').reduce((a, i) => a + Number(i.amount_usd || 0), 0);
    const p = pct(b.committed_usd, b.budget_usd);
    const ifAll = b.committed_usd + waiting;
    const pAll = pct(ifAll, b.budget_usd);
    const tone = p >= 100 ? 'stop' : p >= 80 ? 'warn' : 'ok';
    const scale = Math.max(b.budget_usd, ifAll);
    const w = (v) => `${((v / scale) * 100).toFixed(2)}%`;
    const left = b.budget_usd - b.committed_usd;
    const line1 = tf('c_budgetLine', { used: usdShort(b.committed_usd), budget: usdShort(b.budget_usd) }) + ' ' + (left >= 0 ? tf('c_budgetLeft', { left: usdShort(left) }) : tf('c_budgetOver', { over: usdShort(-left) }));
    const line2 = waiting > 0 ? (ifAll > b.budget_usd ? tf('c_ifAllOver', { w: usdShort(waiting), all: usdShort(ifAll), over: usdShort(ifAll - b.budget_usd) }) : tf('c_ifAll', { w: usdShort(waiting), all: usdShort(ifAll), p: pctTxt(pAll) })) : '';
    return `<div class="c-cell">${head}
      <p class="c-big"><span class="money">${esc(plainNum(p))}<span class="cur"> %</span></span></p>
      <div class="bullet t-${tone}${ifAll > b.budget_usd ? ' over' : ''}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(p, 100)}" aria-label="${esc(tf('c_budgetAria', { p }))}">
        <span class="b-used" style="--w:${w(b.committed_usd)}"></span>${waiting > 0 ? `<span class="b-wait" style="--w:${w(waiting)}"></span>` : ''}</div>
      <p class="b-key"><span class="t-${tone}"><i aria-hidden="true"></i>${esc(t('c_kUsed'))}</span>${waiting > 0 ? `<span><i class="wait" aria-hidden="true"></i>${esc(t('c_kWaiting'))}</span>` : ''}</p>
      <p class="c-note">${esc(line1)}${line2 ? ` ${esc(line2)}` : ''}</p></div>`;
  }
  function paidChart(inv) {
    const by = new Map();
    for (const i of inv) {
      if (i.status !== 'PAID') continue;
      const k = i.issuer_name || i.filename;
      const e = by.get(k) || { usd: 0, n: 0 };
      e.usd += Number(i.amount_usd || 0);
      e.n += 1;
      by.set(k, e);
    }
    const all = [...by.entries()].sort((a, b) => b[1].usd - a[1].usd);
    if (!all.length) return `<div class="c-cell"><h4>${esc(t('c_paidTo'))}</h4><p class="c-empty">${esc(t('c_paidNone'))}</p></div>`;
    const top = all.slice(0, 5);
    const max = top[0][1].usd || 1;
    const rows = top.map(([name, e]) => {
      const nTxt = e.n === 1 ? t('c_paidN1') : tf('c_paidNn', { n: e.n });
      return { label: name, value: usdShort(e.usd), n: e.usd, tone: 'ok', data: `data-facet="vendor" data-value="${esc(name)}"`, on: S.facet?.kind === 'vendor' && S.facet.value === name, aria: tf('c_paidAria', { v: name, amt: usdShort(e.usd), n: nTxt }) };
    });
    const more = all.length > top.length ? `<p class="c-note">${esc(tf('c_paidMore', { n: all.length - top.length }))}</p>` : '';
    return `<div class="c-cell"><h4>${esc(t('c_paidTo'))}</h4>${hbars(rows, max)}${more}</div>`;
  }
  /** The person's real work: confirming new accounts, not reading invoices. */
  function unblockLine(inv) {
    const waiting = inv.filter((i) => i.status === 'PENDING' && (i.reasons || []).includes('ACCOUNT_PENDING'));
    if (!waiting.length) return '';
    const usd = waiting.reduce((a, i) => a + Number(i.amount_usd || 0), 0);
    const who = listJoin([...new Set(waiting.map((i) => i.issuer_name || i.filename))]).replace(/\.$/, '');
    const line = waiting.length === 1 ? tf('unblockLine1', { usd: usdShort(usd), who }) : tf('unblockLineN', { n: waiting.length, usd: usdShort(usd), who });
    return `<div class="unblock"><p>${ICON.warn}<span>${esc(line)}</span></p>
      <span class="actions"><button type="button" class="btn small" data-facet="account" data-value="ACCOUNT_PENDING" aria-pressed="${S.facet?.kind === 'account'}">${esc(t('unblockSee'))}</button><a class="btn primary small" href="#proveedores">${esc(t('unblockGo'))}</a></span></div>`;
  }
  function renderInsights() {
    const el = $('#insights');
    const inv = S.summary.invoices || [];
    if (!inv.length) { el.hidden = true; el.innerHTML = ''; return; }
    const m = S.summary.metrics || {};
    el.hidden = false;
    el.innerHTML = `<div class="ins-head"><h3 id="ins-h">${esc(t('insTitle'))}</h3><p>${esc(t('insHint'))} <a class="how-link" href="#ajustes">${esc(t('howLink'))}<span aria-hidden="true"> →</span></a></p></div>${unblockLine(inv)}
      <div class="ins-grid">${decidedChart(inv, m)}${paidChart(inv)}${whyChart(inv)}${budgetChart(m, inv)}</div>`;
  }
  function renderFacet() {
    const el = $('#facet');
    const f = S.facet;
    if (!f) { el.hidden = true; el.innerHTML = ''; return; }
    const label = f.kind === 'reason' ? tf('facetReason', { r: SHORT[S.lang][f.value] || reasonText(f.value) }) : f.kind === 'account' ? t('facetAccount') : tf('facetVendor', { v: f.value });
    el.hidden = false;
    el.innerHTML = `<p>${ICON.info}<span>${esc(label)}</span></p><button type="button" class="btn quiet small" data-action="facet-clear">${esc(t('facetClear'))}</button>`;
  }
  /** Points the list at what a chart bar stands for and keeps the charts' pressed state in step. */
  function syncFilters() {
    $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === S.filter)));
    $$('[data-facet]').forEach((b) => b.setAttribute('aria-pressed', String(!!S.facet && S.facet.kind === b.dataset.facet && S.facet.value === b.dataset.value)));
    renderFacet();
    renderRows();
  }
  /** What the agent did with the invoice, in order, in four steps a person reads at a glance. */
  function pathStrip(d) {
    const inv = d.invoice;
    const r = inv.readings || {};
    const ok = (x) => !!x && x.ok;
    const reasons = inv.pending?.reasons?.length ? inv.pending.reasons : inv.reasons || [];
    const steps = [{ tone: 'ok', k: t('p_received'), v: [dayShort(inv.received_at), inv.document?.kind ? t(`kind_${inv.document.kind}`) : ''].filter(Boolean).join(' · ') }];
    let read = ['neutral', t('p_readNone')];
    if (reasons.includes('UNREADABLE') || reasons.includes('READER_FAILED')) read = ['stop', t('p_readFail')];
    else if (reasons.includes('READINGS_DISAGREE')) read = ['warn', t('p_readDiff')];
    else if (r.tiebreak_role === 'tiebreak') read = ['ok', t('p_readTie')];
    else if (r.tiebreak_role === 'second_reader') read = ['ok', t('p_readSecond')];
    else if (ok(r.primary) && ok(r.check)) read = ['ok', t('p_readOk')];
    steps.push({ tone: read[0], k: t('p_read'), v: read[1] });
    const rules = inv.evaluation?.rules || [];
    if (rules.length) {
      const fails = rules.filter((x) => x.result === 'FAIL');
      const tone = fails.some((x) => x.outcome_if_fail === 'HOLD') ? 'stop' : fails.length ? 'warn' : 'ok';
      steps.push({ tone, k: t('p_rules'), v: tf('p_rulesV', { p: rules.length - fails.length, n: rules.length }) });
    } else steps.push({ tone: 'neutral', k: t('p_rules'), v: t('p_rulesNone') });
    const res = {
      PAID: ['ok', tf('p_paid', { rail: RAIL[inv.payment?.rail] || inv.payment?.rail || '' })],
      PENDING: ['warn', inv.pending?.expires_at ? tf('p_waitUntil', { d: when(inv.pending.expires_at) }) : t('p_wait')],
      HELD: ['stop', t('p_held')], REJECTED: ['neutral', t('p_rejected')], EXPIRED: ['neutral', t('p_expired')], VOIDED: ['neutral', t('p_voided')], ERROR: ['stop', t('p_error')],
    }[inv.status] || ['neutral', stWord(inv.status)];
    steps.push({ tone: res[0], k: t('p_result'), v: res[1] });
    return `<ol class="path" aria-label="${esc(t('p_title'))}">${steps.map((s) => `<li class="t-${s.tone}"><span class="p-dot">${ICON[s.tone]}</span><span class="p-k">${esc(s.k)}</span><span class="p-v">${esc(s.v)}</span></li>`).join('')}</ol>`;
  }
  /** The invoice against the no-review amount and the cap per invoice, with today's settings. */
  function limitsBlock(inv) {
    const r = S.summary?.rules;
    const usd = Number(inv.amount_usd);
    if (!r || !Number.isFinite(usd) || inv.amount_usd === null || inv.amount_usd === undefined) return '';
    const auto = Number(r.auto_approve_up_to_usd);
    const capV = Number(r.hard_cap_per_invoice_usd);
    const top = Math.max(capV, usd) * 1.04;
    const at = (v) => `${((v / top) * 100).toFixed(2)}%`;
    const amt = usdShort(usd);
    const paid = inv.status === 'PAID' || inv.status === 'VOIDED';
    const line = usd > capV ? tf('lim_overCap', { amt, cap: usdShort(capV) })
      : usd > auto ? tf(paid ? 'lim_overPaid' : 'lim_over', { amt, d: usdShort(usd - auto) })
      : tf('lim_under', { amt, p: plainNum(pct(usd, auto)) });
    const tone = usd > capV ? 'stop' : usd > auto && !paid ? 'warn' : 'ok';
    return `<section class="block"><h4>${esc(t('lim_title'))}</h4>
      <div class="limits t-${tone}" role="img" aria-label="${esc(tf('lim_aria', { amt, auto: usdShort(auto), cap: usdShort(capV) }))}">
        <span class="l-fill" style="--w:${at(usd)}"></span>
        <span class="l-mark${auto / top < 0.14 ? ' start' : ''}" style="left:${at(auto)}"><span>${esc(tf('lim_auto', { v: usdShort(auto) }))}</span></span>
        <span class="l-mark cap" style="left:${at(capV)}"><span>${esc(tf('lim_cap', { v: usdShort(capV) }))}</span></span>
      </div>
      <p class="l-line">${esc(line)}</p></section>`;
  }
  function listLine(i) {
    const s = i[`summary_${S.lang}`];
    if (s) return s;
    if (i.status === 'PENDING' || i.status === 'HELD') {
      const codes = (i.reasons || []).filter((c, k, a) => !(c === 'NOT_APPROVABLE' && a.length > 1));
      if (!codes.length) return stWord(i.status);
      const more = codes.length - 1;
      return `${cap(reasonText(codes[0]))}${more ? tf(more === 1 ? 'andMore' : 'andMoreN', { n: more }) : ''}.`;
    }
    return t(`l_${i.status}`);
  }
  function renderRows() {
    const all = S.summary.invoices || [];
    const inv = sortedInvoices();
    if (!all.length) { $('#rows').innerHTML = `<li class="list-empty">${esc(t('emptyAll'))}</li>`; return; }
    if (!inv.length) { $('#rows').innerHTML = `<li class="list-empty">${esc(t('emptyFilter'))}</li>`; return; }
    $('#rows').innerHTML = inv.map((i) => {
      const usd = i.currency !== 'USD' && i.amount_usd !== null && i.amount_usd !== undefined ? tf('approxUsd', { v: moneyText(i.amount_usd, 'USD') }) : '';
      return `<li><button type="button" class="row" data-id="${esc(i.id)}" aria-current="${S.selected === i.id}">
        <span class="who-line">${esc(i.issuer_name || i.filename)}</span>
        <span class="amount">${moneyHtml(i.total, i.currency)}</span>
        <span class="sub">${esc([i.invoice_number, dayShort(i.received_at)].filter(Boolean).join(' · '))}${i.status === 'PENDING' && i.expires_at ? ` · <b class="due">${esc(expiresIn(i.expires_at))}</b>` : ''}</span>
        <span class="sub r">${esc(usd)}</span>
        <span class="state">${chip(i.status)}<span class="why">${esc(listLine(i))}</span></span>
      </button></li>`;
    }).join('');
  }

  // ---- detail
  function readingOf(inv, which) { const r = inv.readings?.[which]; return r && r.ok ? r : null; }
  function usedReading(inv) { return (readingOf(inv, inv.reading_used || 'primary') || readingOf(inv, 'primary') || readingOf(inv, 'check'))?.reading || null; }
  function ruleOf(inv, code) { return (inv.evaluation?.rules || []).find((r) => r.rule === code) || null; }
  function ctxOf(inv) {
    const c = {};
    const rules = S.summary?.rules;
    const sameRules = rules && (!inv?.evaluation || inv.evaluation.policy_version === rules.version);
    if (sameRules) {
      if (rules.auto_approve_up_to_usd != null) c.limit = moneyText(rules.auto_approve_up_to_usd, 'USD');
      if (rules.hard_cap_per_invoice_usd != null) c.cap = moneyText(rules.hard_cap_per_invoice_usd, 'USD');
      if (rules.contract_tolerance_pct != null) c.tol = plainNum(rules.contract_tolerance_pct);
      if (rules.split_window_days != null) c.splitDays = rules.split_window_days;
    }
    if (!inv) return c;
    const a = inv.agreement;
    if (a && a.kind === 'CONTRACT' && a.amount_per_period != null) c.agreed = moneyText(a.amount_per_period, a.currency);
    if (a && a.kind === 'PURCHASE_ORDER' && a.remaining != null) c.poLeft = moneyText(a.remaining, a.currency);
    const r = usedReading(inv);
    if (r?.payment_account && inv.vendor?.account) { c.accRead = r.payment_account; c.accReg = inv.vendor.account; }
    const dups = (inv.ledger?.possible_duplicates || []).map((d) => d.invoice_number).filter(Boolean);
    if (dups.length) c.dups = listJoin(dups.slice(0, 3));
    return c;
  }
  /** Codes that kept an approved invoice from being paid (escalations an approval cannot clear). */
  function blockedCodes(inv) {
    return (inv.evaluation?.rules || []).filter((r) => r.result === 'FAIL' && r.outcome_if_fail === 'ESCALATE' && r.rule !== 'NOT_APPROVABLE').map((r) => r.rule);
  }
  function verdict(d) {
    const inv = d.invoice;
    const st = inv.status;
    const s = S.invMap[inv.id]?.[`summary_${S.lang}`] || inv[`summary_${S.lang}`];
    if (s) return { text: s, items: [] };
    const c = ctxOf(inv);
    const approval = inv.evaluation?.approval || null;
    const who = approval?.approver;
    const phr = (codes) => codes.map((x) => reasonText(x, c));
    if (st === 'PAID') return { text: who ? tf('v_PAIDby', { who }) : t('v_PAID'), items: [] };
    if (st === 'PENDING') {
      const codes = inv.pending?.reasons?.length ? inv.pending.reasons : inv.reasons || [];
      const p = phr(codes);
      return p.length > 1 ? { text: tf('v_PENDINGn', { n: p.length }), items: p.map(cap) } : { text: tf('v_PENDING1', { r: p[0] || reasonText('_') }), items: [] };
    }
    if (st === 'HELD') {
      let codes = (inv.reasons || []).filter((x) => x !== 'NOT_APPROVABLE');
      const blocked = (inv.reasons || []).includes('NOT_APPROVABLE') ? blockedCodes(inv) : [];
      codes = [...new Set([...codes, ...blocked])];
      const p = phr(codes.length ? codes : ['NOT_APPROVABLE']);
      if (who) {
        if (p.length > 1) return { text: tf('v_HELDbyN', { who }), items: p.map(cap) };
        return { text: tf('v_HELDby1', { who, r: p[0] }) + (blocked.length ? t('v_HELDbyBlocked') : ''), items: [] };
      }
      return p.length > 1 ? { text: tf('v_HELDn', { n: p.length }), items: p.map(cap) } : { text: tf('v_HELD1', { r: p[0] }), items: [] };
    }
    if (st === 'REJECTED') {
      const e = [...(d.audit || [])].reverse().find((x) => x.type === 'decision.rejected');
      const by = inv.pending?.resolved_by || e?.actor || t('someone');
      const why = e?.data?.reason;
      return { text: why ? tf('v_REJECTEDwhy', { who: by, why: quoted(why) }) : tf('v_REJECTED', { who: by }), items: [] };
    }
    if (st === 'VOIDED') return { text: tf('v_VOIDED', { who: inv.payment?.voided_by || t('someone') }), items: [] };
    return { text: t(`v_${st}`), items: [] };
  }
  function readingsChoice(inv, pend) {
    const opts = ['primary', 'check', 'tiebreak'].map((w) => [w, readingOf(inv, w)]).filter(([, r]) => r);
    if (opts.length < 2) return '';
    const val = (r, k) => (k === 'total' ? moneyText(r.reading.total, r.reading.currency) : k === 'currency' ? curLabel(r.reading.currency) : r.reading[k] ?? '');
    let diff = READ_FIELDS.filter((k) => new Set(opts.map(([, r]) => String(val(r, k)))).size > 1);
    if (!diff.length) diff = ['total', 'payment_account'];
    const pick = pend.suggested_reading || 'primary';
    const cards = opts.map(([w, r]) => `<label class="choice"><input type="radio" name="reading" value="${w}"${w === pick ? ' checked' : ''}>
      <span><b>${esc(t(`r_${w}`))}</b>${w === pend.suggested_reading ? `<span class="tag">${esc(t('suggested'))}</span>` : ''}
      <dl>${diff.map((k) => `<dt>${esc(t(`fl_${k}`))}</dt><dd>${esc(val(r, k)) || esc(t('t_none'))}</dd>`).join('')}</dl></span></label>`).join('');
    return `<fieldset class="choices"><legend>${esc(t('chooseTitle'))}</legend><p class="help">${esc(t('chooseHelp'))}</p>${cards}</fieldset>`;
  }
  function decideBlock(d, pend) {
    const inv = d.invoice;
    const codes = pend.reasons?.length ? pend.reasons : inv.reasons || [];
    const blocked = codes.filter((x) => !APPROVABLE.has(x));
    const c = ctxOf(inv);
    const notes = [];
    if (blocked.length) {
      const fix = blocked.includes('ACCOUNT_PENDING') ? ` ${t('fixPending')}` : blocked.includes('ACCOUNT_MISMATCH') ? ` ${t('fixAccount')}` : '';
      notes.push(`${tf('blockedWarn', { r: listJoin(blocked.map((x) => reasonText(x, c))) })}${fix}`);
    }
    if (writesOn() && inv.uploaded_by && normName(inv.uploaded_by) === normName($('#actor').value)) notes.push(t('selfUpload'));
    const off = !writesOn();
    const choice = codes.includes('READINGS_DISAGREE') ? readingsChoice(inv, pend) : '';
    const expires = pend.expires_at ? ` ${tf('expiresHelp', { d: when(pend.expires_at) })}` : '';
    return `<section class="block decide" aria-labelledby="dec-h"><h4 id="dec-h">${esc(t('decideTitle'))}</h4>
      ${notes.map((n) => `<p class="warn-line">${ICON.warn}<span>${esc(n)}</span></p>`).join('')}
      ${choice}
      <label class="field"><span>${esc(t('note'))}</span><textarea id="note" maxlength="500" placeholder="${esc(t('notePh'))}"${off ? ' disabled' : ''}></textarea></label>
      <div class="actions"><button class="btn primary" type="button" data-action="approve"${off ? ' disabled' : ''}>${esc(t('approve'))}</button><button class="btn danger" type="button" data-action="reject"${off ? ' disabled' : ''}>${esc(t('reject'))}</button></div>
      <p class="help">${esc(off ? t('staticDecide') : t('approveHelp') + expires)}</p></section>`;
  }
  function paymentBlock(inv) {
    const p = inv.payment;
    const lines = [`<p class="payline">${esc(tf('payLine', { rail: RAIL[p.rail] || p.rail, amt: moneyText(p.amount, p.currency), acc: p.account_masked || '' }))}</p>`, `<p class="payline muted">${esc(t('paySim'))}</p>`];
    if (p.voided_at) lines.push(`<p class="payline">${esc(tf('payVoided', { who: p.voided_by || t('someone'), d: when(p.voided_at) }))}</p>`);
    let act = '';
    if (!p.voided_at && writesOn()) {
      act = S.voidOpen
        ? `<div class="confirm-box"><p>${esc(t('voidAsk'))}</p><label class="field"><span>${esc(t('voidReason'))}</span><input id="voidReason" maxlength="500"></label>
           <div class="actions"><button class="btn danger" type="button" data-action="void-do" data-pay="${esc(p.id)}">${esc(t('voidConfirm'))}</button><button class="btn quiet" type="button" data-action="void-cancel">${esc(t('voidKeep'))}</button></div></div>`
        : `<div class="actions" style="margin-top:12px"><button class="btn danger small" type="button" data-action="void-open">${esc(t('voidPay'))}</button></div>`;
    }
    return `<section class="block"><h4>${esc(t('payTitle'))}</h4>${lines.join('')}${act}</section>`;
  }
  function agreementText(a) {
    if (!a) return t('agrNone');
    if (a.kind === 'CONTRACT') return tf('agrContract', { amt: moneyText(a.amount_per_period, a.currency) });
    return tf('agrPO', { rem: moneyText(a.remaining, a.currency), tot: moneyText(a.total, a.currency) });
  }
  function factsBlock(inv) {
    const r = usedReading(inv);
    const rows = [];
    const v = inv.vendor;
    rows.push([t('k_vendor'), v ? `${esc(v.name)} <span class="note">· ${esc(v.status === 'inactive' ? t('vendorOff') : t('vendorOk'))}</span>` : `<span class="bad">${esc(t('vendorNone'))}</span>`]);
    if (r?.payment_account) {
      const rule = ruleOf(inv, 'ACCOUNT_MISMATCH');
      const tail = rule ? (rule.result === 'PASS' ? ` <span class="note">· ${esc(t('accOk'))}</span>` : ` <span class="bad">· ${esc(tf('accBad', { acc: v?.account || '' }))}</span>`) : '';
      rows.push([t('k_account'), `${esc(r.payment_account)}${tail}`]);
    }
    if (v) rows.push([t('k_agreement'), esc(agreementText(inv.agreement))]);
    if (inv.fx && inv.currency && inv.currency !== 'USD') rows.push([t('k_rate'), `1 ${esc(inv.currency)} = ${esc(plainNum(inv.fx.rate))} USD <span class="note">· ${esc(dateOnly(inv.fx.rate_date))}</span>`]);
    if (r?.issue_date) rows.push([t('k_dates'), esc(r.due_date ? tf('datesLine', { d: dateOnly(r.issue_date), due: dateOnly(r.due_date) }) : dateOnly(r.issue_date))]);
    const kind = inv.document?.kind ? ` <span class="note">· ${esc(t(`kind_${inv.document.kind}`))}</span>` : '';
    rows.push([t('k_doc'), `${esc(inv.document?.filename || '')}${kind}`]);
    return `<section class="block"><h4>${esc(t('factsTitle'))}</h4><dl class="facts">${rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${val}</dd>`).join('')}</dl></section>`;
  }
  function historyEntries(d) {
    if (Array.isArray(d.history) && d.history.length) {
      const byAt = new Map((d.audit || []).map((e) => [`${e.at}|${e.actor}`, e]));
      return d.history.map((h) => ({ ...(byAt.get(`${h.at}|${h.actor}`) || {}), ...h }));
    }
    return d.audit || [];
  }
  function entryText(e) {
    const own = e[`summary_${S.lang}`];
    if (own) return own;
    const d = e.data || {};
    const who = actorName(e.actor);
    const inv = S.invMap[e.invoice_id];
    const num = d.invoice_number || inv?.invoice_number || d.filename || inv?.filename || t('theInvoice');
    const codes = (d.reasons || []).filter((x) => x !== 'NOT_APPROVABLE');
    const r = listJoin(codes.map((x) => reasonText(x)));
    const amt = d.payment ? moneyText(d.payment.amount, d.payment.currency) : moneyText(d.total, d.currency);
    switch (e.type) {
      case 'invoice.received': return tf('h_received', { who, file: d.filename || num });
      case 'decision.pay': return e.actor === 'pagoclaro' ? tf('h_paidAuto', { num, amt }) : tf('h_paidBy', { num, amt, who });
      case 'decision.hold': {
        if (e.actor !== 'pagoclaro') {
          const blocked = (d.evaluation?.rules || []).filter((x) => x.result === 'FAIL' && x.outcome_if_fail === 'ESCALATE' && x.rule !== 'NOT_APPROVABLE').map((x) => x.rule);
          const all = [...new Set([...codes, ...blocked])];
          return tf('h_holdBy', { num, who, r: listJoin(all.map((x) => reasonText(x))) || reasonText('NOT_APPROVABLE') });
        }
        return r ? tf('h_hold', { num, r }) : tf('h_holdPlain', { num });
      }
      case 'decision.expired': return tf('h_expired', { num });
      case 'decision.escalate': return r ? tf('h_escalate', { num, r }) : tf('h_escalatePlain', { num });
      case 'invoice.unconfirmed': return tf('h_unconfirmed', { num, r: r || reasonText('_') });
      case 'invoice.error': return tf('h_error', { num });
      case 'approval.received': return d.note ? tf('h_approvedNote', { who, num, note: quoted(d.note) }) : tf('h_approved', { who, num });
      case 'approval.refused': return tf('h_refused', { who, num });
      case 'decision.rejected': return tf('h_rejected', { who, num, why: quoted(d.reason) });
      case 'payment.voided': return tf('h_voided', { who, num, why: quoted(d.reason) });
      case 'rules.loaded': return tf('h_rulesLoaded', { v: d.version });
      case 'rules.changed': return tf('h_rulesChanged', { who, v: d.version });
      default:
        if (String(e.type || '').startsWith('vendor')) {
          const name = d.name || d.vendor?.name || d.vendor_name;
          return tf('h_vendor', { who, name: name ? ` (${name})` : '' });
        }
        return tf('h_generic', { who });
    }
  }
  function timelineHtml(entries, withLinks) {
    return `<ol class="timeline${withLinks ? '' : ' full'}">${entries.map((e) => `<li class="${e.actor === 'pagoclaro' ? 'by-agent' : ''}"><time datetime="${esc(e.at)}">${esc(withLinks ? timeOnly(e.at) : whenShort(e.at))}</time>
      <div class="txt">${esc(entryText(e))}${withLinks && e.invoice_id && S.invMap[e.invoice_id] ? ` <a href="#facturas/${esc(e.invoice_id)}">${esc(t('seeInvoice'))}</a>` : ''}</div></li>`).join('')}</ol>`;
  }
  function techBlock(d) {
    const inv = d.invoice;
    const parts = [];
    const reads = ['primary', 'check', 'tiebreak'].map((w) => [w, inv.readings?.[w]]).filter(([, r]) => r);
    if (reads.length) {
      const keys = ['issuer_name', 'issuer_tax_id', 'invoice_number', 'issue_date', 'due_date', 'currency', 'total', 'payment_account', 'lines', 'suspicious_text'];
      const cell = (r, k) => {
        if (!r || !r.ok) return '';
        const v = r.reading[k];
        if (k === 'lines') return (v || []).map((l) => `${l.description}: ${number(l.amount)}`).join(' | ');
        if (k === 'suspicious_text') return (v || []).join(' | ');
        if (k === 'total') return number(v);
        return v ?? '';
      };
      const head = reads.map(([w, r]) => `<th>${esc(t(`r_${w}`))}<br>${esc(r.ok ? r.model : `${t('t_none')} (${r.error || ''})`)}</th>`).join('');
      const body = keys.map((k) => {
        const vals = reads.map(([, r]) => cell(r, k));
        const differ = new Set(vals.map(String)).size > 1 && ['issuer_tax_id', 'invoice_number', 'currency', 'total', 'payment_account'].includes(k);
        return `<tr><th scope="row">${esc(t(`fl_${k}`))}</th>${vals.map((v, i) => `<td class="${differ && i > 0 && String(v) !== String(vals[0]) ? 'diff' : ''}">${esc(v)}${differ && i > 0 && String(v) !== String(vals[0]) ? ' ≠' : ''}</td>`).join('')}</tr>`;
      }).join('');
      parts.push(`<div><h5>${esc(t('t_readings'))}</h5><div class="scroll"><table><thead><tr><th>${esc(t('t_field'))}</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`);
    }
    const ev = inv.evaluation;
    if (ev?.rules?.length) {
      const rank = (r) => (r.result === 'FAIL' ? 0 : r.lifted_by ? 1 : 2);
      const rows = [...ev.rules].sort((a, b) => rank(a) - rank(b)).map((r) => {
        const res = r.result === 'PASS' ? (r.lifted_by ? tf('t_lifted', { who: r.lifted_by }) : 'PASS') : `FAIL → ${r.outcome_if_fail}`;
        const cls = r.result === 'PASS' ? (r.lifted_by ? 'res-LIFT' : 'res-PASS') : 'res-FAIL';
        return `<tr class="rule-row"><td>${esc(r.rule)}</td><td class="${cls}">${esc(res)}</td><td class="msg">${esc(S.lang === 'es' ? r.message_es : r.message_en)}</td></tr>`;
      }).join('');
      parts.push(`<div><h5>${esc(tf('t_rules', { v: ev.policy_version }))}</h5><div class="scroll"><table><thead><tr><th>${esc(t('t_rule'))}</th><th>${esc(t('t_result'))}</th><th>${esc(t('t_msg'))}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
    }
    if (inv.provenance && Object.keys(inv.provenance).length) {
      parts.push(`<div><h5>${esc(t('t_prov'))}</h5><div class="scroll"><table><tbody>${Object.entries(inv.provenance).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v.tag)}</td><td>${esc(v.cite)}</td></tr>`).join('')}</tbody></table></div></div>`);
    }
    const doc = inv.document || {};
    const fx = inv.fx ? `fx ${inv.fx.rate} (${inv.fx.rate_date}) · ${inv.fx.source}` : '';
    parts.push(`<div><h5>${esc(t('t_doc'))}</h5><div class="scroll"><table><tbody>
      <tr><th scope="row">id</th><td>${esc(inv.id)}</td></tr><tr><th scope="row">file</th><td>${esc(doc.filename)} · ${esc(doc.kind)} · ${esc(doc.media_type || '')} · ${esc(doc.size ?? '')} B</td></tr>
      <tr><th scope="row">sha256</th><td>${esc(doc.sha256 || '')}</td></tr>${fx ? `<tr><th scope="row">fx</th><td>${esc(fx)}</td></tr>` : ''}
      ${inv.payment ? `<tr><th scope="row">payment</th><td>${esc(inv.payment.id)} · ${esc(inv.payment.rail)} · idempotency ${esc(inv.payment.idempotency_key || '')}</td></tr>` : ''}</tbody></table></div></div>`);
    if (d.audit?.length) {
      parts.push(`<div><h5>${esc(t('t_log'))}</h5><div class="scroll"><table><tbody>${d.audit.map((e) => `<tr><td>#${esc(e.seq)}</td><td>${esc(e.type)}</td><td>${esc(e.actor)}</td><td>${esc(String(e.hash || '').slice(0, 16))}… ← ${esc(String(e.prev_hash || '').slice(0, 10))}…</td></tr>`).join('')}</tbody></table></div></div>`);
    }
    return `<details class="tech" id="techDetails"${S.techOpen ? ' open' : ''}><summary>${esc(t('techTitle'))}</summary><div class="tech-body">${parts.join('')}</div></details>`;
  }
  function renderDetail() {
    const el = $('#detail');
    const d = S.detail;
    el.removeAttribute('aria-busy');
    if (!d || !d.invoice) { el.innerHTML = `<p class="empty">${esc(t('pickOne'))}</p>`; return; }
    const inv = d.invoice;
    const st = inv.status;
    const tone = TONE[st] || 'neutral';
    const v = verdict(d);
    const pend = inv.pending && !inv.pending.resolved_at && st === 'PENDING' ? inv.pending : null;
    const susp = [...new Set(['primary', 'check', 'tiebreak'].flatMap((w) => readingOf(inv, w)?.reading?.suspicious_text || []))];
    const meta = [inv.invoice_number ? tf('invoiceN', { n: inv.invoice_number }) : '', tf('arrived', { d: when(inv.received_at) }), inv.uploaded_by ? tf('uploadedBy', { who: inv.uploaded_by }) : ''].filter(Boolean).join(' · ');
    const usd = inv.currency !== 'USD' && inv.amount_usd !== null && inv.amount_usd !== undefined ? `<span class="usd">${esc(tf('approxUsd', { v: moneyText(inv.amount_usd, 'USD') }))}</span>` : '';
    const html = [];
    html.push(`<button class="btn quiet small back" type="button" data-action="back">${esc(t('backToList'))}</button>`);
    html.push(`<div class="d-top"><div><h3 id="d-title">${esc(inv.issuer_name || inv.document?.filename || '')}</h3><p class="d-meta">${esc(meta)}</p></div>${chip(st)}</div>`);
    html.push(`<div class="d-money"><span class="big">${moneyHtml(inv.total, inv.currency)}</span>${usd}</div>`);
    html.push(pathStrip(d));
    html.push(`<div class="verdict t-${tone}">${ICON[tone]}<div><p>${esc(v.text)}</p>${v.items.length ? `<ul>${v.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${susp.length ? `<div class="quote"><span class="eyebrow">${esc(t('suspicious'))}</span>${susp.map((x) => `<q>${esc(x)}</q>`).join('')}</div>` : ''}</div></div>`);
    if (pend) html.push(decideBlock(d, pend));
    if (inv.payment) html.push(paymentBlock(inv));
    html.push(limitsBlock(inv));
    html.push(factsBlock(inv));
    const hist = historyEntries(d);
    if (hist.length) html.push(`<section class="block"><h4>${esc(t('histTitle'))}</h4>${timelineHtml(hist, false)}</section>`);
    html.push(techBlock(d));
    el.innerHTML = html.join('');
    $('#techDetails')?.addEventListener('toggle', (e) => { S.techOpen = e.target.open; });
  }
  async function select(id, opts = {}) {
    S.selected = id;
    S.voidOpen = false;
    $$('#rows .row').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)));
    if (opts.hash !== false) history.replaceState(null, '', `#facturas/${id}`);
    const token = ++S.detailToken;
    $('#detail').setAttribute('aria-busy', 'true');
    let d = null;
    try { d = await loadDetail(id); } catch (e) { if (token === S.detailToken) { $('#detail').removeAttribute('aria-busy'); toast(errText(e), true); } return; }
    if (token !== S.detailToken) return;
    S.detail = d;
    renderDetail();
    if (d?.invoice) announce(tf('showing', { n: d.invoice.invoice_number || d.invoice.document?.filename || '', st: stWord(d.invoice.status) }));
    if (opts.scroll && window.matchMedia('(max-width: 1060px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderFacturas() {
    renderAlerts();
    renderSummary();
    renderInsights();
    renderFacet();
    renderRows();
    renderDetail();
  }
  async function refreshInvoices() {
    await loadSummary();
    renderNav();
    renderAlerts();
    renderSummary();
    renderInsights();
    renderFacet();
    renderRows();
    if (S.selected && S.invMap[S.selected]) await select(S.selected, { hash: false });
    else renderDetail();
  }

  // ---- actions on invoices
  async function upload(file) {
    if (!canWrite()) return;
    if (file.size > 10 * 1024 * 1024) { toast(t('tooBig'), true); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const r = await write('POST', '/api/invoices', { file_name: file.name, content_base64: btoa(bin) }, $('#pickBtn'), t('reading'));
    if (!r) return;
    toast(tf('uploadedToast', { st: stWord(r.status) }));
    S.filter = 'all';
    S.facet = null;
    S.selected = r.invoice_id || S.selected;
    await refreshInvoices();
  }
  async function approve(btn) {
    const inv = S.detail?.invoice;
    if (!inv) return;
    const note = $('#note')?.value.trim();
    const choice = $('input[name="reading"]:checked')?.value;
    const r = await write('POST', `/api/invoices/${encodeURIComponent(inv.id)}/approve`, { ...(note ? { note } : {}), ...(choice ? { confirm_reading: choice } : {}) }, btn, t('approving'));
    if (!r) return;
    toast(r.status === 'PAID' ? t('approvedPaid') : tf('approvedNot', { st: stWord(r.status || 'HELD') }));
    await refreshInvoices();
  }
  async function reject(btn) {
    const inv = S.detail?.invoice;
    if (!inv) return;
    const note = $('#note')?.value.trim() || '';
    const r = await write('POST', `/api/invoices/${encodeURIComponent(inv.id)}/reject`, { reason: note.length >= 3 ? note : t('rejectDefault') }, btn, t('rejecting'));
    if (!r) return;
    toast(t('rejectedToast'));
    await refreshInvoices();
  }
  async function voidPayment(btn) {
    const reason = $('#voidReason')?.value.trim() || '';
    const r = await write('POST', `/api/payments/${encodeURIComponent(btn.dataset.pay)}/void`, { reason: reason.length >= 3 ? reason : t('voidDefault') }, btn, t('voiding'));
    if (!r) return;
    S.voidOpen = false;
    toast(t('voidedToast'));
    await refreshInvoices();
  }

  // ---------------------------------------------------------------- Proveedores
  function normVendor(v) {
    const p = v.pending_account;
    const po = p && typeof p === 'object' ? p : null;
    return {
      ...v,
      pending_account: po ? po.account_masked || po.account || null : p || null,
      pending_changed_by: v.pending_changed_by ?? po?.changed_by ?? null,
      pending_changed_at: v.pending_changed_at ?? po?.changed_at ?? null,
      pending_reason: v.pending_reason ?? po?.reason ?? null,
      waiting_invoices: Number.isFinite(v.waiting_invoices) ? v.waiting_invoices : null,
    };
  }
  function pageHead(id, title, lead, extra = '') {
    return `<header class="page-head"><div><h2 id="h-${id}" tabindex="-1">${esc(title)}</h2>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>${extra}</header>`;
  }
  function countryOptions(sel) { return Object.keys(COUNTRY).map((c) => `<option value="${c}"${c === sel ? ' selected' : ''}>${esc(t(`c_${c}`))}</option>`).join(''); }
  function railOptions(sel) { return Object.keys(RAIL).map((r) => `<option value="${r}"${r === sel ? ' selected' : ''}>${esc(RAIL[r])}</option>`).join(''); }
  function currencyOptions(sel) { return ['MXN', 'COP', 'BRL', 'USD'].map((c) => `<option value="${c}"${c === sel ? ' selected' : ''}>${c}</option>`).join(''); }
  function addForm() {
    const c = 'MX';
    const k = COUNTRY[c];
    return `<form class="sheet add-form" data-form="add" novalidate><h3>${esc(t('addTitle'))}</h3><p>${esc(t('addLead'))}</p>
      <div class="grid-form">
        <label class="field span2"><span>${esc(t('vName'))}</span><input name="name" required maxlength="120" autocomplete="organization"></label>
        <label class="field"><span>${esc(t('vCountry'))}</span><select name="country">${countryOptions(c)}</select></label>
        <label class="field"><span data-tax-label>${esc(tf('vTax', { label: k.tax }))}</span><input name="tax_id" required maxlength="40" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span>${esc(t('vCurrency'))}</span><select name="currency">${currencyOptions(k.cur)}</select></label>
        <label class="field"><span>${esc(t('vRail'))}</span><select name="rail">${railOptions(k.rail)}</select></label>
        <label class="field span2"><span>${esc(t('vAccount'))}</span><input name="account" required maxlength="80" autocomplete="off" spellcheck="false"><small data-acc-hint>${esc(t(`acc_${k.rail}`))}</small></label>
      </div>
      <div class="actions"><button class="btn primary" type="submit">${esc(t('addSave'))}</button><button class="btn quiet" type="button" data-action="v-close">${esc(t('cancel'))}</button></div></form>`;
  }
  /** How much of a purchase order is used, and what waits for a decision on top of it. */
  function poBar(a, v) {
    if (a.kind !== 'PURCHASE_ORDER' || a.total == null || a.remaining == null || !(a.total > 0)) return '';
    const used = Math.max(0, a.total - a.remaining);
    const waiting = (S.summary?.invoices || []).filter((i) => i.status === 'PENDING' && i.vendor_id === v.id && i.currency === a.currency).reduce((s, i) => s + Number(i.total || 0), 0);
    const over = used + waiting > a.total;
    const scale = Math.max(a.total, used + waiting);
    const w = (x) => `${((x / scale) * 100).toFixed(2)}%`;
    const pUsed = pct(used, a.total);
    const tone = over ? 'stop' : pUsed >= 80 ? 'warn' : 'ok';
    const line = tf('poLine', { used: moneyText(used, a.currency), total: moneyText(a.total, a.currency), p: pctTxt(pUsed) }) + (waiting ? ` ${tf(over ? 'poWaitOver' : 'poWait', { w: moneyText(waiting, a.currency) })}` : '');
    return `<div class="bullet t-${tone}${over ? ' over' : ''}" role="img" aria-label="${esc(line)}"><span class="b-used" style="--w:${w(used)}"></span>${waiting ? `<span class="b-wait" style="--w:${w(waiting)}"></span>` : ''}</div><p class="po-line">${esc(line)}</p>`;
  }
  function vendorRow(raw, agreements) {
    const v = normVendor(raw);
    const off = v.status === 'inactive';
    const agr = agreements.filter((a) => a.vendor_id === v.id && a.status !== 'closed');
    const tax = COUNTRY[v.country]?.tax || '';
    const editing = S.vEdit && S.vEdit.id === v.id ? S.vEdit.kind : null;
    const canW = writesOn();
    const parts = [];
    parts.push(`<div><div class="v-name">${esc(v.name)}${off ? ` <span class="chip t-neutral">${esc(t('inactive'))}</span>` : ''}</div><div class="v-sub">${esc([t(`c_${v.country}`) === `c_${v.country}` ? v.country : t(`c_${v.country}`), v.currency, `${tax} ${v.tax_id}`.trim()].filter(Boolean).join(' · '))}</div></div>`);
    parts.push(`<div><div class="v-k">${esc(tf('paidBy', { rail: RAIL[v.rail] || v.rail }))}</div><div class="v-v money">${esc(v.account || t('noAccount'))}</div></div>`);
    parts.push(`<div><div class="v-k">${esc(t('agreementK'))}</div>${agr.length ? agr.map((a) => `<div class="v-v">${esc(agreementText(a))}</div>${poBar(a, v)}`).join('') : `<div class="v-v">${esc(t('agrNone'))}</div>`}</div>`);
    parts.push(`<div class="v-actions"><button class="btn small" type="button" data-action="v-account" data-id="${esc(v.id)}"${canW ? '' : ' disabled'}>${esc(t('changeAccount'))}</button>
      <button class="btn small${off ? '' : ' danger'}" type="button" data-action="v-toggle" data-id="${esc(v.id)}" data-to="${off ? 'active' : 'inactive'}"${canW ? '' : ' disabled'}>${esc(off ? t('reactivate') : t('deactivate'))}</button></div>`);
    if (v.pending_account) {
      const by = v.pending_changed_by ? tf('pendingBy', { who: v.pending_changed_by, d: v.pending_changed_at ? when(v.pending_changed_at) : '' }) : '';
      const why = v.pending_reason ? tf('pendingWhy', { r: quoted(v.pending_reason) }) : '';
      const wUsd = (S.summary?.invoices || []).filter((i) => i.status === 'PENDING' && i.vendor_id === v.id && (i.reasons || []).includes('ACCOUNT_PENDING')).reduce((s, i) => s + Number(i.amount_usd || 0), 0);
      const waitTxt = v.waiting_invoices === 1 ? (wUsd ? tf('waiting1u', { usd: usdShort(wUsd) }) : t('waiting1')) : wUsd ? tf('waitingNu', { n: v.waiting_invoices, usd: usdShort(wUsd) }) : tf('waitingN', { n: v.waiting_invoices });
      const wait = v.waiting_invoices ? `<span class="waiting">${esc(waitTxt)}</span>` : '';
      const mine = canW && v.pending_changed_by && normName(v.pending_changed_by) === normName($('#actor').value) ? ` ${t('youChanged')}` : '';
      parts.push(`<div class="wide pending-acc"><div><p><b>${esc(tf('pendingAcc', { acc: v.pending_account }))}</b></p><p class="small">${esc([by, why].filter(Boolean).join(' '))}${esc(mine)}</p>${wait ? `<p class="small">${wait}</p>` : ''}</div>
        ${editing === 'confirm' ? '' : `<button class="btn primary small" type="button" data-action="v-confirm" data-id="${esc(v.id)}"${canW ? '' : ' disabled'}>${esc(t('confirmAccount'))}</button>`}</div>`);
    }
    if (editing === 'account') {
      parts.push(`<form class="wide inline-form" data-form="account" data-id="${esc(v.id)}" novalidate><div class="grid-form">
        <label class="field"><span>${esc(t('newAccount'))}</span><input name="account" required maxlength="80" autocomplete="off" spellcheck="false"><small>${esc(t(`acc_${v.rail}`))}</small></label>
        <label class="field"><span>${esc(t('reason'))}</span><input name="reason" required maxlength="300" placeholder="${esc(t('reasonPh'))}"></label></div>
        <p class="hint">${esc(t('newAccountHelp'))}</p>
        <div class="actions"><button class="btn primary" type="submit">${esc(t('saveAccount'))}</button><button class="btn quiet" type="button" data-action="v-close">${esc(t('cancel'))}</button></div></form>`);
    }
    if (editing === 'confirm') {
      parts.push(`<form class="wide inline-form" data-form="confirm" data-id="${esc(v.id)}" novalidate>
        <label class="field"><span>${esc(t('howVerified'))}</span><textarea name="note" required minlength="10" maxlength="500" placeholder="${esc(t('howPh'))}"></textarea><small>${esc(t('howHelp'))}</small></label>
        <div class="actions"><button class="btn primary" type="submit">${esc(t('confirmAccount'))}</button><button class="btn quiet" type="button" data-action="v-close">${esc(t('cancel'))}</button></div></form>`);
    }
    return `<li class="${off ? 'off' : ''}">${parts.join('')}</li>`;
  }
  function drawVendors() {
    const el = $('#view-proveedores');
    const cat = S.catalog;
    const add = `<button class="btn primary" type="button" data-action="v-add"${writesOn() ? '' : ' disabled'}>${esc(t('addVendor'))}</button>`;
    const vendors = cat?.vendors || [];
    el.innerHTML = `${pageHead('proveedores', t('vTitle'), t('vLead'), S.vForm ? '' : add)}${S.vForm ? addForm() : ''}
      <div class="sheet">${vendors.length ? `<ul class="vlist">${vendors.map((v) => vendorRow(v, cat.agreements || [])).join('')}</ul>` : `<p class="list-empty">${esc(t('vEmpty'))}</p>`}</div>`;
  }
  async function renderVendors() {
    const el = $('#view-proveedores');
    if (!S.catalog) el.innerHTML = `${pageHead('proveedores', t('vTitle'), t('vLead'))}<p class="muted">${esc(t('loading'))}</p>`;
    try {
      S.catalog = S.mode === 'static' ? S.staticData.catalog : await api('/api/catalog');
    } catch {
      el.innerHTML = `${pageHead('proveedores', t('vTitle'), t('vLead'))}<p class="alert">${ICON.warn}<span>${esc(t('loadFail'))}</span></p>`;
      return;
    }
    drawVendors();
  }
  function fieldError(input, msg) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const box = input.closest('.field, .setting');
    box?.querySelector('.err')?.remove();
    if (msg && box) {
      const id = `err-${input.name}-${Math.random().toString(36).slice(2, 7)}`;
      box.insertAdjacentHTML('beforeend', `<span class="err" id="${id}">${esc(msg)}</span>`);
      input.setAttribute('aria-describedby', id);
    } else input.removeAttribute('aria-describedby');
    return !msg;
  }
  function requireFields(form, names) {
    let ok = true;
    let first = null;
    for (const n of names) {
      const el = form.elements[n];
      const good = fieldError(el, el.value.trim() ? '' : t('required'));
      if (!good && !first) first = el;
      ok = ok && good;
    }
    first?.focus();
    return ok;
  }
  async function submitVendorForm(form) {
    const kind = form.dataset.form;
    const btn = form.querySelector('[type="submit"]');
    const f = form.elements;
    if (kind === 'add') {
      if (!requireFields(form, ['name', 'tax_id', 'account'])) return;
      const vendor = { name: f.name.value.trim(), tax_id: f.tax_id.value.trim(), country: f.country.value, currency: f.currency.value, rail: f.rail.value, account: f.account.value.trim() };
      const r = await write('POST', '/api/vendors', { vendor }, btn, t('saving'), inlineErr({ DUPLICATE_TAX_ID: f.tax_id }));
      if (!r) return;
      S.vForm = false;
      toast(t('vendorAdded'));
    } else if (kind === 'account') {
      if (!requireFields(form, ['account', 'reason'])) return;
      const r = await write('PATCH', `/api/vendors/${encodeURIComponent(form.dataset.id)}`, { account: f.account.value.trim(), reason: f.reason.value.trim() }, btn, t('saving'), inlineErr({ REASON_REQUIRED: f.reason }));
      if (!r) return;
      S.vEdit = null;
      toast(t('accountChanged'));
    } else if (kind === 'confirm') {
      const note = f.note.value.trim();
      if (!fieldError(f.note, note.length >= 10 ? '' : t('min10'))) { f.note.focus(); return; }
      const r = await write('POST', `/api/vendors/${encodeURIComponent(form.dataset.id)}/confirm-account`, { note }, btn, t('saving'), inlineErr({ VERIFICATION_NOTE_REQUIRED: f.note, SAME_ACTOR: f.note }));
      if (!r) return;
      S.vEdit = null;
      const n = Number(r.waiting_invoices || 0);
      toast(n ? (n === 1 ? t('confirmedWaiting1') : tf('confirmedWaitingN', { n })) : t('confirmed'));
    }
    await renderVendors();
    loadSummary().then(renderNav).catch(() => {});
  }
  async function toggleVendor(btn) {
    const to = btn.dataset.to;
    const r = await write('PATCH', `/api/vendors/${encodeURIComponent(btn.dataset.id)}`, { status: to }, btn, t('saving'));
    if (!r) return;
    toast(to === 'inactive' ? t('vendorOffToast') : t('vendorOnToast'));
    await renderVendors();
  }

  // ---------------------------------------------------------------- Ajustes
  function unitInput(key, val, labelId) {
    const f = FIELD[key];
    const ro = !writesOn();
    return `<div class="with-unit"><input id="set-${key}" name="${key}" type="number" inputmode="decimal" step="${f.int ? 1 : 'any'}" min="${f.min}" max="${f.max}" value="${esc(val)}"${labelId ? ` aria-labelledby="${labelId} set-${key}-u"` : ''}${ro ? ' readonly' : ''}><span id="set-${key}-u">${esc(t(`u_${f.unit}`))}</span></div>`;
  }
  function settingHtml(key, cur) {
    if (key === 'no_agreement') {
      if (!('no_agreement_max_per_invoice_usd' in cur) || !('no_agreement_max_per_month_usd' in cur)) return '';
      const [a, b, c] = t('s_no_agreement_sentence');
      return `<div class="setting sentence-setting" data-keys="no_agreement_max_per_invoice_usd no_agreement_max_per_month_usd"><span class="field-label" id="lbl-noagr">${esc(t('s_no_agreement'))}<span class="changed" hidden>${esc(t('changed'))}</span></span>
        <div class="sentence"><span id="lbl-noagr-a">${esc(a)}</span>${unitInput('no_agreement_max_per_invoice_usd', cur.no_agreement_max_per_invoice_usd, 'lbl-noagr lbl-noagr-a')}<span id="lbl-noagr-b">${esc(b)}</span>${unitInput('no_agreement_max_per_month_usd', cur.no_agreement_max_per_month_usd, 'lbl-noagr lbl-noagr-b')}<span>${esc(c)}</span></div>
        <small class="hint">${esc(t('sh_no_agreement'))}</small>${ruleHit('no_agreement')}</div>`;
    }
    if (!(key in cur)) return '';
    return `<div class="setting" data-keys="${key}"><label for="set-${key}">${esc(t(`s_${key}`))}<span class="changed" hidden>${esc(t('changed'))}</span></label>${unitInput(key, cur[key])}<small class="hint">${esc(t(`sh_${key}`))}</small>${ruleHit(key)}</div>`;
  }
  /** The rules in plain words: the three steps every invoice goes through, and what pays, waits or stops with today's numbers. */
  function howBlock(cur) {
    const val = (key, text) => `<button type="button" class="how-val" data-action="goto-setting" data-key="${key}" title="${esc(t('howGoto'))}">${esc(text)}</button>`;
    const has = (k) => cur[k] != null && cur[k] !== '';
    const chips = {
      limit: has('auto_approve_up_to_usd') ? val('auto_approve_up_to_usd', moneyText(cur.auto_approve_up_to_usd, 'USD')) : '',
      cap: has('hard_cap_per_invoice_usd') ? val('hard_cap_per_invoice_usd', moneyText(cur.hard_cap_per_invoice_usd, 'USD')) : '',
      budget: has('monthly_budget_usd') ? val('monthly_budget_usd', moneyText(cur.monthly_budget_usd, 'USD')) : '',
      tol: has('contract_tolerance_pct') ? val('contract_tolerance_pct', `${plainNum(cur.contract_tolerance_pct)}${S.lang === 'es' ? ' ' : ''}%`) : '',
      hours: has('pending_timeout_hours') ? val('pending_timeout_hours', `${cur.pending_timeout_hours} ${t('u_hours')}`) : '',
    };
    // The sentence is escaped first; each {number} then comes back as a button that jumps to its setting.
    const say = (s) => esc(s).replace(/\{(\w+)\}/g, (_, k) => chips[k] || '');
    const inv = S.summary?.invoices;
    const see = (g) => {
      if (!inv) return '';
      const n = inv.filter((i) => inGroup(i, g)).length;
      return n ? `<button type="button" class="how-see" data-action="see-group" data-group="${g}">${esc(n === 1 ? t('howSee1') : tf('howSeeN', { n }))}<span aria-hidden="true"> →</span></button>`
        : `<p class="how-see none">${esc(t('howSee0'))}</p>`;
    };
    const col = (tone, g, key) => `<section class="how-col t-${tone}" aria-labelledby="how-${g}"><h4 id="how-${g}">${ICON[tone]}<span>${esc(t(`how${key}T`))}</span></h4><p>${esc(t(`how${key}L`))}</p>
      <ul>${t(`how${key}`).map((s) => `<li>${say(s)}</li>`).join('')}</ul>${key === 'Rev' ? `<p class="how-note">${say(t('howRevF'))}</p>` : ''}${see(g)}</section>`;
    const steps = [1, 2, 3].map((n) => `<li><span class="how-n" aria-hidden="true">${n}</span><div><p class="how-st">${esc(t(`how${n}T`))}</p><p>${esc(t(`how${n}`))}</p></div></li>`).join('');
    return `<section class="sheet how" aria-labelledby="how-h"><h3 id="how-h">${esc(t('howTitle'))}</h3><p class="how-lead">${esc(t('howLead'))}</p>
      <ol class="how-steps">${steps}</ol>
      <div class="how-out">${col('ok', 'paid', 'Pay')}${col('warn', 'review', 'Rev')}${col('stop', 'stopped', 'Stop')}</div>
      <p class="how-foot">${esc(t('howFoot'))}</p></section>`;
  }
  function drawSettings() {
    const el = $('#view-ajustes');
    const r = S.rules;
    const cur = r.current || {};
    const versions = r.versions || [];
    const last = versions[versions.length - 1];
    const ver = last ? tf('versionLine', { v: cur.version ?? last.version, who: last.approved_by, d: when(last.at) }) : tf('versionOnly', { v: cur.version ?? '' });
    const groups = SETTINGS.map((g) => {
      const fields = g.fields.map((k) => settingHtml(k, cur)).join('');
      return fields ? `<fieldset><legend class="sr">${esc(t(`g_${g.id}`))}</legend><div class="set-grid"><div class="set-head" aria-hidden="true"><p class="set-title">${esc(t(`g_${g.id}`))}</p><p>${esc(t(`gd_${g.id}`))}</p></div><div class="fields">${fields}</div></div></fieldset>` : '';
    }).join('');
    const ro = !writesOn();
    const fx = S.catalog?.fx_table;
    const fxHtml = fx && fx.rates && Object.keys(fx.rates).length
      ? `<section class="sheet fx" aria-labelledby="fx-h"><h3 id="fx-h">${esc(t('fxTitle'))}</h3><p>${esc(tf('fxLine', { d: dateOnly(fx.date), src: cap(String(fx.source || '').replace(/\.$/, '')) }))}</p>
         <ul>${Object.entries(fx.rates).map(([k, v]) => `<li>1 ${esc(k)} = ${esc(plainNum(v))} USD</li>`).join('')}</ul></section>`
      : '';
    el.innerHTML = `${pageHead('ajustes', t('sTitle'), t('sLead'))}${howBlock(cur)}
      <form class="sheet settings" id="settingsForm" novalidate>${groups}
        <div class="save-bar"><span class="state-txt" id="dirtyTxt">${esc(ro ? (S.mode === 'static' ? t('staticSettings') : t('readOnlyServer')) : t('noChanges'))}</span>
          <div class="actions"><button class="btn" type="button" data-action="what-if"${ro ? ' disabled' : ''}>${esc(t('whatIf'))}</button><button class="btn primary" type="submit" id="saveRules" disabled>${esc(t('save'))}</button></div></div>
      </form>
      <div id="whatIfOut"></div>
      <p class="version-line">${esc(ver)}</p>${fxHtml}`;
    updateDirty();
    if (S.whatIf) drawWhatIf(S.whatIf);
  }
  async function renderSettings() {
    const el = $('#view-ajustes');
    if (!S.rules) el.innerHTML = `${pageHead('ajustes', t('sTitle'), t('sLead'))}<p class="muted">${esc(t('loading'))}</p>`;
    try {
      S.rules = S.mode === 'static' ? S.staticData.rules : await api('/api/rules');
      if (!S.catalog) S.catalog = S.mode === 'static' ? S.staticData.catalog : await api('/api/catalog').catch(() => null);
    } catch {
      el.innerHTML = `${pageHead('ajustes', t('sTitle'), t('sLead'))}<p class="alert">${ICON.warn}<span>${esc(t('loadFail'))}</span></p>`;
      return;
    }
    S.whatIf = null;
    drawSettings();
  }
  function settingsDraft() {
    const form = $('#settingsForm');
    const cur = S.rules.current;
    const out = { ...cur };
    const changed = [];
    for (const input of $$('input[name]', form)) {
      const k = input.name;
      const v = input.value.trim() === '' ? NaN : Number(input.value);
      out[k] = v;
      if (v !== Number(cur[k])) changed.push(k);
    }
    return { rules: out, changed };
  }
  function updateDirty() {
    if (!$('#settingsForm')) return;
    const { changed } = settingsDraft();
    $$('#settingsForm .setting').forEach((s) => { s.querySelector('.changed').hidden = !s.dataset.keys.split(' ').some((k) => changed.includes(k)); });
    if (!writesOn()) return;
    const n = changed.length;
    const txt = $('#dirtyTxt');
    txt.textContent = n ? (n === 1 ? t('dirty1') : tf('dirtyN', { n })) : t('noChanges');
    txt.classList.toggle('dirty', n > 0);
    $('#saveRules').disabled = n === 0;
  }
  function validateSettings() {
    const { rules } = settingsDraft();
    let ok = true;
    let first = null;
    for (const input of $$('#settingsForm input[name]')) {
      const f = FIELD[input.name];
      const v = rules[input.name];
      let msg = '';
      if (f && (!Number.isFinite(v) || v < f.min || v > f.max || (f.int && !Number.isInteger(v)))) msg = tf(f.int ? 'badInt' : 'badNumber', { min: plainNum(f.min), max: plainNum(f.max) });
      if (!msg && input.name === 'auto_approve_up_to_usd' && Number.isFinite(rules.hard_cap_per_invoice_usd) && v > rules.hard_cap_per_invoice_usd) msg = t('capLtAuto');
      fieldError(input, msg);
      if (msg && !first) first = input;
      ok = ok && !msg;
    }
    first?.focus();
    return ok ? rules : null;
  }
  /** Today against these settings, as two bars of the agent's own decisions. */
  function compareBars(r) {
    if (!r.before || !r.after) return '';
    const KEYS = [['PAY', 'ok'], ['ESCALATE', 'warn'], ['HOLD', 'stop']];
    const bar = (label, c) => `<p class="rowlab"><span>${esc(label)}</span></p><div class="stack static" role="img" aria-label="${esc(`${label}: ${KEYS.map(([k]) => `${c[k]} ${t(`o_k_${k}`)}`).join(', ')}`)}">
      ${KEYS.filter(([k]) => c[k] > 0).map(([k, tone]) => `<span class="seg t-${tone}" style="flex-grow:${c[k]}"><span>${c[k]}</span></span>`).join('')}</div>`;
    const deltas = KEYS.map(([k]) => [k, r.after[k] - r.before[k]]).filter(([, d]) => d !== 0)
      .map(([k, d]) => tf(d > 0 ? 'wiMore' : 'wiLess', { n: Math.abs(d), what: t(`o_new_${k}_${Math.abs(d) === 1 ? '1' : 'pl'}`) }));
    const key = `<ul class="legend">${KEYS.map(([k, tone]) => `<li class="t-${tone}"><i aria-hidden="true"></i>${esc(t(`o_k_${k}`))}</li>`).join('')}</ul>`;
    return `<div class="compare">${bar(t('wiToday'), r.before)}${bar(t('wiWith'), r.after)}${key}${deltas.length ? `<p class="c-note"><b>${esc(tf('wiDelta', { list: listJoin(deltas) }))}</b></p>` : ''}</div>`;
  }
  function drawWhatIf(r) {
    const out = $('#whatIfOut');
    if (!out) return;
    const n = r.compared ?? 0;
    const c = r.changed ?? (r.changes || []).length;
    const head = c === 0 ? tf('wiNone', { n }) : c === 1 ? tf('wiSome1', { n }) : tf('wiSomeN', { c, n });
    const items = (r.changes || []).map((x) => `<li>${esc(tf('wiRow', { inv: x.invoice_number || x.invoice_id, from: t(`o_now_${x.from}`), to: t(`o_new_${x.to}`) }))}</li>`).join('');
    out.innerHTML = `<section class="sheet whatif" aria-live="polite">${compareBars(r)}<p>${esc(head)}</p>${items ? `<ul>${items}</ul>` : ''}</section>`;
  }
  /** Which reason each setting produces, to show how many invoices it stopped. */
  const SETTING_REASON = {
    auto_approve_up_to_usd: 'APPROVAL_THRESHOLD', contract_tolerance_pct: 'AGREEMENT_MISMATCH', no_agreement: 'NO_AGREEMENT', hard_cap_per_invoice_usd: 'HARD_CAP',
    monthly_budget_usd: 'BUDGET_EXCEEDED', possible_duplicate_window_days: 'POSSIBLE_DUPLICATE', split_window_days: 'SPLIT_SUSPECTED', stale_after_days: 'STALE_DATE', pending_timeout_hours: 'EXPIRED',
  };
  function ruleHit(key) {
    const code = SETTING_REASON[key];
    const inv = S.summary?.invoices || [];
    if (!code || !inv.length) return '';
    const n = inv.filter((i) => (i.reasons || []).includes(code)).length;
    if (!n) return `<p class="rule-hit none">${esc(t('hitNone'))}</p>`;
    return `<button type="button" class="rule-hit" data-facet="reason" data-value="${code}" data-scope="all" aria-label="${esc(tf('hitAria', { n, total: inv.length }))}">
      <span class="h-track" aria-hidden="true"><span class="h-fill" style="--w:${Math.max(4, (n / inv.length) * 100).toFixed(1)}%"></span></span><span>${esc(tf(n === 1 ? 'hit1' : 'hitN', { n, total: inv.length }))}</span></button>`;
  }
  async function runWhatIf(btn) {
    if (S.mode === 'static') { toast(t('readOnly'), true); return; }
    const rules = validateSettings();
    if (!rules) return;
    await busy(btn, t('simulating'), async () => {
      try {
        S.whatIf = await api('/api/what-if', { method: 'POST', body: JSON.stringify({ rules }) });
        drawWhatIf(S.whatIf);
      } catch (e) { toast(errText(e), true); }
    });
  }
  async function saveSettings() {
    const rules = validateSettings();
    if (!rules) return;
    const r = await write('PUT', '/api/rules', { rules }, $('#saveRules'), t('saving'));
    if (!r) return;
    toast(t('savedToast'));
    S.whatIf = null;
    await renderSettings();
    loadSummary().then(renderNav).catch(() => {});
  }

  // ---------------------------------------------------------------- Historial
  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, today)) return t('today');
    if (same(d, y)) return t('yesterday');
    return cap(dt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }
  function drawHistory() {
    const el = $('#view-historial');
    const a = S.audit;
    const entries = [...(a.entries || [])].reverse();
    const shown = entries.slice(0, S.histLimit);
    const ok = a.verify?.ok !== false;
    const count = entries.length === 1 ? t('chainCount1') : tf('chainCountN', { n: entries.length });
    const chain = `<span class="chain${ok ? '' : ' bad'}">${ok ? ICON.ok : ICON.stop}${esc(ok ? `${t('chainOk')} · ${count}` : tf('chainBad', { n: a.verify?.broken_at ?? '' }))}</span>`;
    const days = [];
    for (const e of shown) {
      const k = dayLabel(e.at);
      if (!days.length || days[days.length - 1].k !== k) days.push({ k, items: [] });
      days[days.length - 1].items.push(e);
    }
    const m = S.summary?.metrics || {};
    const techRows = entries.slice(0, S.histLimit).map((e) => `<tr><td>#${esc(e.seq)}</td><td>${esc(e.type)}</td><td>${esc(e.actor)}</td><td>${esc(e.invoice_id || '')}</td><td>${esc(String(e.hash || '').slice(0, 16))}… ← ${esc(String(e.prev_hash || '').slice(0, 10))}…</td></tr>`).join('');
    const spend = m.model_spend_usd !== undefined ? `<p class="hint">${esc(tf('spend', { s: number(m.model_spend_usd), cap: number(m.model_spend_cap_usd) }))}</p>` : '';
    const verify = a.verify ? `<p class="hint mono">verify: ${esc(JSON.stringify(a.verify))}</p>` : '';
    el.innerHTML = `${pageHead('historial', t('hTitle'), t('hLead'), chain)}
      <div class="sheet history">${days.length ? days.map((d) => `<section class="day"><h3>${esc(d.k)}</h3>${timelineHtml(d.items, true)}</section>`).join('') : `<p class="list-empty">${esc(t('hEmpty'))}</p>`}
      ${entries.length > S.histLimit ? `<div class="more"><button class="btn" type="button" data-action="more">${esc(t('more'))}</button></div>` : ''}
      <details class="tech"><summary>${esc(t('techTitle'))}</summary><div class="tech-body">${verify}${spend}<div><h5>${esc(t('t_entries'))}</h5><div class="scroll"><table><tbody>${techRows}</tbody></table></div></div></div></details></div>`;
  }
  async function renderHistory() {
    const el = $('#view-historial');
    if (!S.audit) el.innerHTML = `${pageHead('historial', t('hTitle'), t('hLead'))}<p class="muted">${esc(t('loading'))}</p>`;
    try {
      S.audit = S.mode === 'static' ? S.staticData.audit : await api('/api/audit');
    } catch {
      el.innerHTML = `${pageHead('historial', t('hTitle'), t('hLead'))}<p class="alert">${ICON.warn}<span>${esc(t('loadFail'))}</span></p>`;
      return;
    }
    drawHistory();
  }

  // ---------------------------------------------------------------- routing
  function parseHash() {
    const [v, id] = location.hash.replace(/^#/, '').split('/');
    return { view: VIEWS.includes(v) ? v : 'facturas', id: id ? decodeURIComponent(id) : null };
  }
  async function route(userInitiated) {
    const { view, id } = parseHash();
    S.view = view;
    VIEWS.forEach((v) => { $(`#view-${v}`).hidden = v !== view; });
    renderNav();
    applyI18n();
    if (view === 'facturas') {
      renderFacturas();
      const target = id && S.invMap[id] ? id : S.selected && S.invMap[S.selected] ? S.selected : sortedInvoices()[0]?.id;
      if (target && (target !== S.detail?.invoice?.id || id)) await select(target, { hash: !!id || userInitiated, scroll: !!id && userInitiated });
    } else if (view === 'proveedores') await renderVendors();
    else if (view === 'ajustes') await renderSettings();
    else if (view === 'historial') await renderHistory();
    if (userInitiated && view === 'facturas' && id) $('#detail').focus({ preventScroll: true });
    else if (userInitiated) $(`#h-${view}`)?.focus({ preventScroll: false });
  }

  // ---------------------------------------------------------------- events
  document.addEventListener('click', async (e) => {
    // On a narrow screen the list sits below the charts: bring it into view after a chart click.
    const toList = (from) => { if (from.closest('#insights') && window.matchMedia('(max-width: 1060px)').matches) $('.inbox').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const f = e.target.closest('[data-filter]');
    if (f) {
      S.filter = f.dataset.filter;
      if (f.closest('#summary')) S.facet = null;
      syncFilters();
      toList(f);
      return;
    }
    const fc = e.target.closest('[data-facet]');
    if (fc && !fc.closest('#view-facturas')) {
      // From Ajustes: open Facturas already filtered by what that setting stopped.
      S.facet = { kind: fc.dataset.facet, value: fc.dataset.value, scope: fc.dataset.scope || 'why' };
      S.filter = 'all';
      S.selected = null;
      location.hash = '#facturas';
      return;
    }
    if (fc) {
      const same = S.facet && S.facet.kind === fc.dataset.facet && S.facet.value === fc.dataset.value;
      S.facet = same ? null : { kind: fc.dataset.facet, value: fc.dataset.value, scope: fc.dataset.scope || 'why' };
      S.filter = 'all';
      syncFilters();
      toList(fc);
      return;
    }
    const row = e.target.closest('.row');
    if (row) { select(row.dataset.id, { scroll: true }); return; }
    const a = e.target.closest('[data-action]');
    if (!a || a.disabled) return;
    const act = a.dataset.action;
    if (act === 'approve') return approve(a);
    if (act === 'reject') return reject(a);
    if (act === 'void-open') { S.voidOpen = true; renderDetail(); $('#voidReason')?.focus(); return; }
    if (act === 'void-cancel') { S.voidOpen = false; renderDetail(); return; }
    if (act === 'facet-clear') { S.facet = null; syncFilters(); $('#rows')?.focus?.(); return; }
    if (act === 'void-do') return voidPayment(a);
    if (act === 'back') { const r = $(`#rows .row[data-id="${CSS.escape(S.selected || '')}"]`); (r || $('#rows')).scrollIntoView({ behavior: 'smooth', block: 'center' }); r?.focus({ preventScroll: true }); return; }
    if (act === 'v-add') { if (!canWrite()) return; S.vForm = true; S.vEdit = null; drawVendors(); $('[data-form="add"] input[name="name"]')?.focus(); return; }
    if (act === 'v-close') { S.vForm = false; S.vEdit = null; drawVendors(); return; }
    if (act === 'v-account' || act === 'v-confirm') {
      if (!canWrite()) return;
      S.vEdit = { id: a.dataset.id, kind: act === 'v-account' ? 'account' : 'confirm' };
      S.vForm = false;
      drawVendors();
      $(`form[data-id="${CSS.escape(a.dataset.id)}"] input, form[data-id="${CSS.escape(a.dataset.id)}"] textarea`)?.focus();
      return;
    }
    if (act === 'v-toggle') return toggleVendor(a);
    if (act === 'what-if') return runWhatIf(a);
    if (act === 'goto-setting') {
      const input = $(`#set-${CSS.escape(a.dataset.key)}`);
      if (input) { input.scrollIntoView({ behavior: 'smooth', block: 'center' }); input.focus({ preventScroll: true }); }
      return;
    }
    if (act === 'see-group') { S.filter = a.dataset.group; S.facet = null; S.selected = null; location.hash = '#facturas'; return; }
    if (act === 'more') { S.histLimit += 120; drawHistory(); }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target;
    e.preventDefault();
    if (form.id === 'settingsForm') { saveSettings(); return; }
    if (form.dataset.form) submitVendorForm(form);
  });
  document.addEventListener('input', (e) => {
    if (e.target.closest('#settingsForm')) {
      if (e.target.getAttribute('aria-invalid') === 'true') fieldError(e.target, '');
      if (S.whatIf) { S.whatIf = null; $('#whatIfOut').innerHTML = ''; }
      updateDirty();
    } else if (e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') fieldError(e.target, '');
  });
  document.addEventListener('change', (e) => {
    const form = e.target.closest('form[data-form="add"]');
    if (form && e.target.name === 'country') {
      const k = COUNTRY[e.target.value];
      form.elements.currency.value = k.cur;
      form.elements.rail.value = k.rail;
      form.querySelector('[data-tax-label]').textContent = tf('vTax', { label: k.tax });
      form.querySelector('[data-acc-hint]').textContent = t(`acc_${k.rail}`);
    }
    if (form && e.target.name === 'rail') form.querySelector('[data-acc-hint]').textContent = t(`acc_${e.target.value}`);
  });
  $('#rows').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const btns = $$('#rows .row');
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    btns[n].focus();
  });
  $('#langBtn').addEventListener('click', () => {
    S.lang = S.lang === 'es' ? 'en' : 'es';
    store.set('pc.lang', S.lang);
    route(false);
  });
  $('#pickBtn').addEventListener('click', () => { if (canWrite()) $('#file').click(); });
  $('#file').addEventListener('change', (e) => { const file = e.target.files[0]; if (file) upload(file); e.target.value = ''; });
  const inbox = $('.inbox');
  ['dragenter', 'dragover'].forEach((ev) => inbox.addEventListener(ev, (e) => { e.preventDefault(); if (writesOn()) $('#drop').classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => inbox.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || !inbox.contains(e.relatedTarget)) $('#drop').classList.remove('over'); }));
  inbox.addEventListener('drop', (e) => { const file = e.dataTransfer?.files?.[0]; if (file) upload(file); });
  $('#actor').value = store.get('pc.actor', 'luis.tesoreria');
  $('#actor').addEventListener('change', () => {
    store.set('pc.actor', $('#actor').value.trim());
    if (S.view === 'facturas' && S.detail) renderDetail();
    if (S.view === 'proveedores' && S.catalog) drawVendors();
  });
  window.addEventListener('hashchange', () => route(true));

  // ---------------------------------------------------------------- boot
  (async () => {
    try {
      if (new URLSearchParams(location.search).get('mode') === 'static') throw new Error('static');
      S.mode = 'live';
      await loadSummary();
    } catch {
      S.mode = 'static';
      try {
        S.staticData = await fetch('demo-data.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
        await loadSummary();
      } catch {
        applyI18n();
        $('#main').innerHTML = `<p class="alert" style="margin-top:24px">${ICON.warn}<span>${esc(t('bootFail'))}</span></p>`;
        return;
      }
    }
    await route(false);
  })();
})();
