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

export default function StarField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    const acc = readAccent();                         // active palette accent
    const { r: AR, g: AG, b: AB } = acc;
    const sv = acc.silver.replace('#', '');
    const SR = parseInt(sv.slice(0, 2), 16) || 240;
    const SG = parseInt(sv.slice(2, 4), 16) || 220;
    const SB = parseInt(sv.slice(4, 6), 16) || 160;
    // Scale star count by canvas area so desktop gets proportionally more
    const STAR_COUNT = Math.max(160, Math.round((canvas.offsetWidth * canvas.offsetHeight) / 2800));
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

        // Glow
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
        grd.addColorStop(0, `rgba(${AR},${AG},${AB},${alpha * 0.9})`);
        grd.addColorStop(0.4, `rgba(${AR},${AG},${AB},${alpha * 0.3})`);
        grd.addColorStop(1, `rgba(${AR},${AG},${AB},0)`);
        ctx.beginPath();
        ctx.arc(px, py, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${SR},${SG},${SB},${alpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
