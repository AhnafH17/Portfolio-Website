'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export default function LenisProvider() {
  useEffect(() => {
    // Reduced motion: keep the instance (the site scrolls through it) but
    // let the wheel scroll natively, without the eased glide.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: !reduced.matches,
    });

    window.__lenis = lenis;
    const syncMotion = () => { lenis.options.smoothWheel = !reduced.matches; };
    reduced.addEventListener('change', syncMotion);

    let scrolling = false;
    let scrollTimer: ReturnType<typeof setTimeout>;
    lenis.on('scroll', () => {
      if (!scrolling) {
        scrolling = true;
        window.dispatchEvent(new Event('scroll'));
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { scrolling = false; }, 100);
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      reduced.removeEventListener('change', syncMotion);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  return null;
}
