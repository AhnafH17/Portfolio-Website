# Blender task: build the portfolio's laptop model

You are working in the Next.js portfolio repo at
`I:\Self projects with AI\Portfolio\ZIP\Portfolio-Website`, with Blender MCP.
Build a real, web-optimised 3D laptop to replace the one the site currently
assembles in code from boxes and planes (`components/device/Laptop.tsx`). The
site's code animates it (spins it 180°, opens the lid, paints live content on
the screen), so the **node names, pivots, sizes and axes below are a contract**:
get them exactly right, because the code depends on them.

## What it should look like

A premium, modern, **unbranded** aluminium laptop (MacBook Pro class): thin
base, crisp chamfered edges, a real keyboard with individual keys, a recessed
trackpad, a hinge barrel, a slim black bezel, rubber feet, speaker grilles
either side of the keyboard. **No Apple logo or other brand marks.** The back
of the lid carries one round emblem (see `LOGO`).

Current version for proportions and poses (it looks flat and toy-like; yours
should look real):
`assets/device-models/current-laptop-2.png` (closed, back view),
`current-laptop-18.png` (closed, turning), `current-laptop-45.png` (open, front).

## Units and axes

- 1 Blender unit = 1 site unit. Export with **+Y up** (glTF default), so
  Blender **-Y is the front** (the side the screen and keyboard face), +Z is up.
- Everything below is in Blender coordinates.

## Node contract

| Node | What it is | Origin / placement |
|---|---|---|
| `Laptop` | Empty, root of everything | (0, 0, 0) = centre of the base |
| `BASE` | Base body, aluminium | 3.06 wide (X) × 2.00 deep (Y) × 0.08 thick (Z), centred on the origin (so Z from -0.04 to +0.04) |
| `KEYS` | All keycaps as ONE mesh | On the base top (Z ≈ +0.04), in a deck area within 2.92 × 1.86 |
| `LID` | Lid body, aluminium. **Origin on the hinge axis** at (0, +1.0, +0.04) | **Rest pose = lid standing straight up** (90° to the base), screen facing -Y. The lid is 3.06 wide × 2.00 tall × 0.06 thick and rises from the hinge, so its centre is 1.0 above the origin. The code rotates `LID` about its local X to close it; it must close flat onto the keyboard when rotated +90° about X, so check that direction |
| `SCREEN` | Child of `LID`. A single flat rectangle, 4 vertices | 2.92 wide × 1.87 tall, centred 1.0 above the hinge, on the lid's front face, 0.016 in front of the lid's front surface. UVs fill 0–1 exactly: U left→right, V bottom→top. Material `MAT_Screen` (plain black, the site replaces it with live content) |
| `BEZEL` | Child of `LID`, black glass border | 3.00 × 1.95, just behind `SCREEN` |
| `LOGO` | Child of `LID`, on the back of the lid, centred | A disc of radius ≈ 0.26 with a slight raised or engraved look. Material `MAT_Accent` only |
| `SHADOW` | Child of `Laptop`, flat plane on the ground under the base | See "Baking" |

Everything else (feet, grilles, ports, hinge barrel, trackpad) can be part of
`BASE` or `LID`, joined by material.

## Materials (max 7, exactly these names)

- `MAT_Aluminium`: silver, metallic ≈ 0.9, roughness ≈ 0.4
- `MAT_Keys`: near-black matte keycaps
- `MAT_Bezel`: black, slightly glossy
- `MAT_Screen`: black placeholder (replaced at runtime)
- `MAT_Accent`: emissive placeholder in any colour (recoloured at runtime to the site's palette)
- `MAT_Rubber`: feet
- `MAT_Dark`: trackpad glass, grilles, ports, hinge (dark grey)

Principled BSDF with base colour, metallic, roughness and optional normal map
only. **No** transmission, clearcoat, sheen, subsurface or procedural textures:
they don't survive glTF export or they're expensive on phones.

## Performance budget (hard limits)

- **≤ 15,000 triangles** in total. Keys are simple bevelled boxes (one bevel
  segment), all in `KEYS`. Use bevels and weighted normals for crisp edges
  instead of subdivision.
- All modifiers applied before export, with no stray hidden objects, cameras or lights.
- Meshes joined by material wherever the contract above doesn't need them separate.
- Textures: at most one baked AO map (1024², JPG) plus the shadow PNG.
- Target **≤ 600 KB** for the `.glb` before compression (it gets compressed
  afterwards on the site side).

## Baking (this is what makes it faster as well as nicer)

1. **Ambient occlusion**: give `MAT_Aluminium`, `MAT_Keys` and `MAT_Dark`
   non-overlapping UVs, bake AO with the lid **open (rest pose)** to one
   1024² texture, and plug it into the glTF occlusion slot (the "glTF
   Material Output" / settings node group). Grey-scale, soft, not too dark.
2. **Contact shadow**: bake a soft shadow of the base (lid open) onto a
   ground plane and save it as `public/models/laptop-shadow.png` (512², white
   on transparent, or black with alpha). Put `SHADOW` (a 4.4 × 3.2 plane,
   0.005 below the base) under the base with that image. The site will draw
   it itself and drop its current real-time shadow, which re-renders the
   whole scene every frame.

## Process

- **Start by saving whatever is open in Blender** (File > Save), then work in a
  **separate Blender file**: `assets/device-models/devices.blend` (create it if
  it doesn't exist, open it if it does). Never edit or overwrite the About
  section's file or its `AboutWorkspace` scene, or any other existing `.blend`.
- Write the build as a script, `scripts/build-laptop.py`, run inside Blender,
  so it can be re-run. It must work only in its own scene named `Laptop` inside
  `devices.blend`, and never touch other scenes. Save `devices.blend` when done.
- Export to `public/models/laptop.glb`: glTF binary, +Y up, apply modifiers,
  materials export, no animations, no cameras or lights, no compression.
- Verify, and report: bounding box of `BASE` and `LID`, `LID` origin, total
  triangles, list of nodes and materials, file size. Take screenshots from the
  front (open), the back (closed: temporarily rotate `LID` +90° on X, then put
  it back to 0) and a three-quarter view. Make sure the closed lid sits flat on
  the keys with no intersection.
- Don't edit any site code; the integration is done separately.
