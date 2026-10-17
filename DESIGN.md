# Design

PagoClaro dashboard (`web/`). Plain HTML, CSS and JS, no build. Tokens live on `:root` in
`web/styles.css`. Register: product (see PRODUCT.md).

## Scene

A jury at the Hackathon 30X watches the demo projected in a lit meeting room, and a finance
analyst reviews pending invoices on an office monitor in the morning. Light theme on purpose: dark
themes and pale tints wash out on projectors.

## Visual theme

Ledger, not SaaS: warm paper surfaces, near-black ink with a faint green cast, one mint "stamp"
for the brand mark. Restrained strategy: the decision colors (pay, hold, escalate) are the only
saturated color on the page, and every state carries a word next to its color.

## Color (OKLCH)

| Role | Token | Value | Notes |
|---|---|---|---|
| Page | `--bg` | 97.4% 0.008 85 | warm paper |
| Surface | `--surface` / `--surface-2` | 99.3% / 95.6% | panels, rule rows |
| Lines | `--line` / `--line-strong` | 90.5% / 82.5% | |
| Ink | `--ink` / `--ink-2` / `--muted` | 23% / 39% / 49%, hue 165 | muted is AA on `--bg` |
| Structure | `--night` / `--night-2` | 22% / 30%, hue 168 | top bar, primary buttons, active tab |
| Brand | `--mint` | 81% 0.15 160 | only on `--night` (mark, focus in the top bar) |
| Pay | `--pay` / `--pay-soft` | 48% 0.12 155 / 95% | |
| Hold | `--hold` / `--hold-soft` | 50% 0.17 25 / 95.5% | also differences between readings |
| Escalate | `--esc` / `--esc-soft` | 45% 0.1 65 / 95.5% | |
| Info | `--info` / `--info-soft` | 50% 0.12 255 / 95.5% | focus ring, selected row, simulated label |

No pure white or black anywhere: light text on dark is oklch(97% 0.006 165).

## Typography

- Inter for UI and data (tabular figures on); IBM Plex Mono for codes, rule names, hashes,
  labels in caps (11 to 12.5 px, 0.06 to 0.08 em tracking).
- Scale: 11 / 12.5 / 13.5 / 15 (base) / 17 / 20 / 24 / 26 px.

## Components

- **KPI band**: one panel split by 1 px rules, not a grid of cards.
- **Decision badge**: dot plus word (Pagada, Frenada, Pendiente…), tinted background.
- **Rule row**: glyph circle (✓ pass, × hold, ! escalate, ↑ lifted by an approval), rule code in
  mono, then the bilingual message. Failures and approvals on top; passes folded in a
  `<details>` (open when everything passed).
- **Readings table**: primary vs check, a difference turns the cell red with ≠.
- **Suspicious text**: quoted in mono inside a hold-tinted box, labeled "tratado como dato".
- **Payment card**: rail, amount, USD, rate, beneficiary, masked account, "SIMULADA" label.
- **Timeline**: dot and rule per audit entry with the hash prefix and its previous hash.
- **Buttons**: default, primary (night), ok (pay green), danger (outlined hold), ghost; busy
  state with a spinner and `aria-busy`; 44 px on coarse pointers.

## Layout

Max width 1520 px, 24 px gutters (16 px on phones). Inbox: list and detail side by side above
1100 px, stacked below. Radius 14 px panels, 9 px controls.

## Motion

150 ms color transitions, 220 ms toast rise (ease-out-quart), spinner only while busy. Nothing
animates layout; everything stops under `prefers-reduced-motion`.
