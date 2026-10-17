# Product

> Redactado el 2026-10-17 por Claude a partir de lo acordado con Edgar en la sesión (reto Blinka del Hackathon 30X). Edgar delegó las decisiones mientras dormía y revisa este archivo al final.

## Register

product

## Users

- **Equipo de finanzas de una empresa con sede en EE. UU. que paga a proveedores en Latinoamérica** (México, Colombia, Brasil): suben facturas, revisan pendientes, aprueban o rechazan y ajustan reglas. Lo usan en un monitor de oficina, en español o inglés, varias veces al día.
- **Jurado del reto Blinka**: ve la demo proyectada en una sala iluminada o abre la demo estática en su laptop. Tiene minutos para entender qué decidió el agente, por qué, y si se puede confiar en él.

## Product Purpose

PagoClaro revisa las cuentas de una empresa y decide cuáles pagar por ella dentro de las reglas que la empresa define, y escala a una persona lo que se sale de ellas. El modelo solo lee la factura (dos veces, con dos modelos); un motor de reglas determinista decide; cada decisión queda explicada y encadenada en un registro. Éxito: decisiones correctas sin intervención humana en la mayoría de los casos, cero pagos fuera de las reglas, y que cualquiera entienda cada decisión sin abrir el código.

## Brand Personality

Claro, sobrio, verificable. La voz es la de un buen analista de cuentas por pagar: directa, sin adornos, cita la regla y la cifra. Emoción buscada: confianza tranquila ("esto no me va a pagar algo indebido"), no entusiasmo.

## Anti-references

- Tableros SaaS genéricos con tarjetas idénticas y métricas gigantes con degradados.
- El cliché de finanzas azul marino con dorado; el modo oscuro de terminal como sustituto.
- Interfaces de "IA mágica" que esconden el porqué (chats que solo dicen "aprobado").
- Rojo y verde como único portador de significado (siempre palabra más color).

## Design Principles

1. **El porqué antes que el qué**: cada decisión se muestra con sus reglas, cifras y fuentes; el estado es la conclusión, no el titular aislado.
2. **Practicar lo que predica**: si el agente promete trazabilidad, la interfaz muestra procedencia, versión de reglas y la cadena del registro sin pedirlo.
3. **Lo dudoso se ve dudoso**: diferencias entre lecturas, texto con órdenes y montos sin moneda se señalan a primera vista, nunca se suavizan.
4. **Familiar antes que ingenioso**: patrones de herramienta financiera seria (tablas, filtros, panel de detalle); la sorpresa no paga facturas.
5. **Bilingüe de verdad**: español primero, inglés completo; las explicaciones vienen de plantillas fieles en ambos idiomas.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste AA en todo texto, foco visible, navegación completa con teclado, estados con palabra y no solo color (daltonismo), respeto de `prefers-reduced-motion`, objetivos táctiles de 44 px en pantallas táctiles, legible proyectado.
