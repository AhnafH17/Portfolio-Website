'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

declare global {
  interface Window {
    __lenis?: Lenis;
    __lenisEnabled?: boolean;
  }
}

export default function LenisProvider() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    window.__lenis = lenis;
    // Default enabled — Preloader disables it on home page, re-enables after exit
    window.__lenisEnabled = true;

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
      // Only tick Lenis when enabled — stops all event processing when modal is open
      if (window.__lenisEnabled) lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      window.__lenis = undefined;
      window.__lenisEnabled = undefined;
    };
  }, []);

  return null;
}
