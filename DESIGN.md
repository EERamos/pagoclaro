# Design

PagoClaro dashboard (`web/`). Plain HTML, CSS and JS, no build. Tokens live on `:root` in
`web/styles.css`. Register: product (see PRODUCT.md).

## Scene

A jury at the Hackathon 30X watches the demo projected in a lit meeting room, and a finance
analyst reviews pending invoices on an office monitor in the morning. The analyst is not a
developer: every screen speaks in common words, and anything technical sits one click away under
"Ver detalle técnico".

## Visual theme

The palette and type of blinka.co (Edgar's request, 2026-10-17), without its name or logo:
off-white paper, navy ink, one blue accent, and Blinka's green for paid. The decision colors are
the only saturated color besides the accent, and every state carries a word next to its color.
A dark mode follows `prefers-color-scheme` with the site's own dark surfaces.

## Color (OKLCH, hex from blinka.co in comments in `web/styles.css`)

| Role | Token | Value | Notes |
|---|---|---|---|
| Page | `--paper` | 97.5% 0.004 106 (#f7f7f4) | |
| Surfaces | `--sheet` / `--sheet-2` | #fdfdfd / #eef0f2 | panels, quiet fills |
| Lines | `--line` / `--line-2` | #dedfdc / #e4e6ef | |
| Ink | `--ink` / `--ink-2` / `--muted` | #1c253a / #47525d / #656975 | muted is AA on paper |
| Accent | `--accent` (+ hover, soft, tint) | 48% 0.208 267 (#2a4bd0) | primary buttons, focus, selection |
| Paid | `--ok` / `--ok-soft` | #007456 | Blinka's green |
| Needs review | `--warn` / `--warn-soft` | 50% 0.11 70 | derived at the green's lightness |
| Held | `--stop` / `--stop-soft` | 50% 0.16 28 | derived at the green's lightness |

Every text pair reaches a contrast of 5:1 or more.

## Typography

- Inter for UI and figures (tabular numbers; currency code at 0.72 em and lower opacity), Geist
  Mono for the technical details, both from Google Fonts, as blinka.co uses them.
- Headings at weight 450 to 500 with slight negative tracking.

## Sections

1. **Facturas**: the metrics are also the filters (todas, por revisar, pagadas, frenadas), the
   paid amount and "Pagos fuera de reglas: 0"; alarms as a plain notice; pending invoices first,
   each with its state in words and one sentence; the detail explains the decision in one or two
   sentences, quotes any suspicious text as data, and holds "Tu decisión" (approve or reject with
   a note, choosing the reading when they disagree, with the suggested one preselected).
2. **Proveedores autorizados**: add, deactivate or reactivate, change an account with a reason,
   and confirm a pending account with a verification note; "N facturas esperan por esta cuenta"
   and "Tú hiciste este cambio" when the actor is the one who changed it.
3. **Ajustes**: the rules with common names, "Ver qué cambiaría" and "Guardar".
4. **Historial**: a timeline of plain sentences by day; the chain check reads "Completo y sin
   alteraciones".

## Layout and motion

Max width around 1200 px, 16 px gutters on phones, no horizontal scroll at 375 px; 44 px targets on
coarse pointers; visible focus; a skip link. Short color transitions only, all stopped under
`prefers-reduced-motion`.
