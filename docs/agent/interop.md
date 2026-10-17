---
agent_name: pagoclaro
version: 2
status: approved         # draft | approved — approved only by the owner at the gate
date: 2026-10-17
track: heavy
spec_version: 1
build_version: 2
---

# PagoClaro — Interop decision

## 1. Relationships

The question for each relationship: does the caller need a result, or does it need another agent
to take responsibility? The inventory is every external system or party the spec's tools,
security and conversation sections name, the channel included, plus any collaboration the design
anticipates. A credentialed internal store gets a row too. The first test that holds decides.

- `tool`: one request, one result, fixed semantics, already a tool contract in the spec.
- `orchestration`: several steps, but fully scriptable by this agent (reads, retries, sagas).
- `a2a`: the counterpart reasons, pauses, consults or negotiates over several turns on its own.
- `hitl`: the counterpart is a human, which the design and the spec already govern.

| Relationship | Verdict | Reason |
|---|---|---|
| API de Anthropic, Claude Opus 5.5 y Claude Haiku 5.5 (`read_invoice_primary`, `read_invoice_check`), con la API key de los lectores | tool | Una factura entra y una lectura con esquema cerrado sale, sin herramientas ni historial; los dos contratos están en el spec y el flujo fijo los llama |
| Almacén JSON de PagoClaro en `data/` con catálogo, acuerdos, libro de pagos, tabla de tipos de cambio, reglas versionadas, registro y telemetría (`find_vendor`, `find_agreement`, `query_ledger`, `convert_currency`, `evaluate_rules`, `record_payment`, `record_hold`) | tool | Almacén interno detrás de la interfaz de repositorio: cada herramienta es una lectura o una escritura de semántica fija en una transacción; nadie del otro lado razona |
| Personas de finanzas en el tablero: aprobadores de pendientes y quien cambia las reglas (`escalate_to_human`) | hitl | Son personas; el spec las gobierna con su compuerta (sección 8: aprobación que reevalúa, 72 horas, nadie aprueba lo que subió) |
| Tablero web y API HTTP de PagoClaro, el canal por el que finanzas u otro sistema sube facturas con el código de acceso | tool | Una petición, una respuesta: se sube una factura y vuelve la decisión con su explicación; esquemas cerrados y la decisión nunca viene del cliente (BHV-039) |
| Proveedores que emiten las facturas en PDF, imagen, correo .eml o chat | tool | Nunca conversan con el agente: su documento solo entra como dato a una lectura; lo que intente dar órdenes se copia y escala (BHV-008 a BHV-010) |
| Registro de npm, solo al instalar dependencias | tool | Una petición por paquete al instalar con `npm ci`, verificada contra el `integrity` del lockfile; no participa en tiempo de ejecución |

## 2. Decision

A clean skip is a success. Open A2A only for the relationships the test marked a2a, never for the
future; the future has a re-visit trigger.

- **Decision:** skip
- **Why:** ninguna contraparte toma responsabilidad: los lectores, el almacén, el canal, los
  proveedores y el registro de npm devuelven un resultado a una petición, y las personas de
  finanzas son una compuerta humana que el spec ya gobierna. El diseño lo dice igual: "A2A: no; el
  agente no habla con otros agentes. Otros sistemas lo llaman por su API HTTP". Revisado contra el
  build v2: las alarmas nuevas salen por `/health`, `/api/summary`, el tablero y la consola del
  servidor, todos ya en la tabla o locales; no aparece ninguna contraparte nueva.

## 3. A2A

With the decision skip, one line says that A2A does not apply. With a2a, record four lines,
written exactly as `- **Card:** <path>`, `- **Executor binding:** <how this runtime speaks A2A>`,
`- **Registry:** <none, private or public>` and
`- **Counterpart security:** <how remote agents are treated>`.
Card is where docs/agent/agent-card.json lives. Registry carries its reason. Counterpart security
says that remote agents are untrusted and that the action tiers travel with every request.

A2A no aplica: ninguna relación es a2a, así que no hay Agent Card ni registro.

## 4. Re-visit triggers

The concrete changes that reopen this decision.

- La ejecución real de pagos con una plataforma como Blinka entra al spec: si esa plataforma solo
  recibe una orden y devuelve su estado es tool; si confirma, pausa o negocia por varios turnos
  (por ejemplo, pide verificar al beneficiario y espera) puede ser a2a.
- Otro equipo o un cliente pide delegar facturas a PagoClaro desde su propio agente, o que
  PagoClaro le pase trabajo, como un agente de tesorería o de conciliación.
- Un proveedor o su agente puede contestar o negociar con PagoClaro, por ejemplo para corregir una
  factura o confirmar una cuenta por otro canal, en lugar de que lo haga una persona.
- El agente se lista en un registro de agentes.
- Un segundo agente entra a este repositorio y nombra a PagoClaro en su Delegation o sus Delegates.

## 5. Inbound contracts

What this agent serves to the other agents of the repository that call it, found in their
designs' Delegation and specs' Delegates. Callers is none when no agent calls this one. Each
caller gets one entry, its `###` heading the caller's agent root, `agents/<domain>/<bot>`, with
four lines written exactly as `- **Protocol:** <a2a or tool>`,
`- **Contract:** <the version offered to this caller>`, `- **Handler:** <file:line>` and
`- **Probe BHV:** <the BHV proving the probe has no side effect>`; then a line at column 0, with
no bullet, listing every version still served: `Served: <agent>-contract@1, <agent>-contract@2`.
One `####` block follows per served version, its heading the version, with four lines:
`- **Input schema:** <schema>`, `- **Output schema:** <schema>`,
`- **Probe request:** <a request with no side effect>` and `- **Probe response:** <a sample>`.
A shape change bumps the contract version. Any change here bumps this record's version.

- **Callers:** none
