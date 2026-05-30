'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function TransitionOverlay() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const timer1 = useRef<ReturnType<typeof setTimeout>>(undefined);
  const timer2 = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fadeOut = () => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(timer1.current);
    clearTimeout(timer2.current);
    el.style.opacity = '1';
    el.style.pointerEvents = 'all';
    timer1.current = setTimeout(() => {
      el.style.opacity = '0';
    }, 80);
    timer2.current = setTimeout(() => {
      el.style.pointerEvents = 'none';
    }, 600);
  };

  // Page entrance: start visible, fade out
  useEffect(() => {
    fadeOut();
    // Expose show function for navigation triggers
    (window as any).__overlayShow = () => {
      const el = ref.current;
      if (!el) return;
      clearTimeout(timer1.current);
      clearTimeout(timer2.current);
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.pointerEvents = 'all';
      requestAnimationFrame(() => { el.style.transition = ''; });
    };
    return () => { delete (window as any).__overlayShow; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change: fade out on new page
  useEffect(() => { fadeOut(); }, [pathname]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: '#080603',
        opacity: 1,
        pointerEvents: 'all',
        transition: 'opacity 0.45s ease',
      }}
    />
  );
}
