'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Touch devices — hide cursor elements entirely
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dot  = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Hide until first mouse move so they don't flash at 0,0
    dot.style.opacity  = '0';
    ring.style.opacity = '0';

    let mx = -999, my = -999, rx = -999, ry = -999;
    let rafId: number;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        dot.style.opacity  = '1';
        ring.style.opacity = '1';
      }
      dot.style.transform = `translate(${mx - 4}px,${my - 4}px)`;
    };

    const animate = () => {
      if (!prefersReduced) {
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;
        ring.style.transform = `translate(${rx - 20}px,${ry - 20}px)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    // Use event delegation — one listener on document covers all elements
    // including those added later by lazy-loaded components
    const expand   = () => Object.assign(ring.style, { width: '60px', height: '60px', borderColor: 'var(--accent-glow)' });
    const contract = () => Object.assign(ring.style, { width: '40px', height: '40px', borderColor: '' });

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('a, button, [data-cursor-expand]')) expand();
    };
    const onOut = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest('a, button, [data-cursor-expand]')) contract();
    };

    document.addEventListener('mouseover',  onOver,  { passive: true });
    document.addEventListener('mouseout',   onOut,   { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover',  onOver);
      document.removeEventListener('mouseout',   onOut);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div className="cursor-dot"  ref={dotRef}  />
      <div className="cursor-ring" ref={ringRef} />
    </>
  );
}
