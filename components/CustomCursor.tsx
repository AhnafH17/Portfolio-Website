'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = 0, my = 0, rx = 0, ry = 0;
    let rafId: number;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = mx - 4 + 'px';
      dot.style.top = my - 4 + 'px';
    };

    const animate = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx - 20 + 'px';
      ring.style.top = ry - 20 + 'px';
      rafId = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', onMove);
    rafId = requestAnimationFrame(animate);

    const expand = () => {
      Object.assign(ring.style, { width: '60px', height: '60px', borderColor: 'var(--accent-glow)' });
    };
    const contract = () => {
      Object.assign(ring.style, { width: '40px', height: '40px', borderColor: 'var(--gold-dim)' });
    };

    const targets = document.querySelectorAll('a, button, .acc-strip, .acc-cta');
    targets.forEach((el) => {
      el.addEventListener('mouseenter', expand);
      el.addEventListener('mouseleave', contract);
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
      targets.forEach((el) => {
        el.removeEventListener('mouseenter', expand);
        el.removeEventListener('mouseleave', contract);
      });
    };
  }, []);

  return (
    <>
      <div className="cursor-dot" ref={dotRef} id="cursorDot" />
      <div className="cursor-ring" ref={ringRef} id="cursorRing" />
    </>
  );
}
