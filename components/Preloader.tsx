'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef    = useRef<HTMLDivElement>(null);
  const textRef    = useRef<HTMLDivElement>(null);
  const revealRef  = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const fillRef    = useRef<HTMLDivElement>(null);
  const labelRef   = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    const root    = rootRef.current!;
    const textEl  = textRef.current!;
    const reveal  = revealRef.current!;
    const fill    = fillRef.current!;
    const label   = labelRef.current!;
    const progress = progressRef.current!;

    const words = ['Ahnaf', 'Hussain'];
    const textGap = 32; // px to push each word outward

    // Build char spans
    textEl.innerHTML = '';
    const wordEls: HTMLSpanElement[] = [];
    words.forEach((word, wi) => {
      const wordWrap = document.createElement('span');
      wordWrap.style.cssText = 'display:inline-block;position:relative;';

      word.split('').forEach(ch => {
        const cw = document.createElement('span');
        cw.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;';
        const cs = document.createElement('span');
        cs.dataset.word = String(wi);
        cs.textContent = ch;
        cs.style.cssText = 'display:inline-block;transform:translateY(110%);will-change:transform;';
        cw.appendChild(cs);
        wordWrap.appendChild(cw);
      });

      textEl.appendChild(wordWrap);
      wordEls.push(wordWrap);

      if (wi < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'pre-space';
        space.style.cssText = 'display:inline-block;width:0.38em;';
        textEl.appendChild(space);
      }
    });

    textEl.style.visibility = 'visible';

    // progress bar ticks up
    const progressTween = gsap.to(fill, { width: '75%', duration: 2.4, ease: 'power1.inOut' });

    function run() {
      progressTween.kill();
      gsap.to(fill, { width: '100%', duration: 0.3, ease: 'power2.out' });
      gsap.to(label, { opacity: 0, duration: 0.2, delay: 0.25 });
      gsap.to(progress, { opacity: 0, duration: 0.25, delay: 0.35 });

      const chars0 = textEl.querySelectorAll<HTMLSpanElement>('[data-word="0"] span, span[data-word="0"]');
      const chars1 = textEl.querySelectorAll<HTMLSpanElement>('[data-word="1"] span, span[data-word="1"]');
      // actually grab inner spans
      const allChars = Array.from(textEl.querySelectorAll<HTMLSpanElement>('span span'));
      const group0 = allChars.filter(s => s.dataset.word === '0');
      const group1 = allChars.filter(s => s.dataset.word === '1');

      const textRect = textEl.getBoundingClientRect();
      const textH = textRect.height;

      // Position reveal in the gap between "Ahnaf" and "Hussain"
      const spaceEl = textEl.querySelector<HTMLSpanElement>('.pre-space')!;
      const spaceRect = spaceEl.getBoundingClientRect();
      const slotCX = spaceRect.left + spaceRect.width / 2;

      // reveal is a dark panel that will expand to full viewport
      const revealW = textH * 1.2;
      gsap.set(reveal, {
        width: revealW,
        height: textH,
        left: slotCX - revealW / 2,
        top: textRect.top,
        clipPath: 'inset(0 50% 0 50%)',
        opacity: 1,
        borderRadius: 0,
      });

      const tl = gsap.timeline();

      // chars rise in
      tl.to(group0, { y: '0%', duration: 0.55, ease: 'power3.out', stagger: 0.04 }, 0.1)
        .to(group1, { y: '0%', duration: 0.55, ease: 'power3.out', stagger: 0.04 }, 0.18);

      const splitDelay = '>+0.45';
      const splitDur = 0.9;
      const halfPush = revealW / 2 + textGap;

      // reveal panel opens from centre
      tl.fromTo(reveal,
        { clipPath: 'inset(0 50% 0 50%)' },
        { clipPath: 'inset(0 0% 0 0%)', duration: splitDur, ease: 'power4.inOut' },
        splitDelay,
      );
      // push words apart
      tl.to(wordEls[0], { x: -halfPush, duration: splitDur, ease: 'power4.inOut' }, splitDelay);
      tl.to(wordEls[1], { x: halfPush,  duration: splitDur, ease: 'power4.inOut' }, splitDelay);
      tl.to(spaceEl,   { width: 0,      duration: splitDur, ease: 'power4.inOut' }, splitDelay);

      // expand reveal panel to fill viewport
      tl.to(reveal, {
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
        duration: 0.85,
        ease: 'power3.inOut',
      }, '>+0.2');

      // fade out the text + root, then call onComplete
      tl.to(textEl, { opacity: 0, duration: 0.25 }, '>-0.3');
      tl.call(() => {
        root.style.pointerEvents = 'none';
        gsap.to(root, {
          opacity: 0, duration: 0.35, ease: 'power2.in',
          onComplete: () => { document.body.style.overflow = ''; onComplete(); },
        });
      }, [], '>-0.1');
    }

    // Kick off after fonts ready + tiny delay
    document.fonts.ready.then(() => {
      setTimeout(run, 300);
    });
  }, [onComplete]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#09080605',
        overflow: 'hidden',
      }}
    >
      {/* background fill */}
      <div style={{ position: 'absolute', inset: 0, background: '#0a0804' }} />

      {/* the dark panel that expands into the showcase */}
      <div
        ref={revealRef}
        style={{
          position: 'absolute',
          background: '#0a0804',
          zIndex: 3,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* text */}
      <div
        ref={textRef}
        style={{
          position: 'relative', zIndex: 4,
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(40px, 7vw, 96px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: '#e2c973',
          whiteSpace: 'nowrap',
          visibility: 'hidden',
          userSelect: 'none',
        }}
      />

      {/* progress bar */}
      <div
        ref={progressRef}
        style={{
          position: 'absolute', bottom: 48, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 5,
        }}
      >
        <div style={{ width: 120, height: 1, background: 'rgba(201,168,76,0.15)', overflow: 'hidden' }}>
          <div
            ref={fillRef}
            style={{ height: '100%', width: '0%', background: '#c9a84c', transition: 'width 0.05s linear' }}
          />
        </div>
        <span
          ref={labelRef}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10, fontWeight: 300,
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
