---
agent_name: pagoclaro
version: 2
status: approved         # draft | approved — approved only by the owner at the gate
date: 2026-10-17
track: heavy
design_version: 1
spec_version: 1
evals_date: 2026-10-17
build_version: 2
skills_version: 2
interop_version: 2
delegate_contracts: []
results: runs/20261017T151303Z.json
verdict: SHIP
---

# PagoClaro — Ship report

Mechanical, not creative: every section runs a command, cites it and judges its output. No
command, no check. Every section is completed even after a red; the report is the full picture.
A section's Verdict is fail only when it finds a blocker; important and minor findings leave it
pass and go in the findings table.

## 0. Gate

The chain must be approved and current before the audit starts. A gap stops the audit with
nothing written, so a written report always passed this gate. An orchestrator's gate also needs
each delegate's approved SHIP report, current with the delegate's interop record.

Command run:

```text
node "C:/Users/edgar/Documents/GitHub/agent-engineering/src/cli.ts" chain "C:/Users/edgar/Documentos/Agentes - Repos/pagoclaro" --ready-for ship
```

Result:
`READY for ship: design, spec, evals, build, skills and interop are approved`, código de salida 0.
Design v1, spec v1, evals del 2026-10-17, build v2, skills v2 (none) e interop v2 (skip), todos
approved y vigentes. Esta es la re-auditoría que pidió el ship v1 (NO-SHIP, 9979a99) después de
la re-entrada al build. PagoClaro no tiene delegados.

## 1. Suite re-run

Run the build's runner now. The build record's result is history; this run is the evidence. A
non-zero exit does not stop the audit: it makes the verdict NO-SHIP.

Command run:

```text
npm run evals
```

Result:
El comando es el `runner` del archivo del build v2 (`runs/20261017T144147Z.json`). Esta corrida
escribió `runs/20261017T151303Z.json`, que empezó a las 2026-10-17T15:13:03Z, después de que
terminó la del build (14:42:37Z), y terminó a las 15:13:55Z. Salió con código 0 (`exit_code: 0`
en el archivo) y 46 de 46 casos en verde.

- reversible: 40 casos, 1 de 1 corrida cada uno; 40 cumplen.
- safe: 6 casos, 1 de 1; 6 cumplen.
- Adversariales: 12 de 12 en verde, ADV-006 incluido.
- Release blockers: los 6 se cumplen: todos los adversariales pasan; ningún `record_payment` sin
  evaluación PAY ni factura con lecturas distintas pagada; ninguna frase con órdenes ejecutada;
  telemetría sin contenido; API cerrada y la decisión nunca viene del cliente.
- `exit_code` 0 coincide con la suite en verde.

- **Verdict:** pass

## 2. Traceability

Reconstruct each BHV to its eval ids, its tests and its status in section 1's run. Every BHV is
accounted for, or its gap is justified in writing.

Commands run:

```text
git grep -n "^| BHV-" -- docs/agent/spec.md
node -e "const r=require('./runs/20261017T151303Z.json');r.cases.map(c=>console.log(c.id,...c.runs.map(x=>x.passed)))"
git grep -n bhv -- evals/config.json
```

Result:
40 BHV en la tabla Traceability, cada uno con su id de eval (46 casos) y con pruebas en la columna
Test; BHV-010 suma desde el v2 la prueba de lecturas distintas con órdenes. Los 46 ids están en la
corrida de la sección 1 y los 40 BHV tienen todos sus casos en verde. `coverage_gaps` está vacío y
el `git grep` no imprimió nada: no hay huecos.

- **Verdict:** pass

## 3. Security

Every adversarial case is green in section 1's run; a red one is already a NO-SHIP, and is still
listed. Credential scopes match the spec's least-privilege rows or, where the spec has none, the
scopes each tool needs and no more. The working tree and the git history hold no secret. Any
channel check the spec names is present in code. The model and every MCP server the code loads
are the ones the build record pins. An orchestrator makes one live call per delegate with the
pinned version's probe request from evals/delegates/, its delegate credentials in the scopes; a
delegate cites each Inbound contracts handler and the pins its orchestrators shipped.

Commands run:

```text
git ls-files evals/adversarial
git grep -n -i -E "scope|permission|role|ANTHROPIC_API_KEY|ACCESS_CODE" -- src Dockerfile .env.example .github package.json
git grep -n -E "new Anthropic|claude-(opus|haiku)-5-5'\)" -- src
git grep -n -I -i -E --untracked "(key|secret|token|passw(or)?d).{0,3}[:=].{0,3}[A-Za-z0-9_/+=-]{16,}|PRIVATE KEY|sk-ant-" -- . ':!node_modules' ':!package-lock.json'
git log --all -i -G"(key|secret|token|passw(or)?d).{0,3}[:=].{0,3}[A-Za-z0-9_/+=-]{16,}|PRIVATE KEY|sk-ant-" --format="%h %s" --name-only
git log --all -S "sk-ant" --format="%h %s"
git log --all --format="%h %s" --name-only -- "*.env*"
git check-ignore -v .env
git grep -n -E "\.strict\(\)|x-access-code|MAX_BYTES = |bytes.length > MAX_BYTES|i.document.sha256 === sha|SELF_APPROVAL|RulesSchema.safeParse|app.get\('/health'|alerts: alerts\(\)" -- src/http.ts src/agent/pipeline.ts src/extract/document.ts
grep -n "WRITES_DISABLED\|BAD_ACCESS_CODE" src/http.ts
git grep -n -i "mcp" -- src runner package.json
git grep -n -A3 '"node_modules/@anthropic-ai/sdk"' -- package-lock.json
git grep -n -E "npm ci|npm install" -- Dockerfile .github/workflows/ci.yml README.md
```

Result:
- **Adversarial:** 12 archivos en `evals/adversarial/`, los 12 en verde en la corrida de la
  sección 1.
- **Least privilege:** la API key solo la lee `new Anthropic()` para los dos lectores
  (`src/factory.ts:33-36`); el código de acceso solo autoriza escrituras (`src/http.ts:88` responde
  403 sin código y `src/http.ts:91-92` 401 con uno inválido); el CI pide solo `contents: read`; no
  hay credencial bancaria ni de pagos. Las alarmas del v2 (`src/alerts.ts`) solo leen el estado y
  el medidor de gasto. Coincide con la línea Least privilege del spec.
- **Secrets:** el árbol da `.claude/hooks/guard-artifacts.mjs:1749` (código del guard, no es un
  secreto) y `docs/agent/ship-report.md`, que solo cita el propio patrón de búsqueda; en el
  historial, los commits 18f0f4c (el guard) y 9979a99 (este reporte en su v1, por el mismo patrón).
  Ninguno es una credencial. El único archivo `.env*` del historial es `.env.example` (c2b2435), con
  los valores vacíos, y `.env` está ignorado (`.gitignore:3`).
- **Ingress:** esquemas cerrados con `.strict()` en cada cuerpo (`src/http.ts:29-34`), reglas
  validadas con `RulesSchema` antes de guardarse o simularse (`src/http.ts:184`, `src/http.ts:198`);
  código de acceso en `x-access-code` antes de escribir (`src/http.ts:91`); archivos de más de
  10 MB rechazados antes de leer (`src/extract/document.ts:5,30`); el mismo archivo devuelve la
  decisión anterior por su sha256 (`src/agent/pipeline.ts:54`); nadie aprueba lo que subió
  (`src/agent/pipeline.ts:288-290`); el cuerpo de subida no tiene campo de decisión
  (`src/http.ts:29`).
- **Model, MCP and stack pins:** `claude-opus-5-5` y `claude-haiku-5-5` por defecto
  (`src/config.ts:12-13`), los que build.md fija; ningún servidor MCP (el `git grep` no imprimió
  nada) y build.md dice `none`; stack `no-framework@n/a`, sin paquete de stack; la fila
  `hash-pinned install of @anthropic-ai/sdk` se cumple con la versión 0.135.0 y su `integrity`
  sha512 en `package-lock.json:29-32`, instalada con `npm ci --ignore-scripts` (`Dockerfile:7`,
  `.github/workflows/ci.yml:21`).

- **Verdict:** pass

## 4. Anti-gaming

Diff the build's commit range over evals/ and over the design and the spec. Sanctioned changes are
the spec's Test column, in the commit the build record names, and re-entry commits that each bump
one upstream artifact's version (the suite's date for evals) and that a rebuild followed. Under
.claude/, so are the guard's commit and each guard update to the plugin's current template that
the Installed line records. Anything else is a blocker.

Command run:

```text
git log --follow --diff-filter=A --format="%h %ad %s" -- docs/agent/build.md
git log --diff-filter=A --format="%h %ad %s" -- .claude/hooks/guard-artifacts.mjs
git log -1 --format="%h parent %p" 4d1d2da
git log -1 --format="%h parent %p" 18f0f4c
git diff -M100% --word-diff 799beb7..HEAD -- evals/ docs/agent/design.md docs/agent/spec.md
git diff -M100% --stat 799beb7..HEAD -- evals/ docs/agent/design.md docs/agent/spec.md
git log --format="%h %s" 799beb7..HEAD -- evals/ docs/agent/design.md docs/agent/spec.md
git show --stat --format="%h %s" 7fe740b
git show --stat --format="%h %s" f786420
git status --porcelain -- evals/ docs/agent/design.md docs/agent/spec.md
git log --full-diff --name-only --format="%h %s" 799beb7..HEAD -- .
git log --format="%h %s" 799beb7..HEAD -- .claude/
git show --name-only --format="%h %s" 18f0f4c
```

Result:
El stub de build.md entró en 4d1d2da, hijo de 18f0f4c (instalación del guard), hijo de 799beb7,
la base de la línea Installed: el rango es 799beb7..HEAD. Solo dos commits del rango tocan
`evals/`, el diseño o el spec, y los dos son la columna Test sancionada: 7fe740b (las 40 celdas,
40 líneas por 40) y f786420 (la celda de BHV-010, 1 línea por 1). Cada uno cambia solo
`docs/agent/spec.md` y solo la cuarta celda de filas `| BHV-`, y build.md registra los dos hashes
en su línea Test-column edit, hechos con el guard activo. `evals/` y el diseño no cambian en el
rango, y `git status` no muestra cambios sin commit en esas rutas. Hay un solo agente: ningún
commit toca `agents/`. Bajo `.claude/` el rango solo tiene 18f0f4c (script del guard, ratchet y
settings), la instalación que nombra la línea Installed. Que el guard sea igual a la plantilla lo
comprueba el rail de `chain`, que pasó en la línea del build en el gate. Como contexto, build.md
registra que el guard no estuvo activo en la primera sesión del build; este diff muestra que nada
fuera de la columna Test cambió en las rutas congeladas.

- **Verdict:** pass

## 5. Observability

Evidence that traces or logs arrive with the fields the design and the spec require, and that the
alarms the runbook names exist. Token counters are n/a, not a finding, only for an agent with no
model in its route, shown by a read-only grep.

Commands run:

```text
git grep -n -E "gen_ai\.usage|reasoning_tokens'?:|telemetry.jsonl|alerts" -- src/telemetry.ts src/config.ts src/metrics.ts src/http.ts
tail -1 tmp/smoke-live/telemetry.jsonl
PAGOCLARO_DATA_DIR=tmp/smoke-live EXTRACTOR_MODE=replay MODEL_SPEND_CAP_USD=0.01 PORT=3019 npx tsx src/server.ts > tmp/alarm-check.log 2>&1 &
curl -s localhost:3019/health
grep ALERTA tmp/alarm-check.log
```

Result:
- Un evento del smoke test en vivo (`tmp/smoke-live/telemetry.jsonl`): `service.name: pagoclaro`,
  `pagoclaro.op: upload`, `pagoclaro.outcome: PAID`, `pagoclaro.failed_rules: []`,
  `pagoclaro.policy.version: 1`, los dos modelos en `gen_ai.request.model`,
  `gen_ai.usage.input_tokens: 7624`, `gen_ai.usage.output_tokens: 404`,
  `pagoclaro.usage.reasoning_tokens: 0` y `pagoclaro.cost_usd: 0.019458`, sin texto de la factura
  ni cuentas. Los contadores salen de `src/telemetry.ts:40-42` y el archivo es
  `data/telemetry.jsonl` (`src/config.ts:72`).
- Las cuatro alarmas del runbook existen y avisan: `src/alerts.ts` las calcula,
  `src/metrics.ts:41` las pone en `GET /api/summary`, `src/http.ts:113` en `GET /health` y
  `src/http.ts:104` imprime `[ALERTA]` cuando una se enciende. Con el servidor de arriba (tope de
  0.01 USD, modo replay, sin gasto), `/health` respondió `"alerts":["MODEL_SPEND_HIGH"]`, la consola
  imprimió `[ALERTA] MODEL_SPEND_HIGH: el gasto en modelos llegó a 0.02 USD de 0.01 USD` y el
  tablero mostró el banner. Umbrales: pago fuera de reglas desde 1, cadena rota, gasto al 80 % del
  tope (40 de 50 USD) y 3 READER_FAILED seguidas.
- No hay `docs/agent/economics.md` aprobado: el umbral de gasto en tokens no tiene con qué
  compararse (nota, no hallazgo).

- **Verdict:** pass

## 6. Runbook

The runbook holds the minimums: kill switch, queue drain, rollback, alarms, weekly ritual and
contacts. A thin or missing runbook is a finding for the owner or a build re-entry; the audit
never writes it.

Command run:

```text
git grep -n -E "^## |^- \*\*" -- docs/runbook.md
git ls-files Dockerfile package.json src/server.ts src/alerts.ts
```

Result:
Las seis secciones están y se pueden seguir: kill switch con tres pasos (`Ctrl+C` o
`docker stop pagoclaro`, quitar `PAGOCLARO_ACCESS_CODE`, revocar la llave o poner el tope en 0);
sin cola, con la bandeja de pendientes como su equivalente; rollback con
`git checkout <commit-anterior>`, que corre el dueño, y respaldo de `data/state.json`; cuatro
alarmas con umbral, por dónde avisan (`src/alerts.ts`) y primera respuesta; ritual semanal los
lunes a las 9:00 CDMX con el costo medido de la suite, unos 0.70 USD, que coincide con las
corridas de hoy; y contactos. Los archivos que nombra están en git. No probé el kill switch ni el
rollback porque cambian el agente.

- **Verdict:** pass

## 7. Verdict and findings

SHIP when every section passes, whatever important or minor findings remain. NO-SHIP when a
release blocker is red, a change is unsanctioned or a link of the chain is missing. Each finding
carries a severity (blocker, important or minor) and the phase to re-open. When there is no
finding at all, the table holds one row: None, with — in Severity and Route; None never sits
beside another finding.

- **Verdict:** SHIP
- **Basis:** las seis secciones pasan: la corrida nueva está en verde (46/46, 12/12
  adversariales), la trazabilidad está completa, la seguridad y los pines coinciden, el rango solo
  tiene los cambios sancionados de la columna Test, las alarmas avisan y el runbook se puede
  seguir. Los cuatro hallazgos del ship v1 quedaron corregidos en el build v2.

| Finding | Severity | Route |
|---|---|---|
| None | — | — |

- **Release tag:** v1.0.0
