# Blender task: build the portfolio's phone model

You are working in the Next.js portfolio repo at
`I:\Self projects with AI\Portfolio\ZIP\Portfolio-Website`, with Blender MCP.
Build a real, web-optimised 3D smartphone to replace the one the site
currently assembles in code (`components/device/Phone.tsx`). This is the
**mobile** version of the section, so it has to be light. The site's code spins
it and paints live content on its screen, so the **node names, sizes and axes
below are a contract**: get them exactly right, because the code depends on them.

## What it should look like

A premium, modern, **unbranded** flagship phone (iPhone 15 Pro class):
flat titanium frame with softly chamfered edges and antenna lines, flat front
display with a thin black border, frosted matte back glass, a raised camera
plateau with three lenses plus flash and sensor, side buttons, USB-C port and
speaker holes at the bottom. **No Apple logo or other brand marks.** Optionally,
a small round emblem centred on the back in `MAT_Accent`.

Current version for proportions and poses (it looks plasticky; yours should
look real):
`assets/device-models/current-phone-2.png` (back), `current-phone-18.png`
(turning), `current-phone-45.png` (front).

## Units and axes

- 1 Blender unit = 1 site unit. Export with **+Y up** (glTF default), so
  Blender **-Y is the front** (the screen side), +Z is up.
- Everything below is in Blender coordinates.

## Node contract

| Node | What it is | Origin / placement |
|---|---|---|
| `Phone` | Empty, root | (0, 0, 0) = centre of the body |
| `BODY` | Titanium frame and band | 1.44 wide (X) × 3.02 tall (Z) × 0.17 deep (Y), centred. Corner radius in the front view ≈ 0.26. Front face at Y = -0.085 |
| `SCREEN` | The display: ONE flat mesh, a rounded rectangle | 1.42 × 3.00, corner radius ≈ 0.25, centred, at Y = -0.0855 (just in front of the frame, so it reads flush). **UVs planar from its bounding rectangle**: U 0→1 left→right, V 0→1 bottom→top, as if it were a full 1.42 × 3.00 rectangle. The site's screen image has its own status bar and Dynamic Island painted in, so don't model a camera cut-out on the front. Material `MAT_Screen` |
| `BACK` | Back glass, flush inside the frame | Material `MAT_BackGlass` |
| `CAMERA` | Plateau, lenses, flash and sensor | Plateau centred at (X -0.32, Z +0.98) on the back (+Y side), raised ≈ 0.028. Lenses at (X, Z) = (-0.47, 1.13), (-0.17, 1.13), (-0.32, 0.83): outer ring radius 0.115, glass radius 0.082, standing proud of the plateau by ≈ 0.03 |

Buttons, as part of `BODY`, protruding ≈ 0.012:
- left side (X = -0.72): action button 0.16 tall at Z +0.89; volume up 0.26 tall at Z +0.51; volume down 0.26 tall at Z +0.17
- right side (X = +0.72): power button 0.34 tall at Z +0.49

## Materials (max 7, exactly these names)

- `MAT_Titanium`: dark natural titanium, metallic ≈ 0.95, roughness ≈ 0.3
- `MAT_BackGlass`: matte frosted dark glass (roughness ≈ 0.8, metallic ≈ 0.25), **not** glossy
- `MAT_Screen`: black placeholder (replaced at runtime)
- `MAT_Bezel`: black (thin border, if you model one)
- `MAT_LensGlass`: near-black, glossy (roughness ≈ 0.1)
- `MAT_CameraPlate`: dark grey satin
- `MAT_Accent`: only if you add the back emblem (recoloured at runtime)

Principled BSDF with base colour, metallic, roughness and optional normal map
only. **No** transmission, clearcoat, sheen, subsurface or procedural textures.

## Performance budget (hard limits; this runs on phones)

- **≤ 8,000 triangles** in total. Bevels and weighted normals instead of
  subdivision. Circles: 32 segments at most.
- All modifiers applied before export, with no stray hidden objects, cameras or lights.
- Meshes joined by material wherever the contract above doesn't need them separate.
- Textures: at most one baked AO map (512², JPG). No shadow image needed (phones don't draw one).
- Target **≤ 300 KB** for the `.glb` before compression.

## Baking

Give `MAT_Titanium`, `MAT_BackGlass` and `MAT_CameraPlate` non-overlapping UVs,
bake soft ambient occlusion to one 512² texture and plug it into the glTF
occlusion slot. It's mainly for the camera plateau, buttons and frame-to-glass
seams. Grey-scale, subtle.

## Process

- Write the build as a script, `scripts/build-phone.py`, run inside Blender,
  so it can be re-run. It must work only in its own scene named `Phone`, and
  **never touch other scenes** (`AboutWorkspace`, `Laptop`).
- Export to `public/models/phone.glb`: glTF binary, +Y up, apply modifiers,
  materials export, no animations, no cameras or lights, no compression.
- Verify, and report: bounding box of `BODY`, `SCREEN` size and UV range,
  total triangles, list of nodes and materials, file size. Take screenshots
  from the front, the back and a three-quarter view.
- Don't edit any site code; the integration is done separately.
