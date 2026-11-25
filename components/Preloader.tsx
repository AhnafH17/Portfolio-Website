'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { DeskLoad } from './desk/loading';

declare global {
  interface Window { __lenis?: import('lenis').default; }
}

interface PreloaderProps {
  load: DeskLoad;
  onSkip: () => void;
  /** Start revealing the site — fires as the bars are pulled apart. */
  onReveal: () => void;
  /** The bars are gone and the preloader can be removed from the tree.
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
/* While waiting, sizes as shares of the drawing's width: the name's height,
   the gap under it, and the dark margin kept above and below inside the
   opened slit. */
const NAME_K = 0.05, GAP_K = 0.04, PAD_K = 0.055;
/** How long a finished drawing is held before the hands come. */
const HOLD_MS = 280;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
/** The drawing is fully traced at this progress; the rest is the screens. */
const TRACED = 0.9;
const SCREENS = [
  { clip: 'M104,26 H162 V124 H104 Z', x: 104, y: 26, w: 58, h: 98, cursor: [141, 32] },
  { clip: 'M206,50 H394 V124 H206 Z', x: 206, y: 50, w: 188, h: 74, cursor: [256, 56] },
  { clip: 'M406,60 L506,68 V122 L406,126 Z', x: 406, y: 60, w: 100, h: 66, cursor: [452, 67] },
];

/* While the desk is still on its way, the same setup (three monitors, light
   bar, desk, tower, the hooded figure in the chair) traces itself in thin
   strokes, big, in the opened slit. One stroke at a time draws behind a
   glowing accent pen and settles to a dim line once it's done; the desk's
   front edge is its LED strip, which fills as the progress bar. Details light
   up as stages are reached: the light bar, then the tower fan (spinning), and
   while the scene renders the screens power on one by one, scanning, with a
   cursor blinking. Every stroke with class "t" is traced in document order,
   each for its share of the total length, so the pen moves at one speed. */
function DeskSketch({ active, to, creep, lit, percentRef }: {
  active: boolean; to: number; creep: number; lit: number;
  percentRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const state = useRef({ p: 0 });
  const paint = useRef<() => void>(() => {});

  useEffect(() => {
    const svg = svgRef.current!;
    const strokes = Array.from(svg.querySelectorAll<SVGPathElement>('.t'));
    const head = svg.querySelector<SVGCircleElement>('.pl-head')!;
    const led = svg.querySelector<SVGPathElement>('.pl-led')!;
    const bar = svg.closest('[role=progressbar]');
    const lengths = strokes.map((el) => el.getTotalLength() || 1);
    const total = lengths.reduce((a, b) => a + b, 0);
    let run = 0;
    // Each stroke's span of progress, overlapping the next a little.
    const spans = lengths.map((length) => {
      const from = (run / total) * TRACED;
      run += length;
      return [from, Math.min(TRACED, (run / total) * TRACED + 0.012)];
    });
    paint.current = () => {
      const { p } = state.current;
      let tip = -1;
      strokes.forEach((el, i) => {
        const [from, until] = spans[i];
        const local = Math.min(1, Math.max(0, (p - from) / (until - from)));
        el.style.strokeDashoffset = String(1 - local);
        el.style.opacity = local > 0 ? '' : '0';
        const s = local <= 0 ? '' : local < 1 ? 'on' : 'done';
        if (el.dataset.s !== s) el.dataset.s = s;
        if (el.classList.contains('solid')) el.style.fillOpacity = String(local * local);
        if (s === 'on') tip = i;
      });
      if (tip >= 0) {
        const [from, until] = spans[tip];
        const point = strokes[tip].getPointAtLength(((p - from) / (until - from)) * lengths[tip]);
        head.setAttribute('cx', String(point.x));
        head.setAttribute('cy', String(point.y));
      }
      head.style.opacity = tip >= 0 ? '1' : '0';
      led.style.strokeDashoffset = String(1 - p);
      const percent = Math.round(p * 100);
      if (percentRef.current) percentRef.current.textContent = percent + '%';
      bar?.setAttribute('aria-valuenow', String(percent));
    };
    paint.current();
  }, [percentRef]);

  useEffect(() => {
    if (!active) return;
    const s = state.current;
    if (creep) {
      // Close a share of the gap every frame (time constant `creep`).
      const tick = (_time: number, delta: number) => {
        if (s.p < to) s.p += (to - s.p) * (1 - Math.exp(-delta / 1000 / creep));
        paint.current();
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    }
    const tween = gsap.to(s, {
      p: Math.max(to, s.p), duration: to >= 1 ? 0.45 : 0.8, ease: 'power2.out', onUpdate: () => paint.current(),
    });
    return () => { tween.kill(); };
  }, [active, to, creep]);

  const t = { className: 't', pathLength: 1 };
  const solid = { className: 't solid', pathLength: 1 };
  return (
    <svg ref={svgRef} className="pl-sketch-art" viewBox="0 0 600 232" aria-hidden="true">
      <defs>
        <filter id="pl-glow" filterUnits="userSpaceOnUse" x="-10" y="-10" width="620" height="252">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="pl-head-glow" x="-4" y="-4" width="9" height="9">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="pl-scanlines" width="6" height="3" patternUnits="userSpaceOnUse">
          <rect className="pl-sk-scanline" width="6" height="0.7" />
        </pattern>
        <linearGradient id="pl-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="pl-sk-band-edge" />
          <stop offset="0.75" className="pl-sk-band-mid" />
          <stop offset="1" className="pl-sk-band-edge" />
        </linearGradient>
        {SCREENS.map((sc, i) => <clipPath key={i} id={`pl-scr-${i}`}><path d={sc.clip} /></clipPath>)}
      </defs>
      {/* Desk: top, front face, leg, drawer unit */}
      <path {...t} d="M40,150 L70,136 H530 L560,150" />
      <path {...t} d="M40,150 V157 H560 V150" />
      <path {...t} d="M54,157 V220 M44,220 H64" />
      <path {...t} d="M430,157 V220 H548 V157 M430,180 H548 M430,200 H548" />
      <path {...t} className="t dim" d="M482,169 H496 M482,190 H496 M482,210 H496" />
      {/* Monitors: portrait left, wide centre, angled right */}
      <path {...t} d="M104,26 H162 V124 H104 Z" />
      <path {...t} d="M133,124 V134 M121,135 H145" />
      <path {...t} d="M206,50 H394 V124 H206 Z" />
      <path {...t} d="M300,124 V134 M280,135 H320" />
      <path {...t} d="M406,60 L506,68 V122 L406,126 Z" />
      <path {...t} d="M456,124 V134 M442,135 H470" />
      <g className="pl-sk-lit" data-lit={lit >= 1}>
        <path {...t} d="M238,42 H362 M300,42 V50" />
      </g>
      {/* Tower, its fan ring and vents */}
      <path {...t} d="M512,70 H566 V148 H512 Z M566,70 L574,65 V143 L566,148" />
      <g className="pl-sk-lit pl-sk-fan" data-lit={lit >= 2}>
        <path {...t} d="M524,98 a15,15 0 1,0 30,0 a15,15 0 1,0 -30,0" />
        <g className="pl-sk-blades">
          <path {...t} d="M534,98 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M539,93 V85 M543.3,100.5 L550,104.5 M534.7,100.5 L528,104.5" />
        </g>
      </g>
      <path {...t} className="t dim" d="M520,126 H558 M520,132 H558 M520,138 H558" />
      {/* Pad, keyboard, mouse */}
      <path {...t} className="t dim" d="M232,139 H372 L378,147 H226 Z" />
      <path {...t} d="M252,141 H328 L331,145 H249 Z" />
      <path {...t} d="M350,142 a3.5,2.2 0 1,0 7,0 a3.5,2.2 0 1,0 -7,0" />
      {/* The screens power on while the scene renders, left to right: faint
          scan lines, a band sweeping down, and a blinking cursor */}
      <g className="pl-sk-screens" data-lit={lit >= 3}>
        {SCREENS.map((sc, i) => (
          <g key={i} className="pl-sk-scr" clipPath={`url(#pl-scr-${i})`} style={{ transitionDelay: `${i * 0.18}s` }}>
            <rect className="pl-sk-lines" x={sc.x} y={sc.y} width={sc.w} height={sc.h} />
            <rect className="pl-sk-band" x={sc.x} y={sc.y - 16} width={sc.w} height={16}
              style={{ '--h': `${sc.h + 16}px`, animationDelay: `${i * 0.18}s` } as React.CSSProperties} />
            <rect className="pl-sk-cursor" x={sc.cursor[0]} y={sc.cursor[1]} width={3.2} height={6} />
          </g>
        ))}
      </g>
      <g className="pl-sk-lit pl-sk-ui" data-lit={lit >= 3}>
        <path {...t} d="M112,36 H138 M112,46 H154 M112,60 H154 M112,70 H146 M112,84 H154 M112,94 H146 M112,108 H154" />
        <path {...t} d="M216,60 H252 M216,69 H300 M216,80 h40 v34 h-40 Z M262,80 h40 v34 h-40 Z M308,80 h40 v34 h-40 Z M354,80 h32 v34 h-32 Z" />
        <path {...t} d="M414,71 H448 M414,79 H482 M414,90 h26 v26 h-26 Z M446,91 h26 v25 h-26 Z M478,92 h20 v23 h-20 Z" />
      </g>
      {/* The figure, then the chair in front of it */}
      <path {...solid} d="M160,172 C160,152 168,143 180,139 C178,120 184,103 196,100 C208,103 214,120 212,139 C224,143 232,152 232,172 Z" />
      <path {...t} className="t dim" d="M196,102 C194,116 194,128 196,139" />
      <path {...solid} d="M166,156 Q166,148 174,148 H218 Q226,148 226,156 V196 Q226,204 218,204 H174 Q166,204 166,196 Z" />
      <path {...t} d="M196,204 V214 M172,222 L196,214 L220,222 M196,214 V224" />
      {/* The LED strip on the desk's front edge: the progress bar */}
      <path className="pl-led-track" d="M40,153.5 H560" />
      <path className="pl-led" pathLength={1} d="M40,153.5 H560" />
      {/* The pen: a glowing point at the tip of the stroke being drawn */}
      <circle className="pl-head" r="2.4" cx="40" cy="150" />
    </svg>
  );
}

export default function Preloader({ load, onSkip, onReveal, onDone }: PreloaderProps) {
  const rootRef       = useRef<HTMLDivElement>(null);
  const nameRef       = useRef<HTMLDivElement>(null);
  const topRef        = useRef<HTMLDivElement>(null);
  const botRef        = useRef<HTMLDivElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const handsRef      = useRef<(fallback: boolean) => void>(() => {});
  const startedAt     = useRef(0);
  const handTimeline  = useRef<gsap.core.Timeline | null>(null);
  const artReady      = useRef<Promise<boolean> | null>(null);
  const quick         = useRef(false);
  const repeat        = useRef(false);
  const geo           = useRef({ s: 1, imgTop: 0, vh: 0 });
  const art           = useRef<Art>(ARTS.desk);
  const exitStarted   = useRef(false);
  const waitingRef    = useRef(false);
  /** How far each bar has drawn back to open the slit for the drawing. */
  const opened        = useRef(0);
  const opening       = useRef<gsap.core.Tween | null>(null);
  const percentRef    = useRef<HTMLSpanElement>(null);
  const [waiting, setWaiting] = useState(false);
  const [plain, setPlain] = useState(false);

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
    if (!quick.current) {
      const { prefix } = pickArt();
      const srcs = POSES.flatMap((pose) => [`${pose}-top`, `${pose}-bottom`].map((n) => `/images/preloader/${prefix}${n}.webp`));
      artReady.current = Promise.all(srcs.map((src) => {
        const img = new Image();
        img.fetchPriority = 'low';
        img.src = src;
        return img.decode().then(() => true, () => false);
      })).then((ok) => ok.every(Boolean));
    }

    return () => {
      handTimeline.current?.kill();
      document.body.style.overflow = '';
      window.__lenis?.start();
    };
  }, []);
  const fallback = load.phase === 'fallback';
  const finished = load.phase === 'ready' || fallback;
  useEffect(() => {
    if (!finished) {
      const safety = setTimeout(onSkip, LOAD_TIMEOUT_MS);
      // Still loading once the name has landed: the bars draw back, the name
      // steps up, and the drawing takes the space under it.
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
      if (waitingRef.current && !quick.current && !handTimeline.current && !exitStarted.current) placeWaiting(0);
    };
    layout();
    window.addEventListener('resize', layout);
    // The slit opening and the name's entrance are CSS animations (the same
    // geometry is in globals.css), so they play from the first paint instead
    // of waiting for this code to arrive.
    return () => window.removeEventListener('resize', layout);
  }, []);

  /** Open the slit around the drawing: the name above it, the label under
   *  it, the whole group centred, and the bars drawn back just enough. */
  const placeWaiting = (duration: number) => {
    const root = rootRef.current, name = nameRef.current, sketch = progressRef.current;
    const top = topRef.current, bot = botRef.current;
    if (!root || !name || !sketch || !top || !bot) return;
    finishEntrance();
    const vh = window.innerHeight;
    const width = sketch.offsetWidth;
    const font = parseFloat(getComputedStyle(name).fontSize) || 1;
    const nameH = Math.min(font, width * NAME_K);
    const gap = width * GAP_K;
    const total = nameH + gap + sketch.offsetHeight;
    const from = vh / 2 - total / 2;
    sketch.style.top = `${from + nameH + gap}px`;
    const slit = parseFloat(getComputedStyle(root).getPropertyValue('--slit')) || vh * 0.3;
    const open = (opened.current = Math.max(0, (total + 2 * width * PAD_K - slit) / 2));
    const to = { duration, ease: 'power3.inOut' };
    gsap.to(name, { ...to, y: from + nameH / 2 - vh / 2, scale: nameH / font });
    opening.current = gsap.to(top, { ...to, y: -open });
    gsap.to(bot, { ...to, y: open });
  };

  /** The CSS entrance never fights a tween: it ends where the tweens start. */
  const finishEntrance = () => {
    for (const el of [nameRef.current, topRef.current, botRef.current])
      el?.getAnimations().forEach((animation) => animation.finish());
  };

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
    if (exitStarted.current) return;
    const top = topRef.current!, bot = botRef.current!;
    const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel)!;
    finishEntrance();
    const tl = gsap.timeline({ onComplete: () => triggerExit(true) });
    handTimeline.current = tl;
    // A finished drawing stays: the hands reach in over it, and it hands
    // over to the scene as the bars come away (see triggerExit).
    if (!waitingRef.current) tl.to(progressRef.current, { opacity: 0, duration: 0.18 }, 0);
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
    tl.to(top, { y: 6 - open, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to(bot, { y: open - 6, duration: 0.14, ease: 'power2.out' }, 0.6);
    tl.to([top, bot], { x: () => gsap.utils.random(-3, 3), duration: 0.045, repeat: 3, yoyo: true, ease: 'none' }, 0.62);
  };

  /** Pull the bars off the screen (gripped, or plain if the hands never came). */
  const triggerExit = (gripped = false) => {
    if (exitStarted.current) return;
    exitStarted.current = true;

    document.body.style.overflow = '';
    const work = location.hash === '#showcase' && document.getElementById('showcase');
    const revealY = work ? window.scrollY + work.getBoundingClientRect().top : 0;
    window.scrollTo({top: revealY, behavior: 'instant'});
    if (window.__lenis) {
      window.__lenis.scrollTo(revealY, { immediate: true, force: true });
      window.__lenis.start();   // clear isStopped so wheel scrolling works again
    }

    const top = topRef.current, bot = botRef.current, root = rootRef.current;
    const { s, imgTop, vh } = geo.current;
    // Far enough that each half (bar, hand and all) is past the screen edge.
    const { split } = art.current;
    const outTop = -(imgTop + split * s) - 40;
    const outBot = vh - (imgTop + split * s) + 40;

    onReveal();
    const tl = gsap.timeline({ onComplete: onDone });
    // The slit stops being a backdrop: the site shows through the gap.
    tl.to(nameRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 0);
    // A finished drawing lingers over the dark room and fades as the scene
    // powers on under it (its LED sweeps on in the same moment).
    if (waitingRef.current && !quick.current) tl.to(progressRef.current, { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0.05);
    else tl.to(progressRef.current, { opacity: 0, duration: 0.15 }, 0);
    tl.set(root, { background: 'transparent' }, 0.05);
    gsap.killTweensOf([top, bot], 'x');
    tl.set([top, bot], { x: 0 }, 0);
    const pull = gripped ? (repeat.current ? 0.62 : 0.75) : quick.current ? 0.55 : 0.65;
    tl.to(top, { y: outTop, duration: pull, ease: 'power4.inOut' }, 0.05);
    tl.to(bot, { y: outBot, duration: pull, ease: 'power4.inOut' }, 0.05);
  };

  useEffect(() => { handsRef.current = startHands; });

  const { to, creep } = progressFor(load);
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
  // Light bar, then fan, then the screens: each lights as its stage arrives.
  const lit = load.phase === 'rendering' || finished ? 3
    : to >= 0.6 ? 2
    : to >= 0.3 ? 1 : 0;

  return (
    <div ref={rootRef} className="pl-root">
      {/* The name, glowing in the slit */}
      <div ref={nameRef} className="pl-name">Ahnaf Hussain</div>
      <div ref={progressRef} className={plain ? 'pl-loading' : 'pl-sketch'} data-waiting={waiting}
        role="progressbar" aria-label="Loading the portfolio" aria-valuenow={plain ? percent : undefined}>
        {plain ? (
          <div className="pl-loading-track">
            <span style={{width: percent + '%'}} />
          </div>
        ) : (
          <DeskSketch active={waiting} to={to} creep={creep} lit={lit} percentRef={percentRef} />
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
