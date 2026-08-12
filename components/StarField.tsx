'use client';

import { useEffect, useRef } from 'react';
import { readAccent } from '@/lib/accent';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  opacityDir: number;
  speed: number;
}

/** Bake a radial gradient into a small canvas once, so the draw loop can
 *  blit it instead of allocating a fresh gradient object per star per frame. */
function makeGlowSprite(r: number, g: number, b: number, stops: [number, number][]) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d')!;
  const grd = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [pos, alpha] of stops) grd.addColorStop(pos, `rgba(${r},${g},${b},${alpha})`);
  cx.fillStyle = grd;
  cx.fillRect(0, 0, size, size);
  return c;
}

export default function StarField({ className, paused = false }: { className?: string; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    const acc = readAccent();                         // active palette accent
    const { r: AR, g: AG, b: AB } = acc;
    const sv = acc.silver.replace('#', '');
    const SR = parseInt(sv.slice(0, 2), 16) || 240;
    const SG = parseInt(sv.slice(2, 4), 16) || 220;
    const SB = parseInt(sv.slice(4, 6), 16) || 160;

    // Two cached sprites replace ~1500 createRadialGradient calls per frame
    const glow = makeGlowSprite(AR, AG, AB, [[0, 0.9], [0.4, 0.3], [1, 0]]);
    const core = makeGlowSprite(SR, SG, SB, [[0, 1], [0.55, 1], [0.85, 0.35], [1, 0]]);

    // Scale star count by canvas area, but cap it — past a few hundred the
    // extra stars cost frames without reading as any denser.
    const STAR_COUNT = Math.min(
      520,
      Math.max(160, Math.round((canvas.offsetWidth * canvas.offsetHeight) / 2800)),
    );
    const stars: Star[] = [];

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: rand(0, 1),
        y: rand(0, 1),
        z: rand(0.1, 1),        // depth: 1 = close, 0.1 = far
        size: rand(0.5, 2.2),
        opacity: rand(0, 1),
        opacityDir: rand(0.003, 0.012) * (Math.random() > 0.5 ? 1 : -1),
        speed: rand(0.0003, 0.001),
      });
    }

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        // Drift upward slowly
        s.y -= s.speed * s.z;
        if (s.y < 0) { s.y = 1; s.x = rand(0, 1); }

        // Twinkle
        s.opacity += s.opacityDir;
        if (s.opacity > 1) { s.opacity = 1; s.opacityDir *= -1; }
        if (s.opacity < 0) { s.opacity = 0; s.opacityDir *= -1; }

        const px = s.x * w;
        const py = s.y * h;
        const r = s.size * s.z;
        const alpha = s.opacity * s.z;
        if (alpha <= 0.01) continue;

        ctx.globalAlpha = alpha;

        // Glow — sprite spans the old gradient's r*4 radius
        const gd = r * 8;
        ctx.drawImage(glow, px - gd / 2, py - gd / 2, gd, gd);

        // Core dot
        const cd = r * 2.4;
        ctx.drawImage(core, px - cd / 2, py - cd / 2, cd, cd);
      }

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
