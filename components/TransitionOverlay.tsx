'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function TransitionOverlay() {
  const [visible, setVisible] = useState(true);
  const pathname = usePathname();
  const mounted = useRef(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initial page load: fade out after brief show
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setVisible(false), 60);
    return () => clearTimeout(t.current);
  }, []);

  // Route changes (after first mount): show briefly then fade out
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    clearTimeout(t.current);
    setVisible(true);
    t.current = setTimeout(() => setVisible(false), 80);
    return () => clearTimeout(t.current);
  }, [pathname]);

  // Expose imperative show for button clicks
  useEffect(() => {
    (window as any).__overlayShow = () => {
      clearTimeout(t.current);
      setVisible(true);
    };
    return () => { delete (window as any).__overlayShow; };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--black)',
        pointerEvents: visible ? 'all' : 'none',
        opacity: visible ? 1 : 0,
        // Only animate the hide — show is instant via React's synchronous setState
        transition: visible ? 'none' : 'opacity 0.5s ease',
      }}
    />
  );
}
