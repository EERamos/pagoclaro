---
agent_name: pagoclaro
version: 1
status: approved         # draft | approved — approved only by the owner at the gate
date: 2026-10-17
track: heavy
---

# PagoClaro — Design (heavy)

## 1. PEAS

| Element | Definition |
|---|---|
| **Performance** | De las facturas del set de prueba, el % que termina con la decisión correcta (pagar, frenar o escalar igual a la esperada) sin que intervenga una persona; meta ≥ 65 %, con cero facturas pagadas fuera de las reglas (restricción dura: una sola descalifica). Se reporta por separado en el set de construcción y en el set ciego. |
| **Environment** | El equipo de finanzas de una empresa ficticia con sede en EE. UU. que paga en USD, MXN, COP y BRL a proveedores y contratistas de México, Colombia y Brasil. Usa un tablero web bilingüe (español e inglés) montado sobre una API HTTP documentada, la misma que puede llamar el sistema o el agente propio de la empresa. Sistemas conectados: API de Anthropic (Opus 5.5 y Haiku 5.5); almacenamiento propio de reglas, proveedores, acuerdos y libro de pagos; tabla fija de tipos de cambio con fecha y fuente. Sin bancos, sin correo real y sin plataforma de pagos. Facturas en español, inglés y portugués. |
| **Actuators** | read_invoice_primary, read_invoice_check, find_vendor, find_agreement, query_ledger, convert_currency, evaluate_rules, record_payment, record_hold, escalate_to_human |
| **Sensors** | Facturas no confiables: PDF (media), imágenes JPG y PNG (media), correos .eml con adjuntos y mensajes de chat en texto; reglas de pago versionadas; catálogo de proveedores (identificación fiscal, cuenta registrada, moneda); acuerdos (contratos recurrentes y órdenes de compra con saldo); libro de pagos (decisiones, presupuesto consumido por periodo, huellas de facturas); tabla de tipos de cambio; decisiones de aprobación de personas desde el tablero. Ningún servidor MCP. |

Goodhart notes:
Las dos trampas que Edgar marcó: (1) armar el set de facturas y sus respuestas esperadas, o afinar
reglas y prompts, para que pasen el set y luego fallar con facturas nuevas; (2) subir la autonomía
no escalando lecturas dudosas, de modo que un monto o una cuenta mal leídos parecen dentro de reglas
y se paga algo equivocado. Contrapeso elegido por Edgar: un set ciego de facturas que no se usa al
construir, se corre solo al final y se reporta aparte; y doble lectura: toda factura en la que
Opus 5.5 y Haiku 5.5 no coinciden en beneficiario, identificación fiscal, cuenta, monto o moneda se
escala, nunca se paga. Además, ninguna cifra de una decisión de pago puede venir de una suposición
(sección 9).

## 2. Environment classification

| Dimension | Value | Architectural implication |
|---|---|---|
| Observable | partially | La factura puede mentir o venir alterada y no se verifica la identidad del emisor: el agente la compara contra su estado propio (catálogo de proveedores, acuerdos, libro) y escala lo que no puede confirmar. |
| Deterministic | stochastic | La lectura con modelos puede fallar: doble lectura independiente, validación de esquema y chequeos cruzados (suma de líneas igual al total, moneda ISO); ante cualquier discrepancia el plan de contingencia es escalar. La decisión en sí la toma un motor determinista. |
| Episodic | sequential | Cada decisión consume presupuesto del periodo y alimenta la detección de duplicados y de fraccionamiento: las facturas se procesan en orden, una a la vez (mutex), y cada decisión guarda el estado que vio. |
| Static | dynamic | Las reglas cambian, las aprobaciones llegan después y el presupuesto se reinicia por periodo: la aprobación humana vuelve a evaluar la factura con las reglas y el presupuesto vigentes, y cada decisión guarda la versión de reglas y el tipo de cambio usados. |
| Agents | single | Un solo agente. Los emisores de facturas se tratan como adversarios potenciales: su texto es dato, nunca instrucción. |

## 3. Harness decision

- **Topology:** single-agent (default)
- **Justification:** el trabajo es un flujo fijo por factura (leer dos veces, cruzar con el estado,
  evaluar reglas, registrar) y ninguna parte necesita permisos, accesos ni paralelismo distintos.
  Los dos lectores son llamadas a modelos dentro de una herramienta, no agentes. Pasar a varios
  agentes solo compraría algo si otra parte operara con credenciales propias, por ejemplo un agente
  que ejecute pagos reales con llaves bancarias, separado del que decide.
- **Completeness check:** Model Opus 5.5 (`claude-opus-5-5`, nivel frontera) como lector principal y
  Haiku 5.5 (`claude-haiku-5-5`, nivel pequeño) como segundo lector independiente; tool calling no
  se usa: cada lectura es una sola llamada con salida estructurada nativa (`output_config.format`
  con esquema JSON) y el modelo no recibe ninguna herramienta; reasoning native (pensamiento
  adaptativo con esfuerzo bajo; Opus 5.5 no permite apagarlo); hosted (API de Anthropic, créditos
  promocionales de Edgar, tope de gasto de 50 USD en código); dos muestras por factura, una por
  modelo, con esta afirmación medible: en el set ciego y en los casos adversariales de lectura
  alterada, ninguna factura con monto, moneda, cuenta o beneficiario mal leído termina en pagar. Si
  Haiku 5.5 acepta PDF e imágenes con salida estructurada lo confirma la prueba del modelo en el
  build (sección 7) · Tools 10, from §4 · Memory per turn: ninguna, cada lectura es una llamada
  aislada con solo la factura, sin historial; across runs: store con consulta exacta (sin búsqueda
  semántica) sobre el libro de pagos (decisiones, instrucciones de pago, presupuesto consumido por
  periodo, huellas de facturas), el catálogo de proveedores, los acuerdos y las versiones de reglas
  · Orchestration flujo fijo en código, sin bucle de modelo; por factura como máximo 2 llamadas a
  modelos más 1 reintento por lector ante error transitorio, 90 s de reloj por factura, facturas en
  serie · Deployment see §5

## 4. Preliminary tool inventory

| Tool | Purpose | Likely tier (safe/reversible/destructive) |
|---|---|---|
| read_invoice_primary | Lee una factura (PDF, imagen, correo .eml o mensaje de chat) con Opus 5.5 y devuelve, con salida estructurada, emisor, identificación fiscal, cuenta de pago, número, fechas, moneda, monto, líneas y cualquier texto que parezca instrucción | safe |
| read_invoice_check | Segunda lectura independiente de la misma factura con Haiku 5.5, sin ver la primera | safe |
| find_vendor | Busca al proveedor en el catálogo por identificación fiscal o cuenta registrada (el nombre solo como pista) | safe |
| find_agreement | Busca el contrato recurrente u orden de compra del proveedor y su saldo restante | safe |
| query_ledger | Consulta pagos previos, presupuesto consumido del periodo y huellas para duplicados y fraccionamiento | safe |
| convert_currency | Convierte a USD con la tabla fija de tipos de cambio y devuelve la tasa, su fecha y su fuente | safe |
| evaluate_rules | Motor determinista: evalúa todas las reglas y devuelve pagar, frenar o escalar con cada regla pasada o fallida | safe |
| record_payment | Registra la decisión de pagar en el libro y en el registro de auditoría encadenado, y emite la instrucción de pago simulada por riel (SPEI, Pix, Bre-B, ACH) | destructive |
| record_hold | Registra la decisión de frenar una factura con sus motivos | reversible |
| escalate_to_human | Deja la factura pendiente de aprobación humana con sus motivos; la aprobación vuelve a evaluar reglas y presupuesto antes de pagar | reversible |

A tool reached through an MCP server says so in Purpose: `via MCP server <name>`.

No schemas here — the spec owns contracts.

## 5. Deployment intent

- **Target:** contenedor Docker en un hosting gratuito con URL pública (Render free como primera
  opción, Hugging Face Spaces como respaldo), más `npm run demo` local en un comando. Es una
  elección dentro de dos restricciones: costo cero de hosting (regla de dinero de Edgar) y una URL
  pública de demo, obligatoria en el formulario de entrega de HackRadar. La demo pública corre el
  set precargado con lecturas guardadas; subir facturas nuevas, que gasta créditos, pide un código
  de acceso.
- **Seams (decided now, paid never):**
  - Sessions: almacenamiento detrás de una interfaz de repositorio (archivos JSON con escritura
    atómica ahora, Postgres después sin tocar el dominio); el registro de auditoría es de solo
    agregar, encadenado con hash, y se exporta a JSONL.
  - Model: configuración agnóstica de proveedor: cada lector es una ruta `proveedor/modelo` en la
    configuración (`anthropic/claude-opus-5-5`, `anthropic/claude-haiku-5-5`) detrás de una
    interfaz Extractor con tres implementaciones: lecturas guardadas (pruebas y demo), Anthropic y
    Ollama local.
  - Telemetry: convenciones OTel GenAI con contadores de tokens; cada factura registra un evento
    con su id, huella, modelos, tokens de entrada, salida y razonamiento, costo en USD, latencia,
    decisión, reglas que fallaron y versión de reglas; exportación OTLP solo si se configura un
    endpoint, y nunca el contenido de las facturas.

## 6. NO-goals

- No mueve dinero real ni se conecta a bancos o plataformas de pago: solo emite instrucciones de
  pago simuladas.
- Nunca paga, sin aprobación de una persona, una factura que falle una regla dura, cuyas dos
  lecturas no coincidan o cuyas cifras dependan de una suposición.
- No decide cumplimiento, fraude ni identidad de empresas: una cuenta distinta a la registrada se
  escala como "no coincide con lo registrado".
- No cambia reglas, catálogo de proveedores ni cuentas registradas, y no aprueba pendientes.
- No obedece texto dentro de una factura: es dato, nunca instrucción.

## 7. Open questions → /spec

- Doble lectura: ¿qué campos deben coincidir exacto (monto, moneda, cuenta, identificación fiscal)
  y cuáles con tolerancia (nombre del emisor, fechas)?
- Duplicado difuso y fraccionamiento: ¿qué ventana de días y qué suma por proveedor contra el
  umbral de aprobación?
- ¿Haiku 5.5 acepta PDF e imágenes con salida estructurada? Lo resuelve la prueba del modelo en el
  build; si no, la segunda lectura usa el texto extraído del PDF.
- Moneda ambigua ("$" sin código ISO): ¿se escala siempre o se acepta cuando coincide con la
  moneda registrada del proveedor?
- Hosting: ¿Render free funciona sin tarjeta y con Docker, o se usa Hugging Face Spaces? Afecta el
  arranque en frío de la demo.

## 8. Voice and wake

- **Voice:** formal
- **Wake:** user invoke

## 9. Provenance policy

- **Tags in use:** source (cada campo leído de la factura, citando archivo, lector y modelo; datos
  del catálogo, de los acuerdos y de la tabla de tipos de cambio con su fuente), calculated
  (conversión de moneda, presupuesto restante, sumas y resultado de cada regla), user-decided
  (reglas configuradas, altas de proveedores y aprobaciones humanas con quién y cuándo),
  assumption (solo para marcar huecos: una cifra con esta etiqueta nunca sostiene un pago y lleva a
  escalar).
- **Catastrophic when missing:** en una decisión de pagar, el monto, la moneda, la cuenta de
  destino, el beneficiario y el tipo de cambio usado: si alguno no tiene etiqueta source o
  calculated, la factura se escala y el ship se bloquea.

## 10. Maintainers

- **Owner:** Edgar Eduardo Ramos Gomez
- **On-call:** Edgar Eduardo Ramos Gomez (solo, durante el hackathon)

## 11. Stack decision

The owner picks the stack; design recommends one and never picks. The filters come from
`catalog/stacks/_index.md` and each fact from a card, cited with its URL. Chosen is written
`<card-id>@<version>`, `no-framework@n/a` or `off-catalog:<name>@<version>`, the version exact.
The catalog is Python only: an agent in another language picks `no-framework@n/a` or an
off-catalog stack. A filter answer the owner did not give is marked assumption and gets an open
question.

**Filter answers:**

- **Language:** TypeScript (Node 20 o superior).
- **Provider switch:** no obligatorio; la interfaz Extractor (sección 5) permite cambiar de
  proveedor o usar Ollama local sin tocar el dominio.
- **A2A:** no; el agente no habla con otros agentes. Otros sistemas lo llaman por su API HTTP.
- **Client infrastructure:** ninguna; corre en un hosting gratuito con Docker y en local.
  assumption: que Render free funcione sin tarjeta (pregunta abierta en la sección 7).
- **Data egress:** el contenido de las facturas, que es sintético, sale solo a la API de
  Anthropic; la telemetría no sale a terceros.

**Candidates:** two or three, lettered; each pro and con cites a card fact with its URL or a
design fact with its section.

| Candidate | Pros (cited) | Cons (cited) |
|---|---|---|
| A. no-framework@n/a | Anthropic recomienda empezar con las APIs de los modelos directamente y advierte que los frameworks agregan capas de abstracción (https://www.anthropic.com/engineering/building-effective-agents); sin telemetría saliente por defecto, default_egress none (catalog/stacks/_index.md); el agente no tiene bucle de herramientas, solo dos llamadas con salida estructurada por factura (sección 3); cada línea que puede llevar a record_payment se puede revisar a mano, el caso en que la tarjeta recomienda este camino (catalog/stacks/no-framework.md, sección 5) | Los casos de borde del proveedor, como los motivos de paro y los bloques de pensamiento, son código propio (https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons); el binding de la tarjeta está escrito para Python y el build lo sigue por analogía en TypeScript (catalog/bindings/no-framework.md) |
| B. off-catalog:ai@7.0.143 | Estandariza la salida estructurada entre proveedores con esquemas Zod (https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data); su proveedor de Anthropic acepta PDF e imágenes (https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) | Las opciones propias de Anthropic (pensamiento, esfuerzo, caché) pasan por providerOptions y algunos modelos rechazan apagar el pensamiento (https://ai-sdk.dev/providers/ai-sdk-providers/anthropic); es una capa más sobre el SDK oficial, con versiones frecuentes (7.0.143 en npm al 2026-10-17); ninguna tarjeta ni binding del catálogo la cubre (catalog/stacks/_index.md) |

- **Recommended:** A, porque el agente no tiene bucle de herramientas y el SDK oficial de
  Anthropic ya expone directo la salida estructurada, el PDF y el esfuerzo, sin otra capa.
- **Chosen:** no-framework@n/a
- **Why:** Edgar delegó en la recomendación las decisiones restantes del diseño y su aprobación
  (2026-10-17, "haz toda la implementación y todo lo necesario siguiendo tus recomendaciones y
  después reviso todo"); descansa en que no hay bucle de herramientas (sección 3).
- **Relaxed filters:** none
- **Suspicious content seen:** none; las dos páginas de ai-sdk.dev leídas no traen texto dirigido a
  agentes, solo enlazan /agents.md y /llms.txt como índices.

A table with nothing to list holds one None row, with — in the other cells.

**Set aside:** cards that passed the filters but were not kept.

| Set aside (judgment) | Reason | Source |
|---|---|---|
| None | — | — |

**Eliminated:** cards a filter answer ruled out.

| Eliminated | Filter that eliminated it | Card value |
|---|---|---|
| langgraph | Language: TypeScript | Python (the catalog is Python only) |
| langchain-create-agent | Language: TypeScript | Python (the catalog is Python only) |
| deep-agents | Language: TypeScript | Python (the catalog is Python only) |
| pydantic-ai | Language: TypeScript | Python (the catalog is Python only) |
| google-adk | Language: TypeScript | Python (the catalog is Python only) |
| openai-agents-sdk | Language: TypeScript | Python (the catalog is Python only) |
| crewai | Language: TypeScript | Python (the catalog is Python only) |
| claude-agent-sdk | Language: TypeScript | Python (the catalog is Python only) |

**Mandatory spec security rows:** the chosen card's [security] and [data] traps, and switching off
its default egress when the Data egress answer limits it. Trap is a short label written here, and
Source the card's sentence with its URL; the spec gives each label a Security row whose Surface
is `stack: <Trap>`.

| Trap | Tag | Source |
|---|---|---|
| Pin exact versions with hashes | security | "LiteLLM 1.82.7 and 1.82.8 on PyPI were malicious (published 2026-03-24 from a hijacked maintainer account; 1.82.8 ran from a `.pth` file at interpreter startup): pin exact versions with hashes." https://www.netspi.com/blog/executive-blog/ai-ml-pentesting/litellm-supply-chain-compromise/ |
| No message content in telemetry | data | "LiteLLM's OTel callback logs message content by default (`turn_off_message_logging` defaults to logging) and the SDK fetches its price map from github.com on import; both need explicit settings." https://docs.litellm.ai/docs/observability/opentelemetry_integration |

**Concrete per-seam binding:** from the card's seam mapping and its build binding.

| Seam | Support | How |
|---|---|---|
| sessions | custom | Repositorio propio con archivos JSON de escritura atómica; libro y registro de auditoría de solo agregar con hash encadenado; exportación a JSONL |
| hitl_gate | custom | escalate_to_human deja la factura en una cola de pendientes; solo una persona la aprueba o la rechaza desde el tablero; la aprobación vuelve a evaluar reglas y presupuesto antes de record_payment, y nadie aprueba lo que él mismo subió |
| step_cap | custom | Flujo fijo: como máximo 2 llamadas a modelos por factura más 1 reintento por lector |
| tool_call_cap | custom | Cero: el modelo no recibe herramientas; el código llama las herramientas en un orden fijo |
| model_provider | adapter | Interfaz Extractor con implementaciones de lecturas guardadas, Anthropic (`@anthropic-ai/sdk` 0.135.0, versión exacta) y Ollama; la ruta se fija en configuración y nunca la elige el modelo |
| telemetry | custom | Un evento por factura con atributos gen_ai.* (modelo, tokens de entrada, salida y razonamiento) más costo y decisión; exportación OTLP opcional; sin contenido de facturas |
| eval_runner | custom | Corredor propio: corre el set de construcción y el set ciego con lecturas guardadas (gratis y determinista) y en vivo con tope de gasto; compara cada decisión con la esperada y calcula la métrica de la sección 1 |
| deploy | native | Contenedor Docker con Node, sin runtime administrado |

**Verification log:** the facts re-checked, read-only, because the card's verified_on is more than
90 days old.

| Fact re-checked | Source | Result |
|---|---|---|
| None | — | — |

**Catalog drift:** each fact a source now states differently from the card.

| Card fact | Catalog says | Source says now |
|---|---|---|
| None | — | — |

## 12. Delegation

Whether this agent hands work to other agents of the repository, each called over the network.
Routing comes first: when it is mechanical (by channel or keyword), the outcome is a router
without an LLM, even when a reason below holds, and design writes no file. Otherwise an
orchestrator needs a reason that holds, each with a concrete fact from this case. With none, the
outcome is one agent: this one doing the whole job, its verdict `no delegation: <reason>`, or the
work added to an existing agent, which writes no file. Something that exists only to serve this
agent is a subagent of its own stack, not a delegate.

- **Verdict:** no delegation: PagoClaro hace todo el trabajo; sus dos lectores existen solo para servirle y no hay otros agentes en el repositorio
- **Routing:** no hay trabajo que repartir entre agentes: todas las facturas entran por la misma bandeja y siguen el mismo flujo

Each reason holds with a fact from this case, or reads —.

| Reason | Fact from this case |
|---|---|
| reuse | — |
| separate permissions | — |
| context too large | — |
| different models or costs | Opus 5.5 lee y Haiku 5.5 relee a menor costo, pero los dos son lectores internos de este agente, no delegados |

Each delegate is also a tool of section 4, named by its agent_name, and Agent root is its folder
from the repository root, `agents/<domain>/<bot>`. The verdict no delegation holds one None row,
with — in the other cells.

| Delegate | Agent root | Used for | Reasons |
|---|---|---|---|
| None | — | — | — |
