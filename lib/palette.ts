'use client';

import { useEffect, useState } from 'react';
import { readAccent, type Accent } from './accent';

/* The palette at runtime. Crimson is the only one in use. Amber (the gold
   palette) stays defined in app/globals.css but inactive: to turn it on,
   set ACTIVE_PALETTE to 'amber' here and in the inline script in
   app/layout.tsx. CSS follows data-palette by itself; canvases and 3D scenes
   listen for PALETTE_EVENT (nothing fires it now, the colour no longer
   changes at runtime). */

export const PALETTES = ['crimson', 'amber'] as const;
export const ACTIVE_PALETTE: (typeof PALETTES)[number] = 'crimson';
const PALETTE_EVENT = 'palettechange';

/** Calls back after the palette changes. Returns the unsubscribe. */
export function onPaletteChange(cb: () => void) {
  window.addEventListener(PALETTE_EVENT, cb);
  return () => window.removeEventListener(PALETTE_EVENT, cb);
}

/** The current accent, updated live (for React-rendered scenes). */
export function useAccent(): Accent {
  const [accent, setAccent] = useState<Accent>(() => readAccent());
  useEffect(() => onPaletteChange(() => setAccent(readAccent())), []);
  return accent;
}
