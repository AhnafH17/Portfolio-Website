// ─────────────────────────────────────────────────────────────────────────
// Scroll choreography for the 3D device hero.
// Everything is a function of one scroll progress value `p` in [0, 1].
// Tune the numbers here to re-time the animation — no other file needs edits.
// ─────────────────────────────────────────────────────────────────────────

export const BEATS = {
  // p-ranges for each beat (start, end)
  spin: [0.0, 0.4] as const,   // rotate 180° (back → front)
  open: [0.38, 0.7] as const,  // laptop lid opens / phone stands up
  wake: [0.62, 1.0] as const,  // screen powers on + camera dollies in
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
export const DAMP = 5;
