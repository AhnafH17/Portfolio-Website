'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

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

/* Two lengths. The first visit in a session gets the full intro (~2.7s);
   every reload after that, and anyone who prefers reduced motion, gets a
   ~1.3s version without the hands. Either way the bars only open once the
   hero underneath is ready (fonts, portrait, card images), so they never
   reveal a half-loaded page; while it isn't, the gripping hands strain. */
const SEEN_KEY = 'pl-seen';
// When the hands come (full) / the bars open (quick), in s from mount.
const HANDS_AT_S = 0.9;
const QUICK_OPEN_AT_S = 0.75;
// Longest the reveal waits on the hero before opening anyway.
const HERO_WAIT_MS = 3500;
// Absolute ceiling — if anything goes wrong the site still gets revealed.
const SAFETY_MS = 7000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves when what the hero shows first is in: fonts, the portrait (a
    CSS background, so decoded from the same URL) and the floating cards. */
function heroReady(): Promise<void> {
  const palette = document.documentElement.dataset.palette || 'crimson';
  const photo = new Image();
  photo.src = `/images/hero/portrait-${palette}.png`;
  const cards = Array.from(document.querySelectorAll<HTMLImageElement>('#hero img'));
  return Promise.all([
    document.fonts?.ready,
    photo.decode().catch(() => {}),
    ...cards.map((img) => img.decode().catch(() => {})),
  ]).then(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

/* The letterbox: two black bars with the name glowing in the slit between
   them. Once it has been read, two hands (manga-style illustrations,
   public/images/preloader/, cut from assets/preloader/hands-*.png) reach out
   of the bars, grip their edges, and pull them apart onto the hero.

   The art is one 1672 x 941 frame per pose (open, half-closed, gripping;
   the half-closed one was re-aligned to the same bar edges), split at row
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
  midTop: '/images/preloader/mid-top.webp',
  midBottom: '/images/preloader/mid-bottom.webp',
  gripTop: '/images/preloader/grip-top.webp',
  gripBottom: '/images/preloader/grip-bottom.webp',
};

export default function Preloader({ onReveal, onDone }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const nameRef       = useRef<HTMLDivElement>(null);
  const topRef        = useRef<HTMLDivElement>(null);
  const botRef        = useRef<HTMLDivElement>(null);
  const exitRef       = useRef<() => void>(() => {});
  const handsRef      = useRef<() => void>(() => {});
  const artReady      = useRef<Promise<boolean> | null>(null);
  const ready         = useRef<Promise<void> | null>(null);
  const quick         = useRef(false);
  const geo           = useRef({ s: 1, imgTop: 0, vh: 0 });
  const exitStarted   = useRef(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Freeze Lenis during preloader
    if (window.__lenis) window.__lenis.stop();

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* storage blocked: the full intro */ }
    quick.current = seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ready.current = Promise.race([heroReady(), sleep(HERO_WAIT_MS)]);

    // The art loads while the name shows (~120KB); the hands only come in
    // if it has.
    if (!quick.current) {
      artReady.current = Promise.all(Object.values(ART).map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().then(() => true, () => false);
      })).then((ok) => ok.every(Boolean));
    }

    const safety = setTimeout(() => exitRef.current(), SAFETY_MS);
    const hands = setTimeout(() => handsRef.current(), (quick.current ? QUICK_OPEN_AT_S : HANDS_AT_S) * 1000);
    return () => {
      clearTimeout(safety);
      clearTimeout(hands);
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
      // The slit's height, for sizing the name to fit it.
      rootRef.current?.style.setProperty('--slit', `${(BOT_EDGE - TOP_EDGE) * s}px`);
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
    const k = quick.current ? 0.65 : 1;
    gsap.fromTo(top, { y: (SLIT_MID - TOP_EDGE) * s - 1 }, { y: 0, duration: 0.6 * k, ease: 'power3.inOut', delay: 0.05 });
    gsap.fromTo(bot, { y: -(BOT_EDGE - SLIT_MID) * s + 1 }, { y: 0, duration: 0.6 * k, ease: 'power3.inOut', delay: 0.05 });
    // The name arrives whole as the slit opens: out of a blur, settling
    // from wide tracking.
    gsap.fromTo(nameRef.current,
      { opacity: 0, filter: 'blur(14px)', letterSpacing: '0.32em', scale: 1.06 },
      { opacity: 1, filter: 'blur(0px)', letterSpacing: '0.04em', scale: 1, duration: 0.65 * k, ease: 'power3.out', delay: 0.2 * k });
    return () => window.removeEventListener('resize', layout);
  }, []);

  /** Open once the hero is ready (see heroReady). */
  const openWhenReady = async (gripped: boolean) => {
    await ready.current;
    triggerExit(gripped);
  };

  /** The name has been read: the hands, if their art is in; otherwise just open. */
  const startHands = async () => {
    if (exitStarted.current) return;
    if (quick.current) { openWhenReady(false); return; }
    const ok = await Promise.race([
      artReady.current ?? Promise.resolve(false),
      sleep(600).then(() => false),
    ]);
    if (exitStarted.current) return;
    if (!ok) { openWhenReady(false); return; }
    const top = topRef.current!, bot = botRef.current!;
    const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel)!;
    const tl = gsap.timeline({
      onComplete: () => {
        // Still waiting on the hero: keep straining, as if the bars won't
        // quite give yet.
        gsap.to([top, bot], { x: () => gsap.utils.random(-2.5, 2.5), duration: 0.06, repeat: -1, yoyo: true, repeatRefresh: true, ease: 'none' });
        openWhenReady(true);
      },
    });
    // The name dims as the hands come out of the dark.
    tl.to(nameRef.current, { opacity: 0.35, duration: 0.4, ease: 'power2.out' }, 0);
    tl.fromTo([q(top, '.pl-open'), q(bot, '.pl-open')], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0);
    tl.fromTo(q(top, '.pl-open'), { y: -46 }, { y: 0, duration: 0.45, ease: 'power3.out' }, 0);
    tl.fromTo(q(bot, '.pl-open'), { y: 46 }, { y: 0, duration: 0.45, ease: 'power3.out' }, 0);
    // Grip: the fingers close on the edges, through the half-closed pose.
    tl.set([q(top, '.pl-mid'), q(bot, '.pl-mid')], { opacity: 1 }, 0.5);
    tl.set([q(top, '.pl-open'), q(bot, '.pl-open')], { opacity: 0 }, 0.52);
    tl.set([q(top, '.pl-grip'), q(bot, '.pl-grip')], { opacity: 1 }, 0.58);
    tl.set([q(top, '.pl-mid'), q(bot, '.pl-mid')], { opacity: 0 }, 0.6);
    tl.to(rootRef.current, { '--rim': 1, duration: 0.07, yoyo: true, repeat: 1 }, 0.56);
    // A beat of strain: the bars give a little, toward each other, shaking.
    tl.to(top, { y: 6, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to(bot, { y: -6, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to([top, bot], { x: () => gsap.utils.random(-3, 3), duration: 0.045, repeat: 3, yoyo: true, ease: 'none' }, 0.62);
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
    tl.to(nameRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0);
    tl.set(root, { background: 'transparent' }, 0.05);
    gsap.killTweensOf([top, bot], 'x');
    tl.set([top, bot], { x: 0 }, 0);
    const pull = gripped ? 0.75 : quick.current ? 0.55 : 0.65;
    tl.to(top, { y: outTop, duration: pull, ease: 'power4.inOut' }, 0.05);
    tl.to(bot, { y: outBot, duration: pull, ease: 'power4.inOut' }, 0.05);
  };

  // Kept current so the safety timeout above always calls the live closure
  useEffect(() => { exitRef.current = triggerExit; handsRef.current = startHands; });

  return (
    <div ref={rootRef} className="pl-root">
      {/* The name, glowing in the slit */}
      <div ref={nameRef} className="pl-name">Ahnaf Hussain</div>

      <div ref={topRef} className="pl-half pl-top" aria-hidden="true">
        <div className="pl-bar" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-open" src={ART.openTop} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-mid" src={ART.midTop} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-grip" src={ART.gripTop} alt="" decoding="async" />
      </div>
      <div ref={botRef} className="pl-half pl-bottom" aria-hidden="true">
        <div className="pl-bar" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-open" src={ART.openBottom} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-mid" src={ART.midBottom} alt="" decoding="async" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-art pl-grip" src={ART.gripBottom} alt="" decoding="async" />
      </div>
    </div>
  );
}
