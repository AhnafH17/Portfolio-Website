'use client';

import { useEffect, useState } from 'react';
import { readAccent, type Accent } from './accent';

/* The palette at runtime. The site starts crimson (app/layout.tsx); the
   Return key and a sent message step through the palettes, a wave of the new
   colour spreading from where the visitor pressed. CSS follows data-palette
   by itself; canvases and 3D scenes listen for PALETTE_EVENT. */

export const PALETTES = ['crimson', 'teal', 'amber', 'purple'] as const;
const PALETTE_EVENT = 'palettechange';
const WAVE_MS = 950;

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

/** Steps to the next palette, with the wave spreading from (x, y). */
export function nextPalette(x: number, y: number) {
  const root = document.documentElement;
  const i = PALETTES.indexOf(root.dataset.palette as (typeof PALETTES)[number]);
  const next = PALETTES[(i + 1) % PALETTES.length];
  const apply = () => {
    root.dataset.palette = next;
    try { sessionStorage.setItem('theme', next); } catch { /* storage blocked: lasts this page only */ }
    window.dispatchEvent(new Event(PALETTE_EVENT));
  };

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !document.startViewTransition) { apply(); return; }

  // The browser holds a picture of the old colours; the live page, in the
  // new ones, is revealed through a circle growing from the key.
  const transition = document.startViewTransition(apply);
  transition.ready.then(() => {
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: WAVE_MS, easing: 'cubic-bezier(.3,.7,.15,1)', pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => { /* skipped: the colours are already applied */ });
}
