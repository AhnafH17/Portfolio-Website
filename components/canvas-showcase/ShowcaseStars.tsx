'use client';

import { useEffect, type RefObject } from 'react';

/* The showcase's starfield. */

const DPR_CAP = 1.5;

const STAR_COUNT = 520;
/** Share of the section height the starfield is taller than it, for parallax. */
export const STAR_PARALLAX = 0.12;

/* The starfield used to be a separate three.js canvas: its own WebGL
   context, compiled while the page was opening. It never changes, so it is
   painted once here (seeded, so every visit is the same sky) and the
   showcase moves the whole layer for parallax, which costs nothing per
   frame. */
function paintStars(c: HTMLCanvasElement, w: number, h: number, dpr: number) {
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * (1 + STAR_PARALLAX) * dpr));
  const g = c.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  let s = 0x5a17c3;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tints = ['255,255,255', '255,214,170', '175,205,255', '255,190,190'];
  const n = Math.round(STAR_COUNT * Math.min(1.6, (w * h) / (1440 * 900)));
  for (let i = 0; i < n; i++) {
    const x = rand() * w, y = rand() * h * (1 + STAR_PARALLAX);
    const r = rand() < 0.08 ? 1.3 : 0.4 + rand() * 0.7;
    g.fillStyle = `rgba(${tints[Math.floor(rand() * tints.length)]},${0.35 + rand() * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

export function ShowcaseStars({ starsRef }: { starsRef: RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const c = starsRef.current;
    if (!c) return;
    let lastW = 0, lastH = 0;
    const paint = () => {
      const w = c.offsetWidth, h = c.parentElement?.offsetHeight ?? 0;
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      paintStars(c, w, h, Math.min(DPR_CAP, window.devicePixelRatio || 1));
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(c.parentElement ?? c);
    return () => ro.disconnect();
  }, [starsRef]);
  return <canvas ref={starsRef} className="cs-stars" aria-hidden="true" />;
}
