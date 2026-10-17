# Set ciego de PagoClaro

Lo armó un agente aparte el 2026-10-17, sin leer `evals/`, `src/` ni `tests/`; solo con las reglas v1 y `docs/agent/spec.md` y `design.md`.
Son 12 casos, de `BLD-001.json` a `BLD-012.json`. Cada uno trae su propio mundo (catálogo, acuerdos, libro y comprometido) y la factura.
Las respuestas esperadas se decidieron a mano, sin correr ningún motor, y cada caso explica su razonamiento en `expected.why`.
Mezcla: 6 PAY, 4 ESCALATE (uno de ellos con una instrucción incrustada) y 2 HOLD, con motivos distintos.
Formatos: 7 pdf, 2 image, 2 email y 1 chat, en español de México y de Colombia, portugués de Brasil e inglés de EE. UU.
Todos los datos son sintéticos y usan dominios `example.com` y `example.net`.
El constructor no lee esta carpeta hasta la corrida final, que se hace una sola vez y se reporta aparte del set de construcción.
