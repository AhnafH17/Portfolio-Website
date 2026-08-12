'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ParticleTextEffect, ParticleTextHandle } from '@/components/ui/particle-text-effect';

declare global {
  interface Window { __lenis?: import('lenis').default; }
}

interface PreloaderProps {
  onComplete: () => void;
}

const WORDS = ['AHNAF', 'HUSSAIN', 'DEVELOPER'];

// Per-word pacing. The effect holds each word until it has actually formed,
// so this is a target rather than a hard clock.
const WORD_MS = 1500;
// Absolute ceiling — if anything goes wrong the site still gets revealed.
const SAFETY_MS = WORDS.length * WORD_MS * 1.9 + 2500;

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const particleRef   = useRef<ParticleTextHandle>(null);
  const exitRef       = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(true);
  const exitStarted   = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Freeze Lenis during preloader
    if (window.__lenis) window.__lenis.stop();

    const id = requestAnimationFrame(() => setReady(true));
    const safety = setTimeout(() => exitRef.current(), SAFETY_MS);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(safety);
    };
  }, []);

  const triggerExit = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    particleRef.current?.killAll();

    const tl = gsap.timeline();

    // Canvas zooms and fades
    tl.to(canvasWrapRef.current, {
      scale: 1.4,
      opacity: 0,
      duration: 0.85,
      ease: 'power3.in',
    }, 0);

    // Root fades out
    tl.to(rootRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out',
      // Fire onComplete early — site starts fading in while preloader is still fading out
      onComplete: () => {
        document.body.style.overflow = '';
        window.scrollTo(0, 0);
        if (window.__lenis) {
          window.__lenis.scrollTo(0, { immediate: true });
          window.__lenis.start();   // clear isStopped so wheel scrolling works again
        }
        onComplete();
        // Unmount after site is already visible
        setTimeout(() => setMounted(false), 100);
      },
    }, 0.45);
  };

  // Kept current so the safety timeout above always calls the live closure
  useEffect(() => { exitRef.current = triggerExit; });

  if (!mounted) return null;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'var(--black)',
        overflow: 'hidden',
      }}
    >
      {/* Canvas fills full screen */}
      <div
        ref={canvasWrapRef}
        style={{ position: 'absolute', inset: 0, transformOrigin: 'center center' }}
      >
        {ready && (
          <ParticleTextEffect
            ref={particleRef}
            words={WORDS}
            autoAdvance
            intervalMs={WORD_MS}
            onCycleComplete={triggerExit}
            fontSize={Math.min(130, Math.floor(window.innerWidth / 6.5))}
            fontFamily="'Sddystopian', sans-serif"
          />
        )}
      </div>

      {/* Ambient glow — sits above the canvas, which is now opaque (alpha:false
          gives the compositor a much cheaper path on mobile) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen',
        background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(var(--accent-rgb),0.08) 0%, transparent 70%)',
      }} />
    </div>
  );
}
