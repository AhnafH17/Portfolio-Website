'use client';

import { useEffect } from 'react';
import type { Handoff, HandoffEnv } from '@/lib/handoff';
import { HANDOFFS } from './handoffs';

/* One fixed overlay for every section handoff (see lib/handoff.ts): a 2D
   canvas the canvas-drawn ones share, plus room for DOM pieces. One loop,
   running only while some handoff's sections are near the screen; each
   frame does every layout read first, then every write. Nothing renders
   under prefers-reduced-motion. */
export default function HandoffLayer() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phone = window.matchMedia('(max-width: 768px)').matches;
    const list: Handoff[] = HANDOFFS.filter((h) => !(phone && h.desktopOnly));

    const layer = document.createElement('div');
    layer.className = 'handoff-layer';
    layer.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    canvas.className = 'handoff-canvas';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    const ctx = canvas.getContext('2d');
    if (!ctx) { layer.remove(); return; }

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '201,168,76';
    const env: HandoffEnv = { vw: 0, vh: 0, phone, time: 0, layer, ctx, accent };
    let dpr = 1;
    const size = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      env.vw = window.innerWidth;
      env.vh = window.innerHeight;
      canvas.width = Math.round(env.vw * dpr);
      canvas.height = Math.round(env.vh * dpr);
    };
    size();
    window.addEventListener('resize', size);

    // Which handoffs are near the screen. Sections mount lazily, so each
    // one's zone is (re)observed until its elements exist.
    const near = new Map<Handoff, Set<Element>>(list.map((h) => [h, new Set()]));
    const observed = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        for (const h of list) {
          if (!h.zone().includes(e.target)) continue;
          const s = near.get(h)!;
          if (e.isIntersecting) s.add(e.target); else s.delete(e.target);
        }
      }
      wake();
    }, { rootMargin: '60% 0px' });
    const observeZones = () => {
      for (const h of list) for (const el of h.zone()) {
        if (el && !observed.has(el)) { observed.add(el); io.observe(el); }
      }
    };
    observeZones();
    const zonePoll = window.setInterval(observeZones, 1000);

    const shown = new Set<Handoff>();
    let canvasDirty = false;
    let raf: number | null = null;

    const frame = (now: number) => {
      raf = null;
      env.time = now / 1000;
      const live = list.filter((h) => near.get(h)!.size > 0);
      // Reads.
      const states = live.map((h) => [h, h.read(env)] as const);
      // Writes.
      if (canvasDirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); canvasDirty = false; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const h of list) {
        const st = states.find(([x]) => x === h)?.[1] ?? null;
        if (st !== null) {
          h.write(st, env);
          shown.add(h);
          if (h.usesCanvas) canvasDirty = true;
        } else if (shown.has(h)) {
          h.hide(env);
          shown.delete(h);
        }
      }
      if (live.length) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (raf === null) raf = requestAnimationFrame(frame); };
    wake();

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.clearInterval(zonePoll);
      window.removeEventListener('resize', size);
      io.disconnect();
      for (const h of shown) h.hide(env);
      layer.remove();
    };
  }, []);
  return null;
}
