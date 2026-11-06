'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextPalette } from '@/lib/palette';

/* The Return key: a physical-feeling keycap in the corner. Press it, or the
   real Return key, and a wave of the next colour spreads across the page from
   it. The real key only counts when nothing else is using it (not while
   typing, or with a link or button focused). */
export default function ReturnKey() {
  const ref = useRef<HTMLButtonElement>(null);
  const [down, setDown] = useState(false);
  const [pressed, setPressed] = useState(false);

  const press = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPressed(true);
    nextPalette(r.left + r.width / 2, r.top + r.height / 2);
  }, []);

  useEffect(() => {
    const busy = (t: EventTarget | null) => t instanceof HTMLElement
      && !!t.closest('input, textarea, select, a, button, summary, [contenteditable], [role="dialog"]');
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || busy(e.target)) return;
      setDown(true);
      press();
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Enter') setDown(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [press]);

  return (
    <button
      ref={ref}
      type="button"
      className={`rk${down ? ' is-down' : ''}`}
      aria-label="Change the colour theme"
      onClick={press}
    >
      <span className="rk-cap" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 6v5a3 3 0 0 1-3 3H5" />
          <path d="m9 10-4 4 4 4" />
        </svg>
      </span>
      {!pressed && <span className="rk-hint" aria-hidden="true">Press Return</span>}
    </button>
  );
}
