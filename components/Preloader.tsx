'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ParticleTextEffect,
  ParticleTextHandle,
} from '@/components/ui/particle-text-effect';

declare global {
  interface Window { __lenis?: import('lenis').default; }
}

interface PreloaderProps {
  /** Start revealing the site — fires as the bars are pulled apart. */
  onReveal: () => void;
  /** The bars are gone and the preloader can be removed from the tree.
   *  Kept separate from onReveal: unmounting on reveal kills the exit. */
  onDone: () => void;
}

const WORDS = ['AHNAF', 'HUSSAIN', 'DEVELOPER'];

// Per-word pacing. The effect holds each word until it has actually formed,
// so this is a target rather than a hard clock.
const WORD_MS = 1400;
// Absolute ceiling — if anything goes wrong the site still gets revealed.
const SAFETY_MS = WORDS.length * WORD_MS * 1.9 + 6000;

/* The letterbox: two black bars with the words glowing in the slit between
   them. When the words are done, two hands (manga-style illustrations,
   public/images/preloader/, cut from assets/preloader/hands-*.png) reach out
   of the bars, grip their edges, and pull them apart onto the hero.

   The art is one 1672 x 941 frame per pose (open, gripping), split at row
   SPLIT into a top half (bar + top hand) and a bottom half; the bars' edges
   sit at rows TOP_EDGE and BOT_EDGE. The frame is scaled to fill the width
   (or, on tall phones, 60% of the height) and centred on the slit. */
const ART_W = 1672;
const ART_H = 941;
const SPLIT = 449;
const TOP_EDGE = 349;
const BOT_EDGE = 644;
const SLIT_MID = (TOP_EDGE + BOT_EDGE) / 2;
const ART = {
  openTop: '/images/preloader/open-top.webp',
  openBottom: '/images/preloader/open-bottom.webp',
  gripTop: '/images/preloader/grip-top.webp',
  gripBottom: '/images/preloader/grip-bottom.webp',
};

export default function Preloader({ onReveal, onDone }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const particleRef   = useRef<ParticleTextHandle>(null);
  const topRef        = useRef<HTMLDivElement>(null);
  const botRef        = useRef<HTMLDivElement>(null);
  const exitRef       = useRef<() => void>(() => {});
  const artReady      = useRef<Promise<boolean> | null>(null);
  const geo           = useRef({ s: 1, imgTop: 0, vh: 0 });
  const [ready, setReady] = useState(false);
  const exitStarted   = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Freeze Lenis during preloader
    if (window.__lenis) window.__lenis.stop();

    // The art loads while the words play (~100KB); the hands only come in
    // if it has.
    artReady.current = Promise.all(Object.values(ART).map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().then(() => true, () => false);
    })).then((ok) => ok.every(Boolean));

    const id = requestAnimationFrame(() => setReady(true));
    const safety = setTimeout(() => exitRef.current(), SAFETY_MS);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(safety);
    };
  }, []);

  /* Lay the bars out for this screen, and open the slit. */
  useEffect(() => {
    const top = topRef.current, bot = botRef.current;
    if (!top || !bot) return;
    const layout = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const s = Math.max(vw / ART_W, (vh * 0.6) / ART_H);
      const imgTop = vh / 2 - SLIT_MID * s;
      geo.current = { s, imgTop, vh };
      const w = ART_W * s;
      // Each half: a CSS black bar down to its edge (reaching far past the
      // screen so it can move), with the art on top, anchored to the frame.
      top.style.setProperty('--edge', `${imgTop + TOP_EDGE * s}px`);
      top.style.setProperty('--art-top', `${imgTop}px`);
      bot.style.setProperty('--edge', `${imgTop + BOT_EDGE * s}px`);
      bot.style.setProperty('--art-top', `${imgTop + SPLIT * s}px`);
      for (const el of [top, bot]) {
        el.style.setProperty('--art-w', `${w}px`);
        el.style.setProperty('--art-split', `${SPLIT * s}px`);
        el.style.setProperty('--art-rest', `${(ART_H - SPLIT) * s}px`);
      }
    };
    layout();
    window.addEventListener('resize', layout);

    // Start shut on a hairline of light, then open to the slit.
    const { s } = geo.current;
    gsap.fromTo(top, { y: (SLIT_MID - TOP_EDGE) * s - 1 }, { y: 0, duration: 1.1, ease: 'power3.inOut', delay: 0.15 });
    gsap.fromTo(bot, { y: -(BOT_EDGE - SLIT_MID) * s + 1 }, { y: 0, duration: 1.1, ease: 'power3.inOut', delay: 0.15 });
    return () => window.removeEventListener('resize', layout);
  }, []);

  /** Last word is done: the hands, if their art is in; otherwise just open. */
  const handleCycleComplete = async () => {
    const ok = await Promise.race([
      artReady.current ?? Promise.resolve(false),
      new Promise<boolean>((r) => setTimeout(() => r(false), 1200)),
    ]);
    if (exitStarted.current) return;
    if (!ok) { triggerExit(); return; }
    const top = topRef.current!, bot = botRef.current!;
    const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel)!;
    const tl = gsap.timeline({ onComplete: () => triggerExit(true) });
    // The words dim as the hands come out of the dark.
    tl.to(canvasWrapRef.current, { opacity: 0.35, duration: 0.6, ease: 'power2.out' }, 0);
    tl.fromTo([q(top, '.pl-open'), q(bot, '.pl-open')], { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0);
    tl.fromTo(q(top, '.pl-open'), { y: -46 }, { y: 0, duration: 0.75, ease: 'power3.out' }, 0);
    tl.fromTo(q(bot, '.pl-open'), { y: 46 }, { y: 0, duration: 0.75, ease: 'power3.out' }, 0);
    // Grip: the fingers close on the edges.
    tl.set([q(top, '.pl-grip'), q(bot, '.pl-grip')], { opacity: 1 }, 0.95);
    tl.set([q(top, '.pl-open'), q(bot, '.pl-open')], { opacity: 0 }, 0.99);
    tl.to(rootRef.current, { '--rim': 1, duration: 0.08, yoyo: true, repeat: 1 }, 0.95);
    // A beat of strain: the bars give a little, toward each other, shaking.
    tl.to(top, { y: 7, duration: 0.18, ease: 'power2.out' }, 1.0);
    tl.to(bot, { y: -7, duration: 0.18, ease: 'power2.out' }, 1.0);
    tl.to([top, bot], { x: () => gsap.utils.random(-3, 3), duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }, 1.05);
  };

  /** Pull the bars off the screen (gripped, or plain if the hands never came). */
  const triggerExit = (gripped = false) => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    document.body.style.overflow = '';
    window.scrollTo(0, 0);
    if (window.__lenis) {
      window.__lenis.scrollTo(0, { immediate: true });
      window.__lenis.start();   // clear isStopped so wheel scrolling works again
    }

    const top = topRef.current, bot = botRef.current, root = rootRef.current;
    const { s, imgTop, vh } = geo.current;
    // Far enough that each half (bar, hand and all) is past the screen edge.
    const outTop = -(imgTop + SPLIT * s) - 40;
    const outBot = vh - (imgTop + SPLIT * s) + 40;

    onReveal();
    const tl = gsap.timeline({ onComplete: onDone });
    // The slit stops being a backdrop: the site shows through the gap.
    tl.to(canvasWrapRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0);
    tl.set(root, { background: 'transparent' }, 0.05);
    tl.set([top, bot], { x: 0 }, 0);
    tl.to(top, { y: outTop, duration: gripped ? 1.25 : 0.9, ease: 'power4.inOut' }, 0.05);
    tl.to(bot, { y: outBot, duration: gripped ? 1.25 : 0.9, ease: 'power4.inOut' }, 0.05);
  };

  // Kept current so the safety timeout above always calls the live closure
  useEffect(() => { exitRef.current = triggerExit; });

  return (
    <div ref={rootRef} className="pl-root">
      {/* The words, glowing in the slit */}
      <div ref={canvasWrapRef} className="pl-words">
        {ready && (
          <ParticleTextEffect
            ref={particleRef}
            words={WORDS}
            autoAdvance
            intervalMs={WORD_MS}
            onCycleComplete={handleCycleComplete}
            fontSize={Math.min(130, Math.floor(window.innerWidth / 6.5))}
            fontFamily="'Greater Theory', sans-serif"
          />
        )}
      </div>

      <div ref={topRef} className="pl-half pl-top" aria-hidden="true">
        <div className="pl-bar" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-open" src={ART.openTop} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-grip" src={ART.gripTop} alt="" decoding="async" />
      </div>
      <div ref={botRef} className="pl-half pl-bottom" aria-hidden="true">
        <div className="pl-bar" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-open" src={ART.openBottom} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-grip" src={ART.gripBottom} alt="" decoding="async" />
      </div>
    </div>
  );
}
