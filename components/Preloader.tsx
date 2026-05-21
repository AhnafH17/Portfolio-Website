'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ParticleTextEffect, ParticleTextHandle } from '@/components/ui/particle-text-effect';

interface PreloaderProps {
  onComplete: () => void;
}

const WORDS = ['AHNAF', 'HUSSAIN', 'DEVELOPER'];

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef      = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const particleRef  = useRef<ParticleTextHandle>(null);
  const labelRef     = useRef<HTMLSpanElement>(null);
  const dotRefs      = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const [ready, setReady] = useState(false);
  // Track which word is showing so we can highlight the corresponding dot
  const [activeWord, setActiveWord] = useState(0);
  const exitStarted = useRef(false);

  // Mount canvas only after first paint (avoids SSR flash)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const triggerExit = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    const root       = rootRef.current!;
    const canvasWrap = canvasWrapRef.current!;
    const label      = labelRef.current;

    // Kill any remaining particles before zoom
    particleRef.current?.killAll();

    const tl = gsap.timeline();

    // 1. Fade out the label and dots
    tl.to([label, ...dotRefs.map(r => r.current)], {
      opacity: 0, duration: 0.3, ease: 'power2.in',
    }, 0);

    // 2. Scale the canvas wrapper UP — zoom out into the site
    //    simultaneously fade it so the site bleeds through
    tl.to(canvasWrap, {
      scale: 1.35,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.in',
    }, 0.2);

    // 3. The root itself punches out with a radial-clip reveal
    //    We animate a CSS custom property driving clip-path circle
    gsap.set(root, { '--clip-r': '150%' });
    tl.to(root, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        document.body.style.overflow = '';
        onComplete();
      },
    }, 0.7);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  }, []);

  // Animate dot indicator when word changes
  useEffect(() => {
    dotRefs.forEach((ref, i) => {
      if (!ref.current) return;
      gsap.to(ref.current, {
        scale: i === activeWord ? 1.6 : 1,
        opacity: i === activeWord ? 1 : 0.3,
        duration: 0.25,
        ease: 'power2.out',
      });
    });
  }, [activeWord]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#080603',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient gold glow behind canvas */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(201,168,76,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Canvas wrapper — this is what zooms */}
      <div
        ref={canvasWrapRef}
        style={{
          width: '100%', maxWidth: 900,
          height: 360,
          position: 'relative',
          transformOrigin: 'center center',
        }}
      >
        {ready && (
          <ParticleTextEffect
            ref={particleRef}
            words={WORDS}
            autoAdvance
            intervalMs={2600}
            onWordCycle={(idx) => setActiveWord(idx)}
            onCycleComplete={triggerExit}
            fontSize={120}
          />
        )}
      </div>

      {/* Word dots indicator */}
      <div style={{
        display: 'flex', gap: 10, marginTop: 32,
        alignItems: 'center',
      }}>
        {WORDS.map((_, i) => (
          <span
            key={i}
            ref={dotRefs[i]}
            style={{
              display: 'inline-block',
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#c9a84c',
              opacity: i === 0 ? 1 : 0.3,
              transform: i === 0 ? 'scale(1.6)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span
        ref={labelRef}
        style={{
          marginTop: 20,
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 300,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(201,168,76,0.4)',
          userSelect: 'none',
        }}
      >
        Portfolio
      </span>
    </div>
  );
}
