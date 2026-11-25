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
| `components/DeskHero.tsx`, `components/desk/` | Opening desk and selected work — one pinned camera tour, three live project displays and the static project index |
| `components/Navbar.tsx` | Inline SVG monogram logo (no image file) |
| `components/ShowcaseSection.tsx` | Project showcase — GSAP transitions, CSS bg lines |
| `components/ContactSection.tsx` | Contact — canvas sparkles + form + dashboard mockup |
| `components/CustomCursor.tsx` | Custom cursor — uses `style.transform` (GPU, no layout) |
| `components/LenisProvider.tsx` | Lenis smooth scroll, throttled scroll events |
| `components/Modal.tsx` | Project detail modal |
| `lib/projects.ts` | Project data + `stripMeta` array |
| `public/images/hero/` | Hero portrait cut-out: `portrait-cutout-{400,542}.{avif,webp}` |
| `public/images/projects/` | Project thumbnails, each named after its key in `lib/projects.ts` |
| `assets/hero-portrait-master.png` / `hero-portrait-cutout.png` | Hero source photo and its background-removed cut-out (rembg, birefnet-portrait); the served files are encoded from the cut-out with sharp |
| `public/models/*.glb` | Compressed (meshopt + WebP) by `scripts/optimize-models.mjs` from the Blender exports in `assets/models-src/`; re-run it after re-exporting |
| `public/models/about-workspace.glb` | About-section 3D workspace, built by `scripts/build-about-workspace.py` in Blender |
| `lib/handoff.ts` + `components/handoff/` | Section-to-section handoffs (one overlay, one loop): Impacts→Testimonials particles, Testimonials→Contact CRT switch-off + transmission |
| `lib/coreHandoff.ts` | The About core cube's live position, for its flight into Impacts |
| `components/about/stops.ts` | The About tour: each camera stop and the words shown there. The section is 3D only; the same words sit in the HTML, visually hidden |
| `scripts/build-laptop.py` | Laptop model: the AH monogram on the lid (`LOGO`, Greater Theory like the navbar, MAT_Accent), Return key as its own node `KEY_Return` (no longer animated; the section has no key-press ending) |
| `lib/caseStudies.ts` | Full case studies for all 11 projects (problem, role, approach, images, result), rendered by `ProjectPageContent`; images in `public/images/case/`. Facts only: a figure belongs to the project it was measured on, and dashboard images are labelled demo data |
| `lib/projectBlur.ts` | Inlined blurred previews of the project thumbnails (no empty cards); regenerate with `node scripts/make-project-blur.mjs` when a thumbnail changes |
| `assets/about-workspace/` | Monitor UI texture + accent UVs, drawn by `scripts/make-about-screen.py` |

## Architecture Decisions

### Desk hero
- Regenerate the model with `blender -b -P scripts/build-desk-hero.py`, then `node scripts/optimize-models.mjs desk-hero`, then `node scripts/make-desk-outline.mjs` (the preloader's line drawing, below).
- `components/desk/beats.ts` measures the display corners and fits the tour. The work anchor lands on the first screen hold.
- The opening camera is `heroPose()` in `components/desk/heroPose.ts` (no three.js), used by both `fitTour` and the preloader; scroll timing and the power-on clock live in `components/desk/timeline.ts`, so DeskHero's first bundle carries no three.js. Change the framing there, then regenerate the outline.
- `components/desk/screens.ts` paints one animated texture per monitor (only changed regions are redrawn; 30 fps near, 8 fps far, none off screen). Pointer and touch raycast the three SCREEN_* meshes from any camera position and hit-test the same card rectangles; clicking empty screen scrolls to that monitor's hold. The HTML links over the screens are for keyboard and screen readers only. Regenerate the thumbnail atlas with `node scripts/make-desk-thumbnails.mjs` after editing a project image.
- The preloader reports model transfer and rendering before starting the hands. Its timeout, reduced-motion mode, and WebGL failures all reveal the static index.

- Preloader drawing = the real model: `scripts/make-desk-outline.mjs` writes `public/models/desk-outline.json` (furniture boxes, screen corners, LED strip, fan, and per view (wide / phone) the hard edges and contours with hidden lines removed, ~16 KB gz). `components/desk/outline.ts` projects it with the hero camera into per-part canvases, so every line sits on the desk's pixels. Re-run the script after any model or hero-framing change.
- Handover is in place: the camera never moves; on the clock in `timeline.ts` (`handover.start`, set when the bars start to open) the room lights up while the lines dissolve part by part, the drawn LED gives way where the real sweep has lit, the screens power on, and the name's words fly into the `#desk-name` heading (transforms) and cross-fade. Only opacity/transform change during it; the idle drift starts after `INTRO_END`.
- `ready` means warmed up: DeskModel uploads textures, runs `compileAsync` and renders two frames (nothing draws before that) while the loader still shows "Powering the screens". Quality never downgrades during the power-on, and below-fold sections mount after it.
- Phones and lower-capability devices use a 30 fps, 1.6× pixel-ratio budget (`components/desk/quality.ts`). Desktop starts with a 60 fps, 2× budget and drops to the lighter profile after sustained slow frames. Save Data and devices reporting at most 2 GB of memory use the static index.
- Pointer targets follow the monitors near each stop. Keyboard users can focus a settled monitor, open the static list, or skip directly to About Me.
- About rises in during the pull-back from the last monitor (beats.ts), not after it.
- Loader: `DESK_MODEL_BYTES` in `components/desk/loadModel.ts` must match `public/models/desk-hero.glb` after a re-export (the loader's progress uses it when the server sends no size).

### Navbar Logo
- Inline SVG monogram "AH" with gold gradient (the old 828KB `logo-placeholder.svg` is gone)

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

### About Workspace Model (`about-workspace.glb`)
- Rebuilt from scratch by `scripts/build-about-workspace.py` (run inside Blender; it only
  touches the `AboutWorkspace` scene). References: `assets/references/about-workspace/`
- Every glow shares ONE material, `MAT_Accent_Emissive`, so the palette recolours it at
  runtime (the site clones it for `CUBE_Core` and dims the shared one: only the core glows). No texture holds accent colour; the screen's accent marks are meshes
- The exporter normalises emissive: colour is stored as a unit colour plus
  `emissiveStrength` 2.415 (= #CC182C × 4). When recolouring set both `emissive` and
  `emissiveIntensity` (≈ 2.4), not just the colour
- `PLT_*`, `CUBE_Core`, `PANEL_*`, `TOWER_*` are separate nodes with origin at their
  bottom-face centre; props are children of their platform, so lifting a node's
  position.y lifts everything on it. Root node `AboutWorkspace`; front faces +Z in three.js
- Each `PLT_*` mesh is single-material on purpose: GLTFLoader names a multi-material
  node's sub-meshes `PLT_Desk_1`, `_2`… which would match a `startsWith('PLT_')` check.
  Seams/glow live in `TRIM_*` / `GLOW_*` children. Never name a non-platform `PLT_*`
- `CUBE_Core` has a glowing child `CORE_Glow`; bridges, cube socket and under-desk
  glow are static (`BASE_Static`)
- Metallic dark body reads flat black without an environment map — give the scene
  `RoomEnvironment` (PMREM) and `NeutralToneMapping` (the Blender preview uses
  Khronos PBR Neutral to match)

### About Tour
- Pinned, centred; the camera tours six stops as you scroll (`components/about/stops.ts`). Each stop's words are real HTML over the canvas (`.ab3-say`, no panel), on the side the structure leaves free (`side` per stop; phones: text band on top, structure below). The camera frames each structure into the free part of the screen, measured from where the words land. Text in/out is a pure function of scroll. No hover effects on the structures.
- Reduced motion / no WebGL: the same HTML as a plain page.
- Laptop → About is a stack-up: the laptop stays front-on with its code scrolling (no camera move to the keyboard, no Return key press), then `.ab3` rises over the pinned laptop scene (`margin-top:-100svh`); the laptop darkens and scales back by scroll and stops rendering once covered. The core stop's words clear, then the cube flies into Impacts.
- Device scenes size the device to the resting camera's view (`restingView` in deviceModel.ts), never the live camera, so scrolling back up can't shrink it. Everything in the laptop/phone ending must be a function of scroll progress.

### Showcase Click Behavior
- **Small cards (right panel)**: `onClick={() => handleSelect(idx)}` — switches displayed project only
- **Main display image**: `onClick={() => onOpenModal(active.key)}` — opens modal
- **VIEW PROJECT button**: `onClick={(e) => { e.stopPropagation(); onOpenModal(active.key); }}`
- **Mobile cards**: `onClick={() => { handleSelect(mobilePair + i); onOpenModal(meta.key); }}` — both switch + open

## Palette
- Crimson only. Gold (`amber`) stays defined in `app/globals.css` but inactive: switch
  `ACTIVE_PALETTE` in `lib/palette.ts` (and the matching value in the inline script in
  `app/layout.tsx`) to `'amber'` to turn it on. There is no theme switcher and no `?theme`.
- Anything drawn in the accent outside CSS must follow changes: `useAccent()` in React scenes,
  `onPaletteChange()` in canvas loops. Don't read the accent once at mount (nothing fires the change now, but a palette switch may come back).
- Every palette passes WCAG AA for body, dim, small-accent and placeholder text; keep it that way
  when changing tokens (crimson's `--accent-glow` was lifted to #F23D50 for that).

## Typography
- Two typefaces only: **Greater Theory** (`--font-display`: names, titles, big numbers) and
  **DM Sans** (`--font-body`: everything else, incl. small uppercase UI labels). Don't add a third.
- DM Sans is variable 300–600; ask for 600, not 700+. Greater Theory is one wide weight: big text only.
- Greater Theory is a personal-use licence; it needs a commercial licence before the live site ships.
- Small text in the accent colour uses `--accent-light` (passes 4.5:1); `--accent-glow` is for big type only.

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
