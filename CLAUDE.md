# Portfolio Website — Claude Context

## Project
Next.js 15 App Router, TypeScript, React 19. Personal portfolio for Ahnaf Hussain / AurixLab.

## Workflow Rules
- **Always commit and push after every code change** — never wait to be asked
- **Never add Co-Authored-By: Claude lines** to commits
- Remote: `https://github.com/AhnafH17/Portfolio-Website.git` (branch: `main`)

## Stack
- Next.js 15 App Router
- TypeScript
- GSAP (animations in showcase, preloader)
- Lenis (smooth scroll) — global instance on `window.__lenis`
- Framer Motion (hero entrance, some transitions)
- Canvas 2D (contact sparkles)
- CSS `stroke-dashoffset` animation (showcase background lines)

## Key Files

| File | Purpose |
|------|---------|
| `app/globals.css` | All CSS — variables, component styles |
| `app/layout.tsx` | Root layout, loads fonts |
| `app/page.tsx` | Page composition |
| `components/HeroSection.tsx` | Hero — uses plain `<img>` (NOT Next Image) for photo |
| `components/Navbar.tsx` | Inline SVG monogram logo (no image file) |
| `components/ShowcaseSection.tsx` | Project showcase — GSAP transitions, CSS bg lines |
| `components/ContactSection.tsx` | Contact — canvas sparkles + form + dashboard mockup |
| `components/CustomCursor.tsx` | Custom cursor — uses `style.transform` (GPU, no layout) |
| `components/LenisProvider.tsx` | Lenis smooth scroll, throttled scroll events |
| `components/Modal.tsx` | Project detail modal |
| `lib/projects.ts` | Project data + `stripMeta` array |
| `public/AhnafHussain.png` | Hero photo (1024×1024, full original, uncompressed) |

## Architecture Decisions

### Hero Photo
- Uses plain `<img>` tag, NOT `next/image` — Next.js optimization pipeline was making the photo blurry
- File: `public/AhnafHussain.png` (1024×1024 original, not compressed)

### Navbar Logo
- Inline SVG monogram "AH" with gold gradient — replaced 828KB `logo-placeholder.svg`

### Showcase Background
- Pure CSS `stroke-dashoffset` animation on SVG paths — replaced Framer Motion `BackgroundPaths` which caused main-thread lag
- 3 animation speeds: 22s / 28s / 34s via `.sc-path-0/1/2` classes

### Contact Sparkles
- Canvas 2D, 3D perspective projection: `scale = FL / (z + FL)`
- Hyperspace streak effect: gradient line from previous projected pos → current projected pos
- Motion trail: semi-transparent fill (`rgba(8,6,3,0.18)`) instead of `clearRect`
- `IntersectionObserver` pauses rAF when section off-screen
- Gold palette: `[{r:201,g:168,b:76}, {r:226,g:201,b:115}, {r:255,g:232,b:140}, {r:180,g:130,b:48}, {r:255,g:248,b:200}]`

### Custom Cursor
- `style.transform = translate(x,y)` — compositor-only, no layout recalculation
- `will-change: transform` on both dot and ring elements

### Lenis Scroll
- Throttled: only dispatches `window.scroll` event when actually scrolling (100ms debounce)
- Was previously firing every rAF tick (60×/sec)

### Showcase Click Behavior
- **Small cards (right panel)**: `onClick={() => handleSelect(idx)}` — switches displayed project only
- **Main display image**: `onClick={() => onOpenModal(active.key)}` — opens modal
- **VIEW PROJECT button**: `onClick={(e) => { e.stopPropagation(); onOpenModal(active.key); }}`
- **Mobile cards**: `onClick={() => { handleSelect(mobilePair + i); onOpenModal(meta.key); }}` — both switch + open

## CSS Design Tokens (globals.css)
```css
--gold:        #c9a84c
--gold-light:  #e2c973
--gold-dim:    rgba(201,168,76,0.45)
--accent-glow: rgba(201,168,76,0.7)
--bg:          #080603
--bg-2:        #0d0b06
```

## Contact Section Layout
- `.ct-section` — full-width dark background `#080603`, canvas sparkles behind everything
- `.ct-wrap` — two-column: left (form) + right (dashboard mockup)
- `.ct-dash` — `width: 550px`, `overflow: visible` (allows bubbles to bleed outside)
- `.ct-dash-inner` — `overflow: hidden` (clips dashboard content)
- `.ct-bubble-*` — `z-index: 10`, positioned with negative offsets to overlay dashboard edge
- Input borders: `padding: 1.5px` gradient border technique, gold glow on focus

## Plan: Hero Section Redesign (Next Up)
See `.claude/plans/i-want-to-do-zazzy-octopus.md` for the full plan:
- Giant left-side name text (`clamp(3.8rem, 8vw, 8rem)`)
- 3 concentric gold rings around arch photo frame
- 2 floating screenshot cards (code editor left, UI right) behind the arch
- 12 static gold bokeh particle dots (no randomness — avoids hydration mismatch)
- Stronger ambient amber glow on right side
- Framer Motion float animation for cards
