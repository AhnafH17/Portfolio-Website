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

<!-- Add new palettes below this line as: ## Palette 02 — [Name] -->
