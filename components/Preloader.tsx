'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef     = useRef<HTMLDivElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const textRef     = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const fillRef     = useRef<HTMLDivElement>(null);
  const labelRef    = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    const root     = rootRef.current!;
    const overlay  = overlayRef.current!;
    const textEl   = textRef.current!;
    const fill     = fillRef.current!;
    const label    = labelRef.current!;
    const progress = progressRef.current!;

    const words = ['Ahnaf', 'Hussain'];
    const GAP   = 20;

    // ── build char spans ──────────────────────────────────────────
    const wordEls: HTMLSpanElement[] = [];
    words.forEach((word, wi) => {
      const wordWrap = document.createElement('span');
      wordWrap.style.cssText = 'display:inline-block;';

      word.split('').forEach(ch => {
        const cw = document.createElement('span');
        cw.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;';
        const cs = document.createElement('span');
        cs.dataset.word = String(wi);
        cs.textContent = ch;
        cs.style.cssText = 'display:inline-block;transform:translateY(115%);will-change:transform;';
        cw.appendChild(cs);
        wordWrap.appendChild(cw);
      });

      textEl.appendChild(wordWrap);
      wordEls.push(wordWrap);

      if (wi < words.length - 1) {
        const sp = document.createElement('span');
        sp.className = 'pre-sp';
        sp.style.cssText = 'display:inline-block;width:0.38em;';
        textEl.appendChild(sp);
      }
    });

    textEl.style.visibility = 'visible';

    // progress ticks to 75%
    const progTween = gsap.to(fill, { width: '75%', duration: 2.2, ease: 'power1.inOut' });

    function run() {
      progTween.kill();
      gsap.to(fill,  { width: '100%', duration: 0.3, ease: 'power2.out' });
      gsap.to([label, progress], { opacity: 0, duration: 0.3, delay: 0.35 });

      const allInner = Array.from(textEl.querySelectorAll<HTMLSpanElement>('span > span[data-word]'));
      const g0 = allInner.filter(s => s.dataset.word === '0');
      const g1 = allInner.filter(s => s.dataset.word === '1');
      const spaceEl = textEl.querySelector<HTMLSpanElement>('.pre-sp')!;

      const textRect = textEl.getBoundingClientRect();
      const spaceW   = spaceEl.getBoundingClientRect().width;
      const halfPush = textRect.height * 0.7 + spaceW / 2 + GAP;

      const tl = gsap.timeline();

      // 1. chars rise in
      tl.to(g0, { y: '0%', duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 0.15)
        .to(g1, { y: '0%', duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 0.24);

      // 2. words split apart
      tl.to(wordEls[0], { x: -halfPush, duration: 0.85, ease: 'power4.inOut' }, '>+0.45');
      tl.to(wordEls[1], { x:  halfPush, duration: 0.85, ease: 'power4.inOut' }, '<');
      tl.to(spaceEl,    { width: 0,     duration: 0.85, ease: 'power4.inOut' }, '<');

      // 3. fade the dark overlay — site reveals from behind as words split
      tl.to(overlay, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, '<+0.25');

      // 4. fade text out
      tl.to(textEl, { opacity: 0, duration: 0.35 }, '<+0.2');

      // 5. remove root entirely
      tl.call(() => {
        gsap.to(root, {
          opacity: 0, duration: 0.25,
          onComplete: () => {
            document.body.style.overflow = '';
            onComplete();
          },
        });
      }, [], '>-0.1');
    }

    document.fonts.ready.then(() => setTimeout(run, 250));
  }, [onComplete]);

  return (
    <div
      ref={rootRef}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, overflow: 'hidden' }}
    >
      {/* dark overlay — this is what fades away to reveal the site */}
      <div
        ref={overlayRef}
        style={{ position: 'absolute', inset: 0, background: '#0a0804', zIndex: 1 }}
      />

      {/* centered text — sits above overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          ref={textRef}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 6.5vw, 90px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#e2c973',
            whiteSpace: 'nowrap',
            visibility: 'hidden',
            userSelect: 'none',
          }}
        />
      </div>

      {/* progress bar */}
      <div
        ref={progressRef}
        style={{
          position: 'absolute', bottom: 48, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 3,
        }}
      >
        <div style={{ width: 120, height: 1, background: 'rgba(201,168,76,0.15)', overflow: 'hidden' }}>
          <div ref={fillRef} style={{ height: '100%', width: '0%', background: '#c9a84c' }} />
        </div>
        <span
          ref={labelRef}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 300,
            letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'rgba(201,168,76,0.45)',
          }}
        >
          Loading
        </span>
      </div>
    </div>
  );
}
