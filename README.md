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
   salida estructurada y esquema cerrado; el modelo no tiene herramientas. Si las lecturas no
   coinciden en identificación fiscal, número, moneda, total o cuenta, la factura se escala.
2. **Cruza lo leído con lo registrado**: proveedor por identificación fiscal (RFC, NIT, CNPJ, EIN),
   cuenta registrada, contrato u orden de compra con su saldo, y el libro de pagos.
3. **Decide con un motor de reglas determinista**: 17 reglas, el resultado es el más estricto
   (FRENAR > ESCALAR > PAGAR). El motor no usa modelos ni lee texto libre.
4. **Registra y explica**: cada decisión guarda todas las reglas evaluadas, su porqué en español e
   inglés, la versión de reglas, el tipo de cambio con fecha y fuente, los modelos lectores y un
   hash encadenado con la entrada anterior. Pagar emite una **instrucción de pago simulada** por el
   riel de la moneda (SPEI, Pix, Bre-B, ACH). No se mueve dinero real.
5. **Escala a una persona** lo que pide criterio. La aprobación vuelve a evaluar con las reglas
   vigentes y solo levanta los motivos que piden criterio; una cuenta distinta a la registrada o un
   texto con órdenes **nunca** se aprueban desde el tablero.

## Las trampas que cubre

| Trampa (las de Blinka y más) | Qué hace PagoClaro |
|---|---|
| Cobro duplicado | Frena (mismo proveedor y número) o escala (mismo monto en ±10 días) |
| Beneficiario nuevo | Escala; un nombre parecido con otro RFC no cuenta como el proveedor |
| Factura que no cuadra con lo acordado | Escala si no cuadra con el contrato; frena si rebasa el saldo de la orden de compra |
| Monto arriba del límite | Escala para aprobación humana; arriba del tope duro, frena |
| Presupuesto insuficiente del periodo | Frena |
| Cuenta bancaria distinta a la registrada ("cambio de cuenta urgente") | Escala, y la aprobación no la puede levantar |
| Instrucciones escondidas en la factura (texto blanco en PDF, nota en una foto, correo o chat) | Se copian como dato y la factura se escala; nunca se obedecen |
| Moneda ambigua ("$" sin código) o sin tipo de cambio | Escala; nunca se infiere la moneda por el país |
| Cobro partido para no pasar el límite | Escala (suma de 7 días) |
| Lecturas que no coinciden | Escala; la persona elige cuál lectura vale |
| Archivo ilegible o lector caído | Escala; un fallo al guardar no deja instrucciones a medias |

## Por qué confiar en él

- **Cero pagos fuera de reglas, probado y no solo prometido**: una prueba de propiedad genera 20,000
  facturas y reglas al azar y verifica que PAGAR implica que toda regla dura pasó.
- **Doble lectura con dos modelos**: es difícil que se equivoquen igual; si difieren, decide una persona.
- **Texto es dato**: los lectores no tienen herramientas y el motor no lee texto libre. Una
  inyección solo puede ensuciar una lectura, y eso escala.
- **Explicable sin abrir el código**: cada decisión trae su porqué regla por regla, con procedencia
  (`source`, `calculated`, `user-decided`) de cada cifra.
- **Registro a prueba de alteraciones**: editar cualquier entrada rompe la cadena desde esa entrada.
- **Barreras deterministas alrededor de un modelo probabilístico**: el modelo nunca está del lado de
  la decisión; las reglas son la autorización permanente que una persona aprobó, versionada.

## Cómo se construyó

Con el estándar **agent-engineering** de Edgar (track heavy): diseño → spec con 40 escenarios
Gherkin → **46 evals escritos antes del código** (34 golden + 12 adversariales) → build con un
runner que corre la suite contra los lectores reales → auditoría de salida. Además, un **set ciego**
de 12 facturas lo escribió un agente aparte, sin ver los evals ni el código, y se corre una sola vez
al final. Los artefactos están en [`docs/agent/`](docs/agent/) y [`evals/`](evals/).

## Resultados (17 de octubre de 2026)

| Prueba | Resultado | Archivo |
|---|---|---|
| Suite de 46 evals con Opus 5.5 y Haiku 5.5 reales | 46/46 en verde, con los 12 adversariales | [`runs/20261017T151303Z.json`](runs/20261017T151303Z.json) |
| Set ciego de 12 facturas, corrido una sola vez | 12/12 decisiones correctas, 0 pagos indebidos; 8 resueltas sin persona y las 4 que tocaba escalar, escaladas | [`runs-blind/20261017T152812Z.json`](runs-blind/20261017T152812Z.json) |
| Auditoría de salida | SHIP en la segunda vuelta | [`docs/agent/ship-report.md`](docs/agent/ship-report.md) |

La primera auditoría dio NO-SHIP, y así quedó registrado. Un chat con una orden de pago escaló por
lecturas distintas, pero no por texto con órdenes, porque Haiku dejó vacíos los campos del chat.
El build se reabrió, el arreglo entró con una prueba hecha con esas dos lecturas reales y la
re-auditoría salió limpia. Correr la suite completa cuesta unos 0.70 USD.

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
| `npm test` | 69 pruebas (una por caso de eval con un lector de prueba, motor, registro, documentos, alarmas) |
| `npm run evals` | La suite completa con Opus 5.5 y Haiku 5.5; escribe `runs/<id>.json` |
| `npm run blind` | El set ciego, una vez, con los lectores reales |
| `npm run probe` | Prueba de un solo llamado a cada modelo (capacidades y costo) |
| `npm run seed` | Arma la demo de 23 facturas (`--readers=replay` la reconstruye sin costo) |
| `npm run demo:static` | Exporta la demo estática a `docs/` (GitHub Pages) |

Gasto en modelos: un medidor suma el costo de cada lectura y **ninguna llamada arranca al llegar al
tope** (`MODEL_SPEND_CAP_USD`, 50 USD por defecto). Una factura cuesta unos 0.02 USD con las dos
lecturas (medido: 0.0195 USD por un PDF de una página). Al llegar al 80 % del tope, con un pago
fuera de reglas, con la cadena del registro rota o con 3 lecturas fallidas seguidas, el servidor
avisa: banner en el tablero, `alerts` en `/health` y una línea `[ALERTA]` en la consola.

## Lo construido y lo documentado

| Construido | Documentado como siguiente paso |
|---|---|
| Lectura doble, motor de reglas, registro encadenado, aprobación humana, reglas versionadas con simulación, API HTTP, tablero bilingüe, telemetría sin contenido, idempotencia, tope de gasto | Ejecución real de pagos con una plataforma (Blinka) detrás de una interfaz de riel, autenticación con identidad (hoy: código de acceso y nombre), Postgres en lugar de JSON, ingesta desde un buzón real, tipo de cambio en vivo |

## English summary

PagoClaro is an accounts-payable agent for the Blinka challenge of Hackathon 30X. Two models read
every invoice independently (Claude Opus 5.5 and Claude Haiku 5.5, closed-schema outputs, no
tools); a deterministic rule engine decides PAY, HOLD or ESCALATE (strictest wins); every decision
is explained rule by rule in Spanish and English, with provenance and a hash-chained audit log.
Text inside an invoice is data, never an instruction. Payments are simulated per rail (SPEI, Pix,
Bre-B, ACH). Built evals-first with a 46-case suite, a blind set authored separately, and a
property test showing that PAY implies every hard rule passed. Results on October 17, 2026: 46/46
evals with the real readers (12/12 adversarial), 12/12 correct decisions on the blind set with no
improper payment, and a SHIP verdict on the second exit audit (the first one caught a real bug,
fixed with a new test).

## Licencia

MIT. Ver [LICENSE](LICENSE).
