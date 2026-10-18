---
agent_name: pagoclaro
version: 3
status: approved         # draft | approved — approved only by the owner at the gate
date: 2026-10-17
track: heavy
spec_version: 3
build_version: 3
---

# PagoClaro — Skills decision

## 1. Entry test

Skills are on-demand know-how, loaded only when a matching task appears. They never hold global
context, tool reach or always-on rules. Give every capability of the spec one row, by its exact
name. The first test that holds decides the verdict.

- `code`: it is enforced in code, before or after the loop, not by model know-how.
- `static`: it fits the always-on instructions within budget.
- `tool`: it is an action against a system with fixed semantics, so the spec's tool contract
  covers it.
- `skill`: it is a multi-step procedure for one task type that varies by case or client and would
  bloat the static instructions.

A capability that needs other permissions or true parallelism is a design change, not a skill.

| Capability | Verdict | Reason |
|---|---|---|
| Leer cada factura dos veces y cruzar las lecturas | static | Lo que el modelo necesita saber cabe en el bloque fijo del lector (`READER_SYSTEM`, 10 reglas, unos 900 tokens) y el cruce campo por campo ya es código (`compareReadings`) |
| Identificar al proveedor y lo acordado | code | `find_vendor` y `find_agreement` buscan por identificación fiscal normalizada en código y comparan la cuenta leída solo con la confirmada; ningún modelo participa |
| Decidir pagar, frenar o escalar según las reglas | code | Lo decide el motor de 18 reglas deterministas (`evaluate_rules`), el más estricto gana; ningún modelo decide |
| Registrar cada decisión con su explicación | code | El registro encadenado con hash, el porqué de cada regla y la frase en palabras comunes (`src/domain/history.ts`, plantillas fijas) se escriben en código dentro de la misma transacción que la decisión |
| Resolver un pendiente con aprobación humana | code | La aprobación vuelve a evaluar con el motor y la lista de motivos que nunca se aprueban está en código; la persona decide en el tablero |
| Desempatar cuando las lecturas no coinciden | code | Cuándo se llama al lector de desempate, qué campos se comparan y cuándo escala lo decide el código (`decide` en `src/agent/pipeline.ts` con `compareReadings`); Sonnet 5.5 lee con el mismo bloque fijo de 10 reglas que los otros dos lectores y no elige nada |
| Mantener la lista de proveedores autorizados | code | Lo hace una persona por la API y el tablero con esquemas cerrados; la cuenta por confirmar, `SAME_ACTOR`, la nota de verificación y que confirmar no pague se aplican en código; el agente no toca la lista y ningún modelo participa |

## 2. Decision

A clean none is a success. Author only the capabilities the entry test marked skill, never a
skill added while we are at it. With no skill authored, the Loader line is —.

- **Decision:** none
- **Why:** PagoClaro es un flujo fijo en código con un solo punto de modelo, el lector, que no
  tiene herramientas y cuyo saber cabe completo en un bloque fijo de 10 reglas; identificar,
  decidir, registrar y resolver pendientes son código determinista. No hay un tipo de tarea que
  varíe por caso o por cliente y que inflaría las instrucciones fijas. Revisado contra el build v2:
  el escalamiento con SUSPICIOUS_TEXT cuando las lecturas no coinciden y las alarmas que avisan
  son código; el bloque fijo del lector no cambió (10 reglas), así que la prueba da lo mismo.
  Revisado contra el build v3: el desempate agrega un tercer lector que usa el mismo bloque fijo, y
  la lista de proveedores autorizados, el historial en palabras comunes y las gráficas del tablero
  son código; el bloque fijo del lector sigue sin cambios desde el primer build
  (`git log -- src/extract/prompt.ts` muestra un solo commit), así que la decisión sigue en none.
- **Loader:** —

## 3. Skills

With the decision none, one line says that no skill was authored. With author, add one level-three
subsection per authored skill, named for its folder, and only for capabilities marked skill. Each
holds four lines, written exactly as
`- **Capability:** <spec capability>`, `- **Path:** <folder>`,
`- **Trigger accuracy:** <hits over paraphrases>` and `- **Ladder:** <draft or action-allowed>`.
Capability names the spec capability by its exact name. Path is the folder holding SKILL.md and
evals/cases.json. Trigger accuracy counts the hits over at least 5 paraphrases with every skill
co-loaded, target 90%. Ladder is draft, or action-allowed with its pass^k result and the owner's
yes. A fifth line, `- **Regression:** <result with every skill co-loaded>`, is optional.

No se escribió ninguna skill: la prueba de entrada no marcó ninguna capacidad como skill.

## 4. Re-visit triggers

The concrete changes that reopen this decision.

- El bloque fijo del lector pasa de unos 2,000 tokens o de 10 reglas (hoy está justo en 10 reglas
  y unos 900 tokens): la regla 11 reabre la decisión.
- Un segundo cliente o país con su propio procedimiento de lectura, por ejemplo CFDI en XML,
  NF-e de Brasil o facturación electrónica de la DIAN, que no quepa como una regla más.
- Más de unas 5 variantes de procedimiento por riel o por país en la lectura o en la conciliación.
- El spec agrega una capacidad procedimental por naturaleza, como conciliar estados de cuenta o
  pedir al proveedor una factura corregida.
- El lector recibe herramientas o el flujo pasa a un bucle de agente donde el modelo elige pasos.
- El desempate deja de compararse campo por campo y pasa a juzgar con criterio propio cuál lectura
  vale, o necesita instrucciones distintas a las de los otros dos lectores.
- Confirmar una cuenta de proveedor pasa a verificarse contra fuentes externas que cambian por
  país (por ejemplo bancos o registros fiscales de cada país), con un procedimiento distinto en
  cada uno.
