'use client';

import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';

/* Night side of the planet under the horizon arc: a perspective grid in the
   theme accent colour with clusters of city lights, clipped to the planet's
   curve. Scroll progress moves the camera forward over it, so paging through
   the categories reads as flying across the surface.
   Also exports the starfield behind it (ShowcaseStars). */

// World units: camera sits 1 unit above the ground, looking at the horizon.
const LINE_SPACING_X = 0.55;
const LINE_SPACING_Z = 1;
const Z_NEAR = 0.85;
const Z_FAR = 26;
const TRAVEL = 7; // distance flown across the whole pinned scroll
const DRIFT = 0.05; // slow idle drift, units/sec
const LIGHT_TILE = 13; // lights repeat along Z with this period
const DPR_CAP = 1.5;

interface Light { x: number; z: number; r: number; warm: boolean; phase: number }

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

// Deterministic so every visit (and every palette) gets the same "cities".
function makeLights(): Light[] {
  let s = 0x2f6e2b1;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const lights: Light[] = [];
  for (let c = 0; c < 30; c++) {
    const cx = (rand() - 0.5) * 16;
    const cz = rand() * LIGHT_TILE;
    const count = 6 + Math.floor(rand() * 10);
    for (let i = 0; i < count; i++) {
      lights.push({
        x: cx + (rand() - 0.5) * 1.1,
        z: (cz + (rand() - 0.5) * 1.1 + LIGHT_TILE) % LIGHT_TILE,
        r: 0.6 + rand() * 0.9,
        warm: rand() > 0.3,
        phase: rand() * Math.PI * 2,
      });
    }
  }
  return lights;
}

export default function PlanetSurface({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const curve = canvas?.parentElement?.querySelector<HTMLElement>('.cs-horizon-curve');
    if (!canvas || !ctx || !curve) return;

    const lights = makeLights();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Palette is picked before hydration and never changes afterwards.
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '201,168,76';

    let w = 0, h = 0, dpr = 1;
    let ex = 0, ey = 0, erx = 0, ery = 0, horizonY = 0, yNear = 0;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const c = curve.getBoundingClientRect();
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ex = c.left - rect.left + c.width / 2;
      ey = c.top - rect.top + c.height / 2;
      erx = c.width / 2;
      ery = c.height / 2;
      horizonY = c.top - rect.top;
      // Focal scale chosen so the nearest cross-line sits just below the
      // bottom edge of the section.
      yNear = (h - horizonY) * Z_NEAR * 1.05;
    };

    const project = (x: number, z: number) => [ex + (x * yNear) / z, horizonY + yNear / z];

    const draw = (time: number) => {
      const travel = progressRef.current * TRAVEL + (reduceMotion ? 0 : (time / 1000) * DRIFT);
      const depth = h - horizonY;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (depth <= 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, erx, ery, 0, 0, Math.PI * 2);
      ctx.clip();

      // Grid fades out into the haze at the horizon.
      const fade = ctx.createLinearGradient(0, horizonY, 0, h);
      fade.addColorStop(0, `rgba(${accent},0)`);
      fade.addColorStop(0.18, `rgba(${accent},0.07)`);
      fade.addColorStop(0.6, `rgba(${accent},0.17)`);
      fade.addColorStop(1, `rgba(${accent},0.26)`);
      ctx.strokeStyle = fade;
      ctx.lineWidth = 1;

      // Lines running away from the viewer, converging on the horizon.
      const xReach = ((w / 2) * 8) / yNear;
      ctx.beginPath();
      for (let x = -Math.ceil(xReach / LINE_SPACING_X) * LINE_SPACING_X; x <= xReach; x += LINE_SPACING_X) {
        const [x0, y0] = project(x, Z_NEAR);
        const [x1, y1] = project(x, Z_FAR);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();

      // Cross lines, sliding toward the viewer as `travel` grows. Thinned out
      // with distance so they don't pile into a solid band at the horizon.
      const offset = ((travel % LINE_SPACING_Z) + LINE_SPACING_Z) % LINE_SPACING_Z;
      for (let z = LINE_SPACING_Z - offset; z < Z_FAR; z += LINE_SPACING_Z) {
        if (z < Z_NEAR) continue;
        const y = horizonY + yNear / z;
        ctx.globalAlpha = Math.min(1, 5 / z);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // City lights: two copies of the tile back-to-back fill the depth range.
      const t = time / 1000;
      for (let copy = 0; copy < 2; copy++) {
        for (const l of lights) {
          const z = ((((l.z - travel) % LIGHT_TILE) + LIGHT_TILE) % LIGHT_TILE) + copy * LIGHT_TILE + Z_NEAR;
          if (z > Z_FAR) continue;
          const [x, y] = project(l.x, z);
          if (x < -10 || x > w + 10 || y > h + 10) continue;
          const nearness = clamp((y - horizonY) / (depth * 0.25));
          const twinkle = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 1.7 + l.phase);
          const a = nearness * twinkle;
          if (a < 0.02) continue;
          const r = Math.min(2.2, Math.max(0.7, (l.r * 3.2) / z));
          const rgb = l.warm ? '255,214,150' : accent;
          ctx.fillStyle = `rgba(${rgb},${0.24 * a})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,244,222,${0.9 * a})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);

    // Only animate while the section is on screen.
    let raf: number | null = null;
    const loop = (time: number) => {
      draw(time);
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && raf === null) {
        measure();
        raf = requestAnimationFrame(loop);
      } else if (!entry.isIntersecting && raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    });
    io.observe(canvas);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [progressRef]);

  return <canvas ref={canvasRef} className="cs-surface" aria-hidden="true" />;
}

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}
