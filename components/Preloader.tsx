'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ParticleTextEffect, ParticleTextHandle } from '@/components/ui/particle-text-effect';

interface PreloaderProps {
  onComplete: () => void;
}

const WORDS = ['AHNAF', 'HUSSAIN', 'DEVELOPER'];

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const particleRef   = useRef<ParticleTextHandle>(null);
  const [ready, setReady] = useState(false);
  const exitStarted   = useRef(false);

  // Mount canvas after first paint to avoid SSR mismatch
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
  }, []);

  const triggerExit = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    particleRef.current?.killAll();

    const tl = gsap.timeline();

    // Canvas zooms up and fades — site bleeds through
    tl.to(canvasWrapRef.current, {
      scale: 1.4,
      opacity: 0,
      duration: 1.0,
      ease: 'power3.in',
    }, 0);

    // Root fades away
    tl.to(rootRef.current, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => {
        document.body.style.overflow = '';
        onComplete();
      },
    }, 0.6);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#080603',
        overflow: 'hidden',
      }}
    >
      {/* Ambient radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 70%)',
      }} />

      {/* Canvas fills the full screen */}
      <div
        ref={canvasWrapRef}
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center center',
        }}
      >
        {ready && (
          <ParticleTextEffect
            ref={particleRef}
            words={WORDS}
            autoAdvance
            intervalMs={2600}
            onCycleComplete={triggerExit}
            fontSize={120}
          />
        )}
      </div>
    </div>
  );
}
