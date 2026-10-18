# PagoClaro — Runbook

The minimum operations runbook. The build writes it with the owner; the ship audit only checks it.

## Kill switch

How to stop the agent now, fastest first. Give the exact command or the exact toggle.

- **Stop the agent:** `Ctrl+C` en la terminal de `npm start`; en Docker, `docker stop pagoclaro`.
- **Stop the intake:** quitar `PAGOCLARO_ACCESS_CODE` del `.env` y reiniciar: la API y el tablero
  dejan de aceptar escrituras (403) y nadie puede subir facturas ni aprobar.
- **Cut the credential:** revocar la API key en console.anthropic.com (Settings, API keys) o
  bajar `MODEL_SPEND_CAP_USD` a `0`: sin llave o con el tope en cero, ningún lector llama a un modelo
  y las facturas nuevas se escalan con READER_FAILED.

- **En la demo de Cloud Run** (proyecto `pagoclaro-demo`, región `us-central1`): cerrarla al
  público con `gcloud run services remove-iam-policy-binding pagoclaro --project pagoclaro-demo
  --region us-central1 --member=allUsers --role=roles/run.invoker`, o dejar los lectores sin gasto con
  `gcloud run services update pagoclaro --project pagoclaro-demo --region us-central1
  --update-env-vars MODEL_SPEND_CAP_USD=0`. Ahí el contador de gasto vuelve a cero con cada
  contenedor nuevo: el tope que no se reinicia es el límite del workspace de la llave en
  console.anthropic.com.

- **Stop paying one vendor:** si se sospecha de un proveedor o de un cambio de cuenta, desactivarlo
  en "Proveedores autorizados" (o `PATCH /api/vendors/<id>` con `{"actor": "...", "status":
  "inactive"}`): sus facturas dejan de pagarse solas y escalan; sus pagos anteriores no se tocan.

Effect of each step:
Detener el proceso corta todo; las facturas ya decididas y el registro quedan en `data/state.json`.
Sin código de acceso el tablero sigue leyendo pero no escribe (tampoco se puede cambiar la lista de
proveedores). Sin llave las facturas nuevas no se leen y se escalan, nunca se pagan.

## Queue / DLQ drain

An agent without a queue says so and names what stands in for one.

- **Inspect:** no hay cola: las facturas se procesan en serie dentro del proceso (mutex). Lo que hace
  sus veces es la bandeja de pendientes: `GET /api/summary` (campo `metrics.pending`) o el filtro
  "Pendientes" del tablero.
- **Drain:** cada pendiente se aprueba o se rechaza en el tablero; los que pasan de 72 horas se
  frenan solos como EXPIRED en la siguiente consulta. Los que esperan por una cuenta nueva del
  proveedor se destraban así: otra persona confirma la cuenta en "Proveedores autorizados", con una
  nota de cómo la verificó por otro canal, y después alguien aprueba la factura (confirmar no paga
  nada solo). Si las lecturas no coincidieron, el detalle trae la lectura principal ya cargada.
- **Poison message:** una factura que termina en ERROR queda sin decisión; se identifica en el filtro
  "Sin decisión" y se vuelve a subir el mismo archivo (el sistema la reprocesa).

## Rollback

- **Current version:** el commit de git desplegado (`git rev-parse --short HEAD`) y la versión de
  reglas vigente (`GET /api/rules`).
- **Roll back:** `git checkout <commit-anterior>` (lo corre el dueño) y `npm ci && npm start`; para
  reglas, guardar en el tablero los valores de la versión anterior (crea una versión nueva, no borra).
  En Cloud Run, listar las revisiones y mandar todo el tráfico a la anterior:
  `gcloud run revisions list --service pagoclaro --project pagoclaro-demo --region us-central1`
  `gcloud run services update-traffic pagoclaro --project pagoclaro-demo --region us-central1 --to-revisions <revisión-anterior>=100`
- **State compatibility:** el v3 solo agrega campos opcionales a `data/state.json` (la lectura de
  desempate, la lectura sugerida del pendiente, la cuenta por confirmar del proveedor y la frase de
  cada entrada del registro); un estado del v2 carga igual y sus entradas sin frase siguen
  verificando. Volver al v2 con un estado del v3 deja sin pagar solas las cuentas por confirmar,
  igual que el v3. Respaldarlo antes (`copy data\state.json data\state.backup.json`).

## Alarms

One row per alarm, each with a first response.

| Alarm | Threshold | Source | First response |
|---|---|---|---|
| Pago fuera de reglas | 1 (`metrics.payments_out_of_rules` > 0) | `PAYMENT_OUT_OF_RULES` en `GET /health` y `GET /api/summary` (`metrics.alerts`), banner rojo en el tablero y una línea `[ALERTA]` en la consola de `npm start` (`src/alerts.ts`) | Detener el agente, anular la instrucción en el tablero, revisar la evaluación en el registro |
| Cadena del registro rota | `audit_chain_ok` = false | `AUDIT_CHAIN_BROKEN`, por los mismos cuatro avisos; detalle en `GET /api/audit/verify` | Detener escrituras, comparar `data/state.json` con el respaldo, identificar la entrada editada |
| Gasto en modelos | Assumption: 80 % del tope (40 USD) | `MODEL_SPEND_HIGH`, por los mismos cuatro avisos; detalle en `data/model-spend.json` | Revisar facturas reprocesadas; subir o bajar el tope con el dueño |
| Lectores fallando | Assumption: 3 READER_FAILED seguidas | `READERS_FAILING`, por los mismos cuatro avisos; detalle en `data/telemetry.jsonl` | Revisar la llave y status.anthropic.com |

## Weekly ritual

- **Re-run the suite:** `npm run evals` (unos 0.95 USD de créditos con los 60 casos y los tres
  lectores, medido el 2026-10-18); una falla nueva la investiga el dueño. Las lecturas de cada corrida quedan en
  `data/eval-readings/<run-id>/`.
- **Check the judge:** none judged (la suite no usa jueces; todo es determinista).
- **Mine corrections:** las facturas que una persona aprobó o rechazó en la semana son candidatas a casos
  nuevos; entran por `agent-engineering:evals`, nunca editando `evals/` a mano.
- **Schedule:** lunes 9:00 CDMX, dueño Edgar Eduardo Ramos Gomez.

## Contacts

- **Owner:** Edgar Eduardo Ramos Gomez
- **On-call:** Edgar Eduardo Ramos Gomez (solo, durante el hackathon)
- **Escalation:** no hay segundo contacto durante el hackathon
- **Provider status:** https://status.anthropic.com y console.anthropic.com (uso y créditos)
