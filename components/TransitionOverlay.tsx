'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const FADE = 'opacity 0.45s ease';

export default function TransitionOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const t1 = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t2 = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Called on each route change — show briefly then fade out
  const fadeOut = () => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    // Ensure transition is live before we change opacity
    el.style.transition = FADE;
    el.style.opacity = '1';
    el.style.pointerEvents = 'all';
    t1.current = setTimeout(() => { el.style.opacity = '0'; }, 80);
    t2.current = setTimeout(() => { el.style.pointerEvents = 'none'; }, 600);
  };

  useEffect(() => {
    // Expose show function so ScrollShowcase & ProjectPageContent can trigger it
    (window as any).__overlayShow = () => {
      const el = ref.current;
      if (!el) return;
      clearTimeout(t1.current);
      clearTimeout(t2.current);
      el.style.transition = 'none';     // snap to visible instantly
      el.style.opacity = '1';
      el.style.pointerEvents = 'all';
      // Restore transition on next frame so future fades animate
      requestAnimationFrame(() => { if (ref.current) ref.current.style.transition = FADE; });
    };
    return () => { delete (window as any).__overlayShow; };
  }, []);

  // Fade out whenever the route changes (new page has mounted)
  useEffect(() => { fadeOut(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: '#080603',
        opacity: 1,
        pointerEvents: 'all',
        transition: FADE,
      }}
    />
  );
}
