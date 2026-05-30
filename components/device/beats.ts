// ─────────────────────────────────────────────────────────────────────────
// Scroll choreography for the 3D device hero.
// Everything is a function of one scroll progress value `p` in [0, 1].
// Tune the numbers here to re-time the animation — no other file needs edits.
// ─────────────────────────────────────────────────────────────────────────

export const BEATS = {
  // p-ranges for each beat (start, end)
  spin: [0.0, 0.26] as const,   // rotate 180° (back → front)
  open: [0.22, 0.46] as const,  // laptop lid opens / phone stands up → docked
  wake: [0.36, 0.54] as const,  // screen powers on + real content fades in
  read: [0.5, 1.0] as const,    // device is LOCKED; content scrolls inside the screen
};

// ── Pose constants (tweak to taste) ──────────────────────────────────────
export const POSE = {
  laptop: {
    introScale: 1.35,
    dockScale: 1.62,
    posY: -1.15,        // vertical offset of the whole rig (lower = further down)
    dockTilt: -0.12,    // slight backward tilt of the base once docked (radians)
    lidClosed: 0.015,   // lid angle when shut (radians)
    lidOpen: -1.74,     // lid angle when open (~100°). Stays here — never re-closes.
  },
  phone: {
    introScale: 1.25,
    dockScale: 1.45,
    posY: -0.1,
  },
};

/** Clamp + remap a progress value to a 0..1 window. */
export function phase(p: number, [start, end]: readonly [number, number]): number {
  if (end === start) return p >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (p - start) / (end - start)));
}

/** easeInOutCubic */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** easeOutCubic */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Damping smoothness for the per-frame approach (higher = snappier).
export const DAMP = 6;
