'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

// Global instance so Modal can pause/resume it
declare global {
  interface Window { __lenis?: Lenis; }
}

export default function LenisProvider() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      prevent: (node) => node.closest('.modal-scroll-area') !== null,
    });

    window.__lenis = lenis;

    // Only dispatch scroll when actually scrolling (not every rAF tick)
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

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  return null;
}
