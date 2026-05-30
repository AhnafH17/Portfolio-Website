# Color Palettes

## How to Apply a New Palette

All colors are CSS custom properties in `app/globals.css` inside `:root { ... }`.
To switch palettes, update those variables. Also check hardcoded `rgba(201,168,76,...)` values
in the same file and replace with the new accent color.

---

## Palette 01 — Current (Dark Gold)

> Original site palette. Dark near-black background, warm cream text, gold accents.

```css
:root {
  --black:      #0d0d0d;
  --black-deep: #070707;
  --gold:       #F4EDDD;   /* main text / headings */
  --gold-dim:   #c4b99a;   /* body text / muted */
  --gold-bright:#fff8ec;   /* bright highlight */
  --accent:     #c9a84c;   /* gold accent */
  --accent-glow:#e2c973;   /* lighter gold, glows */
  --font-display: 'Syne', sans-serif;
  --font-body:    'DM Sans', sans-serif;
}
```

**Background hex used inline:** `#080603`, `#0d0b06`, `#070707`
**Accent rgba used inline:** `rgba(201,168,76, …)` throughout globals.css

---

## Palette 02 — Crimson Navy (ACTIVE)

> Red + dark-navy scheme. Replaced the gold/black palette on 2026-05-30.

| # | Hex | Role |
|---|-----|------|
| 1 | `#C2CAD0` | Primary text / headings (`--gold`, `--silver`) |
| 2 | `#596A77` | Muted blue-grey accent (`--steel`) |
| 3 | `#384857` | Dark blue-grey, borders/surfaces (`--steel-dark`) |
| 4 | `#151B24` | Main background (`--black`) |
| 5 | `#4A121D` | Dark wine, secondary surface (`--wine`) |
| 6 | `#A41326` | Deep red accent (`--accent`) |
| 7 | `#CC182C` | Bright red, glow/highlight (`--accent-glow`) |

```css
:root {
  --black:      #151B24;
  --black-deep: #0d131b;
  --gold:       #C2CAD0;   /* primary text — name kept for compatibility */
  --gold-dim:   #8d9aa6;   /* secondary text (lightened steel for contrast) */
  --gold-bright:#e6eaed;
  --accent:     #A41326;
  --accent-glow:#CC182C;
  --steel:      #596A77;
  --steel-dark: #384857;
  --wine:       #4A121D;
  --silver:     #C2CAD0;
}
```

**Hardcoded values mapped site-wide:**
- `rgba(201,168,76,…)` → `rgba(204,24,44,…)` (gold glow → bright red)
- `#c9a84c` / `#e2c973` → `#cc182c`
- Backgrounds `#080603`→`#10151c`, `#0d0b06`→`#161d27`, `#060401`→`#0a0e14`
- Gold-brown `#a07830` → `#7a0f1d` (wine)
- Canvas sparkle palette (ContactSection) + preloader particle GOLD → red/silver shades
- Globe: arcs/points `#cc182c`, atmosphere `rgba(204,24,44,0.85)`, CSS filter `hue-rotate(-30deg)`

<!-- Add new palettes below this line as: ## Palette 03 — [Name] -->
