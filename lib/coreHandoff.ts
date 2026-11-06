/* Shared state for the About → Impacts hand-off: the glowing core cube lifts
   off the About scene's island, and a DOM copy of it flies down into the
   Impacts section. Plain mutable object (read and written every frame, never
   rendered from), so no React state is involved. */
export const coreHandoff = {
  /** The About canvas element; positions below are relative to it. */
  canvas: null as HTMLElement | null,
  /** CUBE_Core's centre on that canvas, in CSS px. */
  x: 0,
  y: 0,
  /** Its edge length on screen, in CSS px. */
  edge: 0,
  /** Model yaw away from its resting angle, in radians (the idle sway). */
  yaw: 0,
  /** True once the About scene has published at least one frame. */
  ready: false,
  /** 0..1 — written by Impacts: how far the 3D cube has risen off its platform. */
  lift: 0,
  /** Written by Impacts: the DOM copy is out, so the 3D cube hides. */
  detached: false,
};
