# PagoClaro

**Un agente de cuentas por pagar que lee cada factura dos veces, decide pagar, frenar o escalar
con reglas que la empresa controla, y explica cada decisión.** Construido para el reto Blinka del
Hackathon 30X (octubre 2026): *agentes que pagan por la empresa*.

> El modelo lee. Las reglas deciden. Nada se paga fuera de las reglas sin una persona.

[English summary below](#english-summary)

## Qué hace

Una empresa con sede en EE. UU. (Northwind Labs, ficticia) paga a proveedores de México, Colombia
y Brasil. Le llegan facturas en PDF, fotos, correos `.eml` o mensajes de chat. PagoClaro:

1. **Lee la factura dos veces**, con dos modelos distintos y sin que uno vea al otro: Claude Opus 5.5
   (lector principal) y Claude Haiku 5.5 (verificación). Cada lectura es una sola llamada con
   salida estructurada y esquema cerrado; el modelo no tiene herramientas.
2. **Desempata solo cuando hace falta**: si las dos lecturas no coinciden en identificación fiscal,
   número, moneda, total o cuenta, Claude Sonnet 5.5 lee la factura por su cuenta y se compara con
   la principal en los campos en duda. Si la confirma, sigue; si no, decide una persona, con la
   lectura principal ya cargada. Si el lector de verificación se cae, Sonnet lo sustituye.
3. **Cruza lo leído con lo registrado**: proveedor autorizado por identificación fiscal (RFC, NIT,
   CNPJ, EIN), su cuenta confirmada, el contrato u orden de compra con su saldo, y el libro de pagos.
4. **Decide con un motor de reglas determinista**: 18 reglas, el resultado es el más estricto
   (FRENAR > ESCALAR > PAGAR). El motor no usa modelos ni lee texto libre.
5. **Registra y explica en palabras comunes**: cada entrada del historial dice qué se hizo, quién
   decidió, por qué y cuánto margen quedó contra cada límite, en español y en inglés; debajo
   guarda todas las reglas evaluadas, la versión de reglas, el tipo de cambio con fecha y fuente,
   los modelos lectores y un hash encadenado con la entrada anterior. Pagar emite una
   **instrucción de pago simulada** por el riel de la moneda (SPEI, Pix, Bre-B, ACH). No se mueve
   dinero real.
6. **Escala a una persona** lo que pide criterio. La aprobación vuelve a evaluar con las reglas
   vigentes y solo levanta los motivos que piden criterio; una cuenta distinta a la confirmada, una
   cuenta que nadie ha confirmado o un texto con órdenes **nunca** se aprueban desde la factura.
7. **Deja que la empresa defina a quién se le paga**: desde la pantalla se agregan, desactivan o
   cambian proveedores autorizados. Una cuenta nueva o cambiada queda por confirmar y no se paga
   sola; la confirma una persona distinta de quien la cambió, con una nota de cómo la verificó.

## Las trampas que cubre

| Trampa (las de Blinka y más) | Qué hace PagoClaro |
|---|---|
| Cobro duplicado | Frena (mismo proveedor y número) o escala (mismo monto en ±10 días) |
| Beneficiario nuevo | Escala; un nombre parecido con otro RFC no cuenta como el proveedor. La empresa lo puede agregar a sus proveedores autorizados |
| Proveedor autorizado sin contrato | Escala, salvo que quepa en el tope que fija la empresa por factura y por mes (empieza en 0) |
| Factura que no cuadra con lo acordado | Escala si no cuadra con el contrato; frena si rebasa el saldo de la orden de compra |
| Monto arriba del límite | Escala para aprobación humana; arriba del tope duro, frena |
| Presupuesto insuficiente del periodo | Frena |
| Cuenta bancaria distinta a la registrada ("cambio de cuenta urgente") | Escala, y la aprobación no la puede levantar |
| Alguien cambia la cuenta de un proveedor en el sistema | La cuenta nueva queda por confirmar y no se paga sola; quien la cambió no puede confirmarla; mientras tanto se sigue pagando la confirmada |
| Instrucciones escondidas en la factura (texto blanco en PDF, nota en una foto, correo o chat) | Se copian como dato y la factura se escala; nunca se obedecen |
| Moneda ambigua ("$" sin código) o sin tipo de cambio | Escala; nunca se infiere la moneda por el país |
| Cobro partido para no pasar el límite | Escala (suma de 7 días) |
| Lecturas que no coinciden | Desempata un tercer modelo; si no confirma la lectura principal, escala con ella precargada |
| Archivo ilegible o lector caído | Escala; un fallo al guardar no deja instrucciones a medias |

## Por qué confiar en él

- **Cero pagos fuera de reglas, probado y no solo prometido**: una prueba de propiedad genera 20,000
  facturas y reglas al azar y verifica que PAGAR implica que toda regla dura pasó.
- **Doble lectura con dos modelos y desempate con un tercero**: es difícil que se equivoquen igual;
  si difieren y el desempate no confirma la lectura principal, decide una persona. Una cuenta mal
  leída por los dos tampoco se paga, porque se compara con la cuenta confirmada del proveedor.
- **Texto es dato**: los lectores no tienen herramientas y el motor no lee texto libre. Una
  inyección solo puede ensuciar una lectura, y eso escala.
- **Explicable sin abrir el código**: el historial cuenta cada decisión en una frase que cualquiera
  entiende; debajo, el porqué regla por regla, con procedencia (`source`, `calculated`,
  `user-decided`) de cada cifra.
- **Registro a prueba de alteraciones**: editar cualquier entrada, también su frase, rompe la
  cadena desde esa entrada.
- **Barreras deterministas alrededor de un modelo probabilístico**: el modelo nunca está del lado de
  la decisión; las reglas son la autorización permanente que una persona aprobó, versionada.

## Cómo se construyó

Con el estándar **agent-engineering** de Edgar (track heavy): diseño → spec con 54 escenarios
Gherkin → **60 evals escritos antes del código** (44 golden + 16 adversariales) → build con un
runner que corre la suite contra los lectores reales → auditoría de salida. Además, un **set ciego**
de 12 facturas lo escribió un agente aparte, sin ver los evals ni el código, y se corre una sola vez
al final. Los artefactos están en [`docs/agent/`](docs/agent/) y [`evals/`](evals/).

## Resultados (17 y 18 de octubre de 2026)

| Prueba | Resultado | Archivo |
|---|---|---|
| Suite de 60 evals con Opus 5.5, Haiku 5.5 y Sonnet 5.5 reales | 60/60 en verde, con los 16 adversariales | [`runs/20261018T035802Z.json`](runs/20261018T035802Z.json) |
| Set ciego de 12 facturas, corrido una sola vez (con la versión de dos lectores) | 12/12 decisiones correctas, 0 pagos indebidos; 8 resueltas sin persona y las 4 que tocaba escalar, escaladas | [`runs-blind/20261017T152812Z.json`](runs-blind/20261017T152812Z.json) |
| Auditoría de salida | SHIP en la versión 3 | [`docs/agent/ship-report.md`](docs/agent/ship-report.md) |

La primera auditoría dio NO-SHIP, y así quedó registrado. Un chat con una orden de pago escaló por
lecturas distintas, pero no por texto con órdenes, porque Haiku dejó vacíos los campos del chat.
El build se reabrió, el arreglo entró con una prueba hecha con esas dos lecturas reales y la
re-auditoría salió limpia. Después se agregaron el desempate con Sonnet 5.5, la lista de
proveedores autorizados con cuentas por confirmar y el historial en palabras comunes: se escribieron
primero sus escenarios y sus 14 evals nuevos, y la suite completa volvió a pasar con los tres
lectores reales. La auditoría de esa versión dio SHIP con un hallazgo de redacción en los evals:
uno de los bloqueos de salida se escribió antes del desempate y hay que actualizar su texto. Correr
la suite completa cuesta unos 0.95 USD.

- Stack: TypeScript en Node 20+, sin framework de agentes (`no-framework@n/a`), Fastify, zod,
  `@anthropic-ai/sdk` 0.135.0 (versiones exactas en `package-lock.json`).

## Correr en local

Requisitos: Node 20 o superior. La API key de Anthropic es opcional: sin ella, el tablero corre con
las lecturas guardadas de la demo.

```bash
npm ci
cp .env.example .env        # pon PAGOCLARO_ACCESS_CODE y, si quieres lecturas en vivo, ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm test` | 90 pruebas (una por caso de eval con un lector de prueba, motor, registro, documentos, alarmas, datos del tablero) |
| `npm run evals` | La suite completa con Opus 5.5, Haiku 5.5 y Sonnet 5.5; escribe `runs/<id>.json` |
| `npm run blind` | El set ciego, una vez, con los lectores reales |
| `npm run probe` | Prueba de un solo llamado a cada modelo (capacidades y costo) |
| `npm run seed` | Arma la demo de 24 facturas y dos cambios en la lista de proveedores (`--readers=replay` la reconstruye sin costo) |
| `npm run demo:static` | Exporta la demo estática a `docs/` (GitHub Pages) |

Gasto en modelos: un medidor suma el costo de cada lectura y **ninguna llamada arranca al llegar al
tope** (`MODEL_SPEND_CAP_USD`, 50 USD por defecto). Una factura cuesta unos 0.02 USD con las dos
lecturas (medido: 0.0195 USD por un PDF de una página); el desempate, cuando hace falta, suma
cerca de 0.01 USD. Al llegar al 80 % del tope, con un pago
fuera de reglas, con la cadena del registro rota o con 3 lecturas fallidas seguidas, el servidor
avisa: banner en el tablero, `alerts` en `/health` y una línea `[ALERTA]` en la consola.

## Lo construido y lo documentado

| Construido | Documentado como siguiente paso |
|---|---|
| Lectura doble con desempate, motor de reglas, registro encadenado con frases en palabras comunes, aprobación humana, lista de proveedores autorizados con cuentas por confirmar, reglas versionadas con simulación, API HTTP, tablero bilingüe con gráficas que filtran la lista, telemetría sin contenido, idempotencia, tope de gasto | Ejecución real de pagos con una plataforma (Blinka) detrás de una interfaz de riel, autenticación con identidad (hoy: código de acceso y nombre), retención configurable del primer pago y aviso al contacto anterior al cambiar una cuenta, acuerdos editables, una tercera lectura por muestreo, Postgres en lugar de JSON, ingesta desde un buzón real, tipo de cambio en vivo |

## English summary

PagoClaro is an accounts-payable agent for the Blinka challenge of Hackathon 30X. Two models read
every invoice independently (Claude Opus 5.5 and Claude Haiku 5.5, closed-schema outputs, no
tools); when they disagree, Claude Sonnet 5.5 reads it too and settles only the fields in doubt,
and if it does not confirm the main reading a person decides with that reading preloaded. A
deterministic rule engine decides PAY, HOLD or ESCALATE (strictest wins). The company keeps its
list of authorized vendors from the dashboard: a new or changed bank account waits for someone
else to confirm it, with a note on how it was checked, and is never paid by itself until then.
Every decision is told in one plain sentence in Spanish and English (who decided, why, the margin
against each limit), with the rule-by-rule detail, provenance and a hash-chained audit log
underneath. Text inside an invoice is data, never an instruction. Payments are simulated per rail
(SPEI, Pix, Bre-B, ACH). Built evals-first with a 60-case suite, a blind set authored separately,
and a property test showing that PAY implies every hard rule passed and a confirmed account.
Results on October 17 and 18, 2026: 60/60 evals with the three real readers (16/16 adversarial),
12/12 correct decisions on the blind set with no improper payment, and a SHIP verdict on the exit
audit of version 3 (the first audit, on version 1, caught a real bug, fixed with a new test).

## Licencia

MIT. Ver [LICENSE](LICENSE).
