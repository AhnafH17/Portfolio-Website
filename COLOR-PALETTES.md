# Color Palettes

## Random Palette System (ACTIVE)

The site now ships **4 palettes** and picks one **at random on each page load**.

- Each palette is a CSS variable set in `app/globals.css` under `[data-palette="…"]`
  (crimson / teal / amber / purple). `:root` defaults to crimson.
- An inline script in `app/layout.tsx` `<head>` sets `document.documentElement[data-palette]`
  to a random one before first paint (no flash). It does NOT persist — random every visit.
- The bright accent is exposed as `--accent-rgb` (an `r,g,b` triplet) so
  `rgba(var(--accent-rgb), a)` works for every glow/border.
- Canvas / WebGL bits can't read CSS vars, so they call `readAccent()` from
  `lib/accent.ts` at runtime: ContactSection sparkles, StarField, the globe
  (TestimonialSection), the preloader particles, and project-page tech icons.
- Globe earth-texture tint is hue-rotated per palette via `[data-palette] .ts-globe-clip`.

**To add a 5th palette:** add a `[data-palette="name"]{…}` block in globals.css with the
same variables, and add `'name'` to the array in the layout.tsx inline script.

---

## How a single palette was originally applied (reference)

All colors are CSS custom properties in `app/globals.css` `:root`. Hardcoded accent
values were converted to `rgba(var(--accent-rgb), a)` / `var(--accent-glow)` so they
follow the active palette.

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
