'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ParticleTextEffect,
  ParticleTextHandle,
  sampleImageCloud,
  type Cloud,
} from '@/components/ui/particle-text-effect';

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
const SAFETY_MS = WORDS.length * WORD_MS * 1.9 + 5000;

// The hero photo, and the transform its <img> carries, so the particle
// portrait can be sampled to land exactly on top of it.
const PHOTO_SRC = '/AhnafHussain.png';
const PHOTO_FOCUS_Y = 0.30;   // objectPosition: 'center 30%'
const PHOTO_ZOOM = 1.35;      // transform: scale(1.35)

// A photo is a filled region, not a few glyph strokes, so it needs several
// times the particles the words do.
const portraitBudget = (w: number) => (w < 700 ? 7000 : 17000);

export default function Preloader({ onComplete }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const particleRef   = useRef<ParticleTextHandle>(null);
  const exitRef       = useRef<() => void>(() => {});
  const portraitRef   = useRef<Cloud | null>(null);
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

  /* Build the portrait point cloud while the words are still cycling, so the
     morph costs nothing at the moment it happens. Measured from the live
     element rather than hardcoded — the frame is 340x440 on desktop, 220x290
     on phones, and sits above the copy on narrow layouts. */
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const build = async () => {
      const frame = document.querySelector<HTMLElement>('.hero-image-frame');
      if (!frame) return;

      const rect = frame.getBoundingClientRect();
      // Bail if it isn't laid out, or isn't actually on screen — flying the
      // particles somewhere the user can't see would be worse than the
      // plain exit we fall back to.
      if (rect.width < 40 || rect.height < 40) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      const img = new Image();
      img.decoding = 'async';
      img.src = PHOTO_SRC;
      try { await img.decode(); } catch { return; }
      if (cancelled) return;

      const cs = getComputedStyle(frame);
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent-rgb').trim().split(',').map((n) => parseInt(n, 10));

      portraitRef.current = sampleImageCloud({
        img,
        left: rect.left, top: rect.top, width: rect.width, height: rect.height,
        radii: [
          parseFloat(cs.borderTopLeftRadius) || 0,
          parseFloat(cs.borderTopRightRadius) || 0,
          parseFloat(cs.borderBottomRightRadius) || 0,
          parseFloat(cs.borderBottomLeftRadius) || 0,
        ],
        focusY: PHOTO_FOCUS_Y,
        zoom: PHOTO_ZOOM,
        accent: { r: accent[0] || 204, g: accent[1] || 24, b: accent[2] || 44 },
        budget: portraitBudget(window.innerWidth),
      });
    };

    // The hero wrapper runs a fadeUp (translateY 40px, .6s delay + 1s) on
    // mount; measure once it has settled or the target would be 40px off.
    const id = setTimeout(build, 2000);
    return () => { cancelled = true; clearTimeout(id); };
  }, [ready]);

  /** Last word is done: morph into the portrait, or fall straight through. */
  const handleCycleComplete = () => {
    const cloud = portraitRef.current;
    const api = particleRef.current;
    if (!cloud || !api) { triggerExit(); return; }

    api.showPoints(cloud, () => {
      // Let the portrait sit fully resolved before handing over
      setTimeout(() => triggerExit(), 900);
    });
  };

  const triggerExit = () => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    const morphed = portraitRef.current !== null;

    document.body.style.overflow = '';
    window.scrollTo(0, 0);
    if (window.__lenis) {
      window.__lenis.scrollTo(0, { immediate: true });
      window.__lenis.start();   // clear isStopped so wheel scrolling works again
    }

    if (morphed) {
      /* Cross-dissolve. The particle portrait is sitting exactly on top of the
         real <img>, so revealing the site underneath and fading the preloader
         out reads as the particles resolving into the photograph. The site
         fades in faster than the preloader fades out, so the two never overlap
         at partial opacity and dip to background. */
      onComplete();
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 1.15,
        ease: 'power2.inOut',
        onComplete: () => setMounted(false),
      });
      return;
    }

    // Fallback: the original scatter-and-zoom exit
    particleRef.current?.killAll();
    const tl = gsap.timeline();
    tl.to(canvasWrapRef.current, {
      scale: 1.4, opacity: 0, duration: 0.85, ease: 'power3.in',
    }, 0);
    tl.to(rootRef.current, {
      opacity: 0, duration: 0.4, ease: 'power2.out',
      onComplete: () => {
        onComplete();
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
            onCycleComplete={handleCycleComplete}
            reserve={portraitBudget(window.innerWidth)}
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
