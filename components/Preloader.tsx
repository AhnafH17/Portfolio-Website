'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { DeskLoad } from './desk/loading';
import { loadOutline, OutlineDrawing } from './desk/outline';
import { handover, INTRO_END } from './desk/timeline';
import { onPaletteChange } from '@/lib/palette';

declare global {
  interface Window { __lenis?: import('lenis').default; }
}

interface PreloaderProps {
  load: DeskLoad;
  onSkip: () => void;
  /** Start revealing the site — fires as the bars are pulled apart. */
  onReveal: () => void;
  /** The handover is over and the preloader can be removed from the tree.
   *  Kept separate from onReveal: unmounting on reveal kills the exit. */
  onDone: () => void;
}

const SEEN_KEY = 'pl-seen';
const REPEAT_SPEED = 1.35;
const LOAD_TIMEOUT_MS = 10_000;
/** A load that's done by now never sees the drawing: only real waiting does. */
const WAIT_MS = 900;
/** Mounted this long after navigation, the page's code came in slowly, so the
 *  model is still to come: the drawing starts at once. */
const LATE_MOUNT_MS = 1500;
/** How long a finished drawing is held before the hands come. */
const HOLD_MS = 280;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* The letterbox: two black bars with the name glowing in the slit between
   them. Once it has been read, two hands (manga-style illustrations,
   public/images/preloader/, cut from assets/preloader/hands-*.png) reach out
   of the bars, grip their edges, and pull them apart onto the hero.

   The art is one 1672 x 941 frame per pose (open, half-closed, gripping;
   the half-closed one was re-aligned to the same bar edges), split at row
   SPLIT into a top half (bar + top hand) and a bottom half; the bars' edges
   sit at rows `top` and `bot` (see ARTS). The frame is scaled to fill the width
   (or, on tall phones, 60% of the height) and centred on the slit. */
const PHONE = '(max-width: 768px)';
const ARTS = {
  // The wide frame, for desktop and tablets in landscape.
  desk: { w: 1672, h: 941, split: 449, top: 349, bot: 644, prefix: '' },
  // Phones get their own tall frame (assets/preloader/hands-mobile-sheet.png)
  // where the hands fill the width; on the wide one they looked tiny.
  phone: { w: 522, h: 902, split: 419, top: 338, bot: 569, prefix: 'm-' },
};
type Art = (typeof ARTS)['desk'];
const POSES = ['open', 'mid', 'grip'] as const;
const pickArt = (): Art => (window.matchMedia(PHONE).matches ? ARTS.phone : ARTS.desk);
const slitMid = (a: Art) => (a.top + a.bot) / 2;

/** One pose of one half. <picture> means each device fetches only its set. */
function Hand({ pose, half }: { pose: (typeof POSES)[number]; half: 'top' | 'bottom' }) {
  return (
    <picture>
      <source media={PHONE} srcSet={`/images/preloader/m-${pose}-${half}.webp`} />
      <img className={`pl-art pl-${pose}`} src={`/images/preloader/${pose}-${half}.webp`} alt="" decoding="async" fetchPriority="low" />
    </picture>
  );
}

/** Where the loader stands (0-1) at a load stage. `creep` (seconds): the
 *  amount is unknown (the scene code is still arriving, or the download has
 *  no size even after loadModel's fallback), so it eases toward `to` on a
 *  time curve that slows but never stops; the next real stage takes over. */
function progressFor(load: DeskLoad): { to: number; creep: number } {
  switch (load.phase) {
    case 'starting': return { to: 0.12, creep: 2.5 };
    case 'downloading': return load.fraction === null
      ? { to: 0.12 + 0.78 * 0.9, creep: 7 }
      : { to: 0.12 + 0.78 * load.fraction, creep: 0 };
    case 'rendering': return { to: 0.95, creep: 0 };
    default: return { to: 1, creep: 0 };
  }
}

/** The hero's box on screen: the drawing is projected for exactly this view. */
function stageBox() {
  const stage = document.querySelector('.dh-stage');
  const r = stage?.getBoundingClientRect();
  return r && r.width && r.height
    ? { left: r.left, top: r.top, width: r.width, height: r.height }
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** The hero heading's two words (content boxes), where the name lands. */
function headingWords() {
  const h1 = document.getElementById('desk-name');
  if (!h1) return null;
  const words = [...h1.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
  if (words.length !== 2) return null;
  const range = document.createRange();
  const rects = words.map((n) => {
    range.selectNodeContents(n);
    return range.getBoundingClientRect();
  });
  return rects.every((r) => r.width && r.height) ? { h1, rects } : null;
}

/* While the desk is still on its way, it draws itself in thin strokes, in
   place: the lines are the real model's edges and contours, projected with
   the hero camera (components/desk/outline.ts), so each sits exactly where
   that part of the 3D desk will render. The bars draw back around the
   desk, the name moves to where the hero heading will be, and the drawing
   traces part by part behind a glowing pen; its LED strip is the progress
   bar, the light bar and fan light up as stages are reached, and the
   screens glow while the scene warms up. When the hands pull the bars
   apart, the drawing hands over in place: the room lights up under the
   lines while they dissolve, the drawn LED gives way to the real one, and
   the name settles into the heading. */
export default function Preloader({ load, onSkip, onReveal, onDone }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const nameRef       = useRef<HTMLDivElement>(null);
  const wordRefs      = useRef<(HTMLSpanElement | null)[]>([]);
  const topRef        = useRef<HTMLDivElement>(null);
  const botRef        = useRef<HTMLDivElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const outlineRef    = useRef<HTMLDivElement>(null);
  const drawing       = useRef<OutlineDrawing | null>(null);
  const handsRef      = useRef<(fallback: boolean) => void>(() => {});
  const startedAt     = useRef(0);
  const handTimeline  = useRef<gsap.core.Timeline | null>(null);
  const exitTimeline  = useRef<gsap.core.Timeline | null>(null);
  const artReady      = useRef<Promise<boolean> | null>(null);
  const quick         = useRef(false);
  const repeat        = useRef(false);
  const geo           = useRef({ s: 1, imgTop: 0, vh: 0 });
  const art           = useRef<Art>(ARTS.desk);
  const exitStarted   = useRef(false);
  const waitingRef    = useRef(false);
  /** How far each bar has moved to open the slit around the drawing. */
  const opened        = useRef({ top: 0, bot: 0 });
  const opening       = useRef<gsap.core.Tween | null>(null);
  const percentRef    = useRef<HTMLSpanElement>(null);
  const progress      = useRef({ p: 0 });
  const litRef        = useRef(0);
  const tickRef       = useRef<(() => void) | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [plain, setPlain] = useState(false);

  /** Project the drawing for the hero's current view. */
  const layoutDrawing = () => {
    const d = drawing.current, el = outlineRef.current;
    if (!d || !el) return;
    const box = stageBox();
    Object.assign(el.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
    d.layout(box.width, box.height);
    d.setProgress(progress.current.p);
  };

  /** Each word's transform (origin top-left) that lays it over the hero
   *  heading's matching word: same font, so a uniform scale fits it. */
  const nameTargets = () => {
    const words = wordRefs.current.filter(Boolean) as HTMLSpanElement[];
    const heading = headingWords();
    if (!heading || words.length !== 2) return null;
    const saved = words.map((w) => w.style.transform);
    words.forEach((w) => (w.style.transform = 'none'));
    const range = document.createRange();
    const result = words.map((w, i) => {
      range.selectNodeContents(w);
      const text = range.getBoundingClientRect();
      const box = w.getBoundingClientRect();
      const target = heading.rects[i];
      const scale = target.height / text.height;
      return {
        x: target.left - box.left - scale * (text.left - box.left),
        y: target.top - box.top - scale * (text.top - box.top),
        scale,
      };
    });
    words.forEach((w, i) => (w.style.transform = saved[i]));
    return { h1: heading.h1, words, result };
  };

  /** Open the slit around the desk, move the name to the heading's place,
   *  and put the label under the LED strip. */
  const placeWaiting = (duration: number) => {
    const root = rootRef.current, top = topRef.current, bot = botRef.current, label = progressRef.current;
    const d = drawing.current;
    if (!root || !top || !bot || !label || !d) return;
    finishEntrance();
    const vh = window.innerHeight;
    const { s, imgTop } = geo.current;
    const a = art.current;
    const { top: stageTop, left: stageLeft } = stageBox();
    // The slit runs from just above the monitors to just under the desk;
    // the chair's base can stay under the bottom bar, like the edge of a
    // photograph. Each bar keeps some height for its hand to grip.
    const topEdge = Math.min(vh * 0.45, Math.max(vh * 0.05, stageTop + d.box.top - vh * 0.045));
    const botEdge = Math.max(vh * 0.55, Math.min(vh * 0.93, stageTop + d.box.deskBottom + vh * 0.03));
    const open = (opened.current = { top: imgTop + a.top * s - topEdge, bot: botEdge - (imgTop + a.bot * s) });
    const to = { duration, ease: 'power3.inOut' };
    opening.current = gsap.to(top, { ...to, y: -open.top });
    gsap.to(bot, { ...to, y: open.bot });
    const targets = nameTargets();
    if (targets) {
      root.dataset.named = 'true';
      targets.words.forEach((w, i) => gsap.to(w, { ...to, ...targets.result[i], transformOrigin: '0 0' }));
    }
    Object.assign(label.style, { left: '0', top: '0', translate: 'none' });
    // Centred under the strip, kept clear of the screen's edges.
    const half = label.offsetWidth / 2 + 16;
    const x = Math.min(window.innerWidth - half, Math.max(half, stageLeft + d.box.ledX));
    label.style.transform = `translate(${x}px, ${stageTop + d.box.ledY + vh * 0.018}px) translateX(-50%)`;
  };

  /** The CSS entrance never fights a tween: it ends where the tweens start. */
  const finishEntrance = () => {
    for (const el of [nameRef.current, topRef.current, botRef.current])
      el?.getAnimations().forEach((animation) => animation.finish());
  };

  useEffect(() => {
    startedAt.current = performance.now();
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    // Freeze Lenis during preloader
    if (window.__lenis) window.__lenis.stop();

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* storage blocked: the full intro */ }
    repeat.current = seen;
    quick.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlain(quick.current);
    // The art loads while the name shows (~120KB); the hands only come in
    // if it has.
    let alive = true;
    if (!quick.current) {
      const { prefix } = pickArt();
      const srcs = POSES.flatMap((pose) => [`${pose}-top`, `${pose}-bottom`].map((n) => `/images/preloader/${prefix}${n}.webp`));
      artReady.current = Promise.all(srcs.map((src) => {
        const img = new Image();
        img.fetchPriority = 'low';
        img.src = src;
        return img.decode().then(() => true, () => false);
      })).then((ok) => ok.every(Boolean));
      // The drawing: laid out for the hero's view as soon as it arrives, so
      // it is ready whether or not there's any waiting to fill.
      loadOutline().then((data) => {
        if (!alive || !data || !outlineRef.current || exitStarted.current) return;
        drawing.current = new OutlineDrawing(outlineRef.current, data);
        layoutDrawing();
        drawing.current.setLit(litRef.current);
        if (waitingRef.current && !handTimeline.current) placeWaiting(0.8);
      });
    }
    const offPalette = onPaletteChange(() => drawing.current?.recolour());

    return () => {
      alive = false;
      offPalette();
      handTimeline.current?.kill();
      exitTimeline.current?.kill();
      if (tickRef.current) gsap.ticker.remove(tickRef.current);
      document.body.style.overflow = '';
      window.__lenis?.start();
    };
  }, []);
  const fallback = load.phase === 'fallback';
  const finished = load.phase === 'ready' || fallback;
  useEffect(() => {
    if (!finished) {
      const safety = setTimeout(onSkip, LOAD_TIMEOUT_MS);
      // Still loading once the name has landed: the bars draw back around
      // the desk, the name moves to the heading's place, and the drawing
      // traces itself where the desk will be.
      const wait = setTimeout(() => {
        if (exitStarted.current || waitingRef.current) return;
        waitingRef.current = true;
        setWaiting(true);
        if (!quick.current) placeWaiting(0.8);
      }, startedAt.current > LATE_MOUNT_MS ? 0 : Math.max(0, WAIT_MS - (performance.now() - startedAt.current)));
      return () => { clearTimeout(safety); clearTimeout(wait); };
    }
    const minimum = quick.current ? 420 : 690;
    const wait = Math.max(0, minimum - (performance.now() - startedAt.current));
    const hands = setTimeout(() => handsRef.current(fallback), wait);
    return () => clearTimeout(hands);
  }, [finished, fallback, onSkip]);

  /* Lay the bars out for this screen, and open the slit. */
  useEffect(() => {
    const top = topRef.current, bot = botRef.current;
    if (!top || !bot) return;
    const layout = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const a = (art.current = pickArt());
      const s = Math.max(vw / a.w, (vh * 0.6) / a.h);
      const imgTop = vh / 2 - slitMid(a) * s;
      geo.current = { s, imgTop, vh };
      const w = a.w * s;
      // Each half: a CSS black bar down to its edge (reaching far past the
      // screen so it can move), with the art on top, anchored to the frame.
      top.style.setProperty('--edge', `${imgTop + a.top * s}px`);
      top.style.setProperty('--art-top', `${imgTop}px`);
      bot.style.setProperty('--edge', `${imgTop + a.bot * s}px`);
      bot.style.setProperty('--art-top', `${imgTop + a.split * s}px`);
      // The slit's height, for sizing the name to fit it.
      rootRef.current?.style.setProperty('--slit', `${(a.bot - a.top) * s}px`);
      for (const el of [top, bot]) {
        el.style.setProperty('--art-w', `${w}px`);
        el.style.setProperty('--art-split', `${a.split * s}px`);
        el.style.setProperty('--art-rest', `${(a.h - a.split) * s}px`);
      }
      if (exitStarted.current) return;
      layoutDrawing();
      if (waitingRef.current && !quick.current && !handTimeline.current) placeWaiting(0);
    };
    layout();
    window.addEventListener('resize', layout);
    // The slit opening and the name's entrance are CSS animations (the same
    // geometry is in globals.css), so they play from the first paint instead
    // of waiting for this code to arrive.
    return () => window.removeEventListener('resize', layout);
  }, []);

  /** The first frame has painted before any hand animation is started. */
  const startHands = async (fallback: boolean) => {
    if (exitStarted.current) return;
    if (quick.current || fallback) { triggerExit(); return; }
    const ok = await Promise.race([
      artReady.current ?? Promise.resolve(false),
      sleep(300).then(() => false),
    ]);
    if (exitStarted.current) return;
    if (!ok) { triggerExit(); return; }
    // The slit finishes opening and the finished drawing holds a beat
    // before the hands come for it.
    const pending = opening.current;
    if (pending?.isActive()) await new Promise<void>((done) => { pending.eventCallback('onComplete', () => done()); });
    if (waitingRef.current) await sleep(HOLD_MS);
    // What the desk's arrival set off (its pin, the heading's layout) has
    // settled before anything moves.
    await frame();
    await frame();
    if (exitStarted.current) return;
    const top = topRef.current!, bot = botRef.current!;
    const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel)!;
    finishEntrance();
    // Drawn bright and shown dim now, so the handover is opacity only.
    drawing.current?.prepareHandover();
    performance.mark('pl-hands');
    const tl = gsap.timeline({ onComplete: () => triggerExit(true) });
    handTimeline.current = tl;
    const open = opened.current;
    if (repeat.current) tl.timeScale(REPEAT_SPEED);
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
    tl.to(top, { y: 6 - open.top, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to(bot, { y: open.bot - 6, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to([top, bot], { x: () => gsap.utils.random(-3, 3), duration: 0.045, repeat: 3, yoyo: true, ease: 'none' }, 0.62);
  };

  /** Pull the bars off the screen (gripped, or plain if the hands never came). */
  const triggerExit = (gripped = false) => {
    if (exitStarted.current) return;
    exitStarted.current = true;
    performance.mark('pl-exit');

    document.body.style.overflow = '';
    const work = location.hash === '#showcase' && document.getElementById('showcase');
    const revealY = work ? window.scrollY + work.getBoundingClientRect().top : 0;
    window.scrollTo({top: revealY, behavior: 'instant'});
    if (window.__lenis) {
      window.__lenis.scrollTo(revealY, { immediate: true, force: true });
      window.__lenis.start();   // clear isStopped so wheel scrolling works again
    }

    const top = topRef.current, bot = botRef.current, root = rootRef.current;
    const label = progressRef.current, outline = outlineRef.current;
    // Reduced motion: no bars moving, the loader just fades.
    if (quick.current) {
      onReveal();
      exitTimeline.current = gsap.timeline({ onComplete: onDone }).to(root, { opacity: 0, duration: 0.4, ease: 'power1.out' });
      return;
    }
    const { s, imgTop, vh } = geo.current;
    // Far enough that each half (bar, hand and all) is past the screen edge.
    const { split } = art.current;
    const outTop = -(imgTop + split * s) - 40;
    const outBot = vh - (imgTop + split * s) + 40;
    // In place only onto the live desk, seen from its opening camera.
    const desk = load.phase === 'ready' && !work && drawing.current !== null;
    const name = work ? null : nameTargets();
    const start = performance.now();
    handover.start = start;
    handover.name = name !== null;
    if (desk) drawing.current!.prepareHandover();

    onReveal();
    const pull = gripped ? (repeat.current ? 0.62 : 0.75) : 0.65;
    const tl = gsap.timeline({ onComplete: onDone });
    exitTimeline.current = tl;
    // The name flies into the hero heading (transforms only), then hands
    // over to it: the heading fades in where the name has landed.
    if (name) {
      gsap.killTweensOf(name.words);
      tl.set(nameRef.current, { zIndex: 3 }, 0);
      tl.to(nameRef.current, { opacity: 1, duration: 0.25, ease: 'power2.out' }, 0);
      name.words.forEach((w, i) => tl.to(w, { ...name.result[i], transformOrigin: '0 0', duration: 0.75, ease: 'power3.inOut' }, 0.05));
      tl.fromTo(name.h1, { opacity: 0 }, { opacity: 1, duration: 0.32, ease: 'power1.inOut', immediateRender: true }, 0.66);
      tl.to(nameRef.current, { opacity: 0, duration: 0.32, ease: 'power1.inOut' }, 0.66);
      tl.set(name.h1, { clearProps: 'opacity' }, desk ? INTRO_END : 1);
    } else tl.to(nameRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0);
    // (Its CSS fade-in transition would otherwise hold this back.)
    if (label) label.style.transition = 'none';
    tl.to(label, { opacity: 0, duration: 0.25, ease: 'power2.out' }, 0);
    if (desk && outline) {
      // The drawing stays over the dark room and dissolves into the scene
      // as it powers on (outlineAt / introAt in timeline.ts).
      outline.dataset.handover = 'true';
      if (!waitingRef.current) tl.fromTo(outline, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
      const tick = (tickRef.current = () => drawing.current?.handover((performance.now() - start) / 1000));
      tick();
      gsap.ticker.add(tick);
      tl.call(() => gsap.ticker.remove(tick), [], INTRO_END);
    } else tl.to(outline, { opacity: 0, duration: waitingRef.current ? 0.4 : 0.15 }, 0);
    tl.set(root, { background: 'transparent' }, 0.05);
    gsap.killTweensOf([top, bot], 'x');
    tl.set([top, bot], { x: 0 }, 0);
    tl.to(top, { y: outTop, duration: pull, ease: 'power4.inOut' }, 0.05);
    tl.to(bot, { y: outBot, duration: pull, ease: 'power4.inOut' }, 0.05);
  };

  useEffect(() => { handsRef.current = startHands; });

  const { to, creep } = progressFor(load);
  // Light bar, then fan, then the screens: each lights as its stage arrives.
  const lit = load.phase === 'rendering' || finished ? 3
    : to >= 0.6 ? 2
    : to >= 0.3 ? 1 : 0;
  useEffect(() => {
    litRef.current = lit;
    drawing.current?.setLit(lit);
  }, [lit]);

  // The tracing follows the load: a tween to each known stage, or a creep
  // toward it while the amount is unknown.
  useEffect(() => {
    if (!waiting || plain) return;
    const state = progress.current;
    const bar = progressRef.current;
    const paint = () => {
      drawing.current?.setProgress(state.p);
      const percent = Math.round(state.p * 100);
      if (percentRef.current) percentRef.current.textContent = percent + '%';
      bar?.setAttribute('aria-valuenow', String(percent));
    };
    if (creep) {
      // Close a share of the gap every frame (time constant `creep`).
      const tick = (_time: number, delta: number) => {
        if (state.p < to) state.p += (to - state.p) * (1 - Math.exp(-delta / 1000 / creep));
        paint();
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    }
    const tween = gsap.to(state, {
      p: Math.max(to, state.p), duration: to >= 1 ? 0.45 : 0.8, ease: 'power2.out', onUpdate: paint,
    });
    return () => { tween.kill(); };
  }, [waiting, plain, to, creep]);

  // The plain bar (reduced motion) shows the same progress, without easing.
  const percent = Math.round(to * 100);
  const counting = load.phase === 'starting' || load.phase === 'downloading';
  const label = {
    starting: 'Preparing the scene',
    downloading: 'Loading the desk',
    rendering: 'Powering the screens',
    ready: 'Desk ready',
    fallback: 'Opening the portfolio',
  }[load.phase];

  return (
    <div ref={rootRef} className="pl-root" data-waiting={waiting}>
      <div ref={outlineRef} className="pl-outline" aria-hidden="true" />
      {/* The name, glowing in the slit; its words fly into the hero heading */}
      <div ref={nameRef} className="pl-name">
        <span ref={(el) => { wordRefs.current[0] = el; }} className="pl-word">Ahnaf</span>{' '}
        <span ref={(el) => { wordRefs.current[1] = el; }} className="pl-word">Hussain</span>
      </div>
      <div ref={progressRef} className={plain ? 'pl-loading' : 'pl-sketch'} data-waiting={waiting}
        role="progressbar" aria-label="Loading the portfolio" aria-valuenow={plain ? percent : undefined}>
        {plain && (
          <div className="pl-loading-track">
            <span style={{width: percent + '%'}} />
          </div>
        )}
        <div className="pl-loading-label" aria-live="polite">
          {label}
          {counting && (plain
            ? <span className="pl-loading-percent" aria-hidden="true">{percent}%</span>
            : <span ref={percentRef} className="pl-loading-percent" aria-hidden="true" />)}
        </div>
      </div>

      <div ref={topRef} className="pl-half pl-top" aria-hidden="true">
        <div className="pl-bar" />
        <Hand pose="open" half="top" />
        <Hand pose="mid" half="top" />
        <Hand pose="grip" half="top" />
      </div>
      <div ref={botRef} className="pl-half pl-bottom" aria-hidden="true">
        <div className="pl-bar" />
        <Hand pose="open" half="bottom" />
        <Hand pose="mid" half="bottom" />
        <Hand pose="grip" half="bottom" />
      </div>
    </div>
  );
}
