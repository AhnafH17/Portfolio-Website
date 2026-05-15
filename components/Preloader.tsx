'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef     = useRef<HTMLDivElement>(null);
  const bgRef       = useRef<HTMLDivElement>(null);
  const textRef     = useRef<HTMLDivElement>(null);
  const revealRef   = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const fillRef     = useRef<HTMLDivElement>(null);
  const labelRef    = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    const root     = rootRef.current!;
    const bg       = bgRef.current!;
    const textEl   = textRef.current!;
    const reveal   = revealRef.current!;
    const fill     = fillRef.current!;
    const label    = labelRef.current!;
    const progress = progressRef.current!;

    const words  = ['Ahnaf', 'Hussain'];
    const GAP    = 28; // extra px each word moves outward beyond reveal edge

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

    // progress ticks to 75% while waiting
    const progTween = gsap.to(fill, { width: '75%', duration: 2.2, ease: 'power1.inOut' });

    function run() {
      progTween.kill();
      gsap.to(fill,  { width: '100%', duration: 0.3, ease: 'power2.out' });
      gsap.to([label, progress], { opacity: 0, duration: 0.3, delay: 0.4 });

      const allInnerChars = Array.from(textEl.querySelectorAll<HTMLSpanElement>('span > span[data-word]'));
      const g0 = allInnerChars.filter(s => s.dataset.word === '0');
      const g1 = allInnerChars.filter(s => s.dataset.word === '1');
      const spaceEl = textEl.querySelector<HTMLSpanElement>('.pre-sp')!;

      // measure after visibility:visible
      const textRect  = textEl.getBoundingClientRect();
      const textH     = textRect.height;
      const spaceRect = spaceEl.getBoundingClientRect();
      const slotCX    = spaceRect.left + spaceRect.width / 2;

      // reveal panel starts as a thin sliver in the gap
      const revealW = textH * 1.4;
      gsap.set(reveal, {
        width:    revealW,
        height:   textH,
        left:     slotCX - revealW / 2,
        top:      textRect.top,
        clipPath: 'inset(0 50% 0 50%)',
        opacity:  1,
      });

      const halfPush  = revealW / 2 + GAP;
      const splitDur  = 0.85;
      const expandDur = 0.9;

      const tl = gsap.timeline();

      // 1. chars rise in
      tl.to(g0, { y: '0%', duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 0.15)
        .to(g1, { y: '0%', duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 0.24);

      // 2. panel opens + words split apart
      tl.fromTo(reveal,
        { clipPath: 'inset(0 50% 0 50%)' },
        { clipPath: 'inset(0 0% 0 0%)', duration: splitDur, ease: 'power4.inOut' },
        '>+0.4',
      );
      tl.to(wordEls[0], { x: -halfPush, duration: splitDur, ease: 'power4.inOut' }, '<');
      tl.to(wordEls[1], { x:  halfPush, duration: splitDur, ease: 'power4.inOut' }, '<');
      tl.to(spaceEl,    { width: 0,     duration: splitDur, ease: 'power4.inOut' }, '<');

      // 3. panel expands to fill viewport — bg fades out simultaneously so the site shows through
      tl.to(reveal, {
        top: 0, left: 0,
        width: '100vw', height: '100vh',
        duration: expandDur,
        ease: 'power3.inOut',
      }, '>+0.15');

      // fade out text during expand
      tl.to(textEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, '<+0.1');
      // fade out the solid bg so site peeks through as panel expands
      tl.to(bg, { opacity: 0, duration: expandDur * 0.7, ease: 'power2.in' }, '<');

      // 4. once panel fills viewport, dissolve it to reveal the site
      tl.to(reveal, {
        opacity: 0,
        duration: 0.45,
        ease: 'power2.inOut',
        onComplete: () => {
          document.body.style.overflow = '';
          onComplete();
        },
      }, '>');
    }

    document.fonts.ready.then(() => setTimeout(run, 250));
  }, [onComplete]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', pointerEvents: 'auto',
      }}
    >
      {/* solid background — fades out during expand so site bleeds through */}
      <div ref={bgRef} style={{ position: 'absolute', inset: 0, background: '#0a0804', zIndex: 1 }} />

      {/* expanding reveal panel — same colour as showcase bg */}
      <div
        ref={revealRef}
        style={{
          position: 'absolute',
          background: '#0a0804',
          zIndex: 2,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* text */}
      <div
        ref={textRef}
        style={{
          position: 'relative', zIndex: 3,
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

      {/* progress */}
      <div
        ref={progressRef}
        style={{
          position: 'absolute', bottom: 48, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 4,
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
