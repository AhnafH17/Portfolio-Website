'use client';

import { useEffect, useRef } from 'react';
import { DOT_COUNT, HOME, globeState, projectDot, projectLatLng } from '@/lib/globe';

/* "Bangladesh to the world": a globe made of particles, one per patch of
   land, drawn on a 2D canvas, with arcs from Bangladesh to where clients
   are. On the way in, the Impacts stars stream into these exact dots
   (components/handoff/handoffs.ts), so the stars become the globe. It
   replaced a globe.gl/three.js globe (a 1.7MB script from a CDN and its own
   WebGL context). */

const TARGETS = [
  { lat: 43.65, lng: -79.38 },  // Canada
  { lat: 37.77, lng: -122.4 },  // USA
  { lat: 51.5, lng: -0.12 },    // Europe
  { lat: -33.87, lng: 151.2 },  // Australia
];
// The view sweeps back and forth around Bangladesh (so home stays in view)
// instead of spinning all the way round.
const SWEEP = 0.75;     // radians either side of home
const SWEEP_SPEED = 0.11;
const D2R = Math.PI / 180;

/** Points along the great circle a -> b (degrees), as [lat, lng]. */
function greatCircle(a: { lat: number; lng: number }, b: { lat: number; lng: number }, n: number) {
  const v = (p: { lat: number; lng: number }) => {
    const la = p.lat * D2R, lo = p.lng * D2R;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  const A = v(a), B = v(b);
  const dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
  const om = Math.acos(Math.min(1, Math.max(-1, dot)));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const s1 = Math.sin((1 - u) * om) / Math.sin(om), s2 = Math.sin(u * om) / Math.sin(om);
    const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
    out.push([Math.atan2(z, Math.hypot(x, y)) / D2R, Math.atan2(y, x) / D2R]);
  }
  return out;
}
const ARCS = TARGETS.map((t) => greatCircle(HOME, t, 48));

export default function ParticleGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '201,168,76';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dpr = 1, w = 0, h = 0;
    const size = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      globeState.canvas = canvas;
      globeState.cx = w / 2; globeState.cy = h / 2; globeState.r = Math.min(w, h) * 0.4;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    // Desktop drag to spin (touch swipes keep scrolling the page).
    let drag = 0, dragFrom: number | null = null, dragBase = 0;
    const down = (e: PointerEvent) => { if (e.pointerType === 'mouse') { dragFrom = e.clientX; dragBase = drag; } };
    const move = (e: PointerEvent) => { if (dragFrom !== null) drag = dragBase - ((e.clientX - dragFrom) / Math.max(1, globeState.r)) * 1.2; };
    const up = () => { dragFrom = null; };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const p = new Float32Array(3);
    const draw = (time: number) => {
      const t = time / 1000;
      globeState.lng0 = HOME.lng * D2R + (reduce ? 0 : Math.sin(t * SWEEP_SPEED) * SWEEP) + drag;
      const { cx, cy, r } = globeState;
      canvas.style.opacity = String(globeState.reveal);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Atmosphere and body.
      const atm = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.32);
      atm.addColorStop(0, `rgba(${accent},0.22)`);
      atm.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = atm;
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.32, 0, Math.PI * 2); ctx.fill();
      // A translucent, holographic body.
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, 'rgba(18,22,30,0.88)');
      body.addColorStop(0.82, 'rgba(8,10,14,0.92)');
      body.addColorStop(1, `rgba(${accent},0.22)`);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${accent},0.45)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Faint graticule: parallels and meridians on the near side.
      ctx.strokeStyle = `rgba(${accent},0.1)`;
      for (let la = -60; la <= 60; la += 30) {
        ctx.beginPath();
        let on = false;
        for (let lo = -180; lo <= 180; lo += 6) {
          const g = projectLatLng(la, lo);
          if (g[2] > 0) { if (on) ctx.lineTo(g[0], g[1]); else ctx.moveTo(g[0], g[1]); on = true; } else on = false;
        }
        ctx.stroke();
      }
      for (let lo = -180; lo < 180; lo += 30) {
        ctx.beginPath();
        let on = false;
        for (let la = -80; la <= 80; la += 5) {
          const g = projectLatLng(la, lo);
          if (g[2] > 0) { if (on) ctx.lineTo(g[0], g[1]); else ctx.moveTo(g[0], g[1]); on = true; } else on = false;
        }
        ctx.stroke();
      }

      // Land dots: a ghost of the far side, then the near side, brighter
      // and bigger toward the viewer.
      const unit = Math.max(1, r / 220);
      for (let i = 0; i < DOT_COUNT; i++) {
        projectDot(i, p);
        const z = p[2];
        if (z <= 0) {
          if (z > -0.6) { ctx.fillStyle = `rgba(${accent},0.06)`; ctx.fillRect(p[0] - 0.6, p[1] - 0.6, 1.2, 1.2); }
          continue;
        }
        const s = (1.3 + z * 1.6) * unit;
        ctx.fillStyle = `rgba(${accent},${0.35 + z * 0.65})`;
        ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }

      // Arcs from home, each with a light travelling along it.
      ctx.lineCap = 'round';
      ARCS.forEach((arc, k) => {
        let prev: [number, number, number] | null = null;
        const head = ((t * 0.35 + k * 0.27) % 1.4);
        arc.forEach(([la, lo], j) => {
          const u = j / (arc.length - 1);
          const q = projectLatLng(la, lo, 0.28 * Math.sin(Math.PI * u));
          if (prev && q[2] > -0.15 && prev[2] > -0.15) {
            const near = Math.max(0, 1 - Math.abs(u - head) * 7);
            ctx.strokeStyle = `rgba(${near > 0 ? '255,255,255' : accent},${0.22 + near * 0.75})`;
            ctx.lineWidth = 1 + near * 1.6;
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
          }
          prev = q;
        });
      });

      // Home marker.
      const [hx, hy, hz] = projectLatLng(HOME.lat, HOME.lng);
      if (hz > 0) {
        const pulse = reduce ? 0.5 : (t * 0.8) % 1;
        ctx.strokeStyle = `rgba(${accent},${0.9 * (1 - pulse)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hx, hy, 4 + pulse * 16, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = `600 ${Math.round(11 * unit)}px 'Chakra Petch', sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${0.85 * hz})`;
        ctx.fillText(HOME.label.toUpperCase(), hx + 10 * unit, hy - 8 * unit);
      }
    };

    let raf: number | null = null;
    const loop = (time: number) => { draw(time); raf = requestAnimationFrame(loop); };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
      else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }, { rootMargin: '30% 0px' });
    io.observe(canvas);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (globeState.canvas === canvas) globeState.canvas = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="ts-globe-canvas" aria-hidden="true" />;
}
