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
  const [mounted, setMounted] = useState(true);
  const exitStarted   = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Stop Lenis while preloader is running
    if (window.__lenis) window.__lenis.stop();

    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
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
          window.__lenis.start();
        }
        onComplete();
        // Unmount after site is already visible
        setTimeout(() => setMounted(false), 100);
      },
    }, 0.45);
  };

  if (!mounted) return null;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#080603',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 70%)',
      }} />

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
            intervalMs={1600}
            onCycleComplete={triggerExit}
            fontSize={130}
            fontFamily="'Sddystopian', sans-serif"
          />
        )}
      </div>
    </div>
  );
}
