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
      // Tell Lenis to ignore the modal entirely — exits its handler before preventDefault(),
      // so the overlay's native overflow-y:auto scroll works with no custom wheel listeners.
      prevent: (node: HTMLElement) => node.id === 'projectModal',
    });

    window.__lenis = lenis;
    window.__lenisEnabled = false; // Preloader starts it

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
