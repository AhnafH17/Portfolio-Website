'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';
import PlanetSurface from './canvas-showcase/PlanetSurface';

gsap.registerPlugin(ScrollTrigger);

const SpaceCanvas = dynamic(() => import('./canvas-showcase/SpaceCanvas'), { ssr: false });

interface CategoryGroup {
  title: string;
  titleBold: string;
  subtitle: string;
  projects: ProjectKey[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    title: 'Software & ',
    titleBold: 'AI Engineering',
    subtitle: 'Building intelligent systems, tools and platforms that solve real problems.',
    projects: ['notion', 'scripting', 'data'],
  },
  {
    title: 'Web Development & ',
    titleBold: 'E-commerce',
    subtitle: 'Crafting high-performance websites and digital storefronts from scratch.',
    projects: ['leadcraft', 'bp', 'resizer'],
  },
  {
    title: 'SEO, Security & ',
    titleBold: 'Web Presence',
    subtitle: 'Securing, optimizing and scaling digital presence for real-world results.',
    projects: ['cpc', 'revive', 'aurix'],
  },
];

/* Left-side timeline: 3 real categories + a static "What's Next" closer */
const TIMELINE_ITEMS = [
  { num: '01', label: 'Software & AI Engineering' },
  { num: '02', label: 'Web Development & E-commerce' },
  { num: '03', label: 'SEO, Security & Web Presence' },
  { num: '04', label: "What's Next" },
];

/* Short descriptions for each project (one-liner for the card) */
const SHORT_DESC: Record<ProjectKey, string> = {
  notion: 'A full-stack internal project and task management system.',
  scripting: 'A creative operations engine built for short-form content.',
  data: 'A system to send targeted campaigns to 10,900+ contacts.',
  leadcraft: 'A 5-page website with WebGL, GSAP and Globe.gl animations.',
  bp: 'Shopify rebrand with custom preloader, 3D cards and process flows.',
  resizer: 'A browser-based SaaS tool for batch image optimization.',
  cpc: 'Complete website overhaul, security remediation and SEO push.',
  revive: 'Premium program pages for mental wellness and brain stimulation.',
  aurix: 'Comprehensive SEO overhaul with schema markup and Core Web Vitals.',
};

/* Real per-project stack tags, pulled from lib/projects.ts stripMeta */
const TAGS: Record<ProjectKey, string[]> = Object.fromEntries(
  stripMeta.map((m) => [m.key, m.tags])
) as Record<ProjectKey, string[]>;

/* Per-card 3D tilt: left card tilts left, center is flat, right tilts right */
const CARD_TILTS = [-8, 0, 8];

/* Each of the 3 persistent card slots sits slightly off the perfectly
   centered row (fixed, non-random offsets — no Math.random() at render, so
   there's no hydration mismatch) and floats gently on its own cycle so the
   layout doesn't read as static/rigid. */
const SLOT_LAYOUT = [
  { x: -10, y: 26, rotZ: -2.2, dur: 6.4, delay: -0.8 },
  { x: 2, y: -22, rotZ: 1.6, dur: 7.2, delay: -3.1 },
  { x: 8, y: 16, rotZ: -1.2, dur: 6.8, delay: -1.9 },
];

/* Scroll-driven planet motion across the whole pin: extra spin (as a % of
   the 3-tile texture strip — 12% is ~a third of a turn) and growth. */
const PLANET_SCROLL_SPIN = [12, 9];
const PLANET_SCROLL_GROW = 0.08;

/* Fixed (non-random) asteroid silhouettes scattered along the bottom edge —
   hardcoded so there's no hydration mismatch between server and client. */
const ASTEROIDS = [
  { left: '4%', bottom: '-4%', size: 110, rotate: -12, opacity: 0.9 },
  { left: '11%', bottom: '6%', size: 46, rotate: 30, opacity: 0.75 },
  { left: '19%', bottom: '-8%', size: 150, rotate: 8, opacity: 0.95 },
  { left: '30%', bottom: '10%', size: 30, rotate: -20, opacity: 0.6 },
  { left: '68%', bottom: '8%', size: 34, rotate: 15, opacity: 0.65 },
  { left: '80%', bottom: '-10%', size: 160, rotate: -6, opacity: 0.95 },
  { left: '90%', bottom: '4%', size: 60, rotate: 22, opacity: 0.8 },
  { left: '96%', bottom: '-6%', size: 90, rotate: -18, opacity: 0.85 },
];

/* Fixed "city light" dots along the horizon glow */
const CITY_LIGHTS = [6, 14, 21, 27, 33, 40, 47, 53, 60, 67, 73, 79, 86, 93].map((left, i) => ({
  left: `${left}%`,
  delay: (i % 5) * 0.4,
  bright: i % 3 === 0,
}));

/* ── Scroll timing ──
   The pin lasts PIN_LENGTH of the viewport height. Progress (0-1) is split
   at BOUNDARIES rather than into equal thirds: the first category is kept
   short so the first flip starts after ~3 wheel notches instead of ~8.
   At a 900px viewport: ~300px before flip 1, ~250px per flip, ~300px
   resting on category 2, ~430px on category 3 before the pin releases. */
const PIN_LENGTH = '+=170%';
const BOUNDARIES = [0.28, 0.64];
const STOPS = [0, BOUNDARIES[0], BOUNDARIES[1], 1];
const FLIP_HALF_WIDTH = 0.08;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ── Persistent card-slot flip geometry ──
   There are exactly 3 slots (one per project-per-category) and 3
   categories, so this uses a fixed 2-face flip-card scheme rather than a
   generic N-face carousel:
     - faceA starts showing category 0's project, flips to reveal faceB
       (category 1) at the first boundary, then — while faceA is safely
       hidden behind the card — faceA's own content is swapped to
       category 2 so the second flip (back to faceA) reveals it.
     - faceB only ever shows category 1, so it never needs to change.
   This generalizes to any odd/even category count only in the "3
   categories, 2 faces" case; with only 3 categories here that's exactly
   what's needed, so it's hardcoded rather than built as a general system. */
const SLOT_STAGGER = 0.015;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/* Time constant for easing the displayed flip angle toward the scroll-driven
   target. Done in JS rather than a CSS transition so we always know the
   angle actually on screen — the face-content swap must key off that, not
   off the scroll target, or a fast scroll swaps content on a face that's
   still visibly facing the viewer. */
const FLIP_EASE_TAU = 0.2;

function computeSlotFlip(progress: number, slotIndex: number): number {
  const shift = slotIndex * SLOT_STAGGER;
  const b0 = BOUNDARIES[0] + shift;
  const b1 = BOUNDARIES[1] + shift;
  const hw = FLIP_HALF_WIDTH;

  let rotateY: number;
  if (progress <= b0 - hw) {
    rotateY = 0;
  } else if (progress < b0 + hw) {
    rotateY = 180 * smoothstep(Math.min(1, Math.max(0, (progress - (b0 - hw)) / (2 * hw))));
  } else if (progress <= b1 - hw) {
    rotateY = 180;
  } else if (progress < b1 + hw) {
    rotateY = 180 + 180 * smoothstep(Math.min(1, Math.max(0, (progress - (b1 - hw)) / (2 * hw))));
  } else {
    rotateY = 360;
  }

  return rotateY;
}

/* One face's worth of card content (used for both faceA and faceB of each
   flip slot) — pulled out since it's now rendered twice per slot. */
function CardFace({ projKey, tiltY }: { projKey: ProjectKey; tiltY: number }) {
  const project = projectData[projKey];
  return (
    // A real link, so search engines can follow it to the case study.
    <a
      className="cs-card"
      href={`/projects/${projKey}`}
      style={{ '--tilt': `${tiltY}deg` } as React.CSSProperties}
    >
      <div className="cs-card-rim" />
      {tiltY < 0 && <div className="cs-card-edge cs-card-edge-right" />}
      {tiltY > 0 && <div className="cs-card-edge cs-card-edge-left" />}
      <div className="cs-card-inner">
        <div className="cs-card-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/${project.image}`} alt={project.title} className="cs-card-img" />
          <div className="cs-card-media-fade" />
        </div>
        <div className="cs-card-body">
          <div className="cs-card-tags">
            {(TAGS[projKey] ?? []).map((tag) => (
              <span key={tag} className="cs-tag-pill">{tag}</span>
            ))}
          </div>
          <h3 className="cs-card-title">{project.title}</h3>
          <p className="cs-card-desc">{SHORT_DESC[projKey]}</p>
          <div className="cs-card-cta">
            VIEW PROJECT
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function CanvasShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingRefs = useRef<Array<HTMLDivElement | null>>([]);
  const flipRefs = useRef<Array<HTMLDivElement | null>>([]);
  const progressFillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const lastCategoryRef = useRef(0);
  const lastTimelineRef = useRef(0);
  const slotSwappedRef = useRef([false, false, false]);
  const targetAnglesRef = useRef([0, 0, 0]);
  const shownAnglesRef = useRef([0, 0, 0]);
  const flipRafRef = useRef<number | null>(null);
  const surfaceProgressRef = useRef(0);
  const planetRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [activeCategory, setActiveCategory] = useState(0);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);
  // faceA's current content per slot — starts as category 0's projects,
  // swaps (per-slot) to category 2's projects once that slot's first flip
  // has carried it safely out of view. faceB never changes (always cat 1).
  const [faceAKeys, setFaceAKeys] = useState<ProjectKey[]>(CATEGORIES[0].projects);

  /* Imperative per-frame update — writes directly to the DOM via refs
     instead of going through React state/render, so scrubbing the
     ScrollTrigger doesn't re-render the whole tree (headings, 9 cards,
     backdrop) 60x/sec. */
  const applyProgress = useCallback((progress: number) => {
    surfaceProgressRef.current = progress;

    // Planets turn a little further and swell slightly as you fly on — they
    // scale about their own (off-screen) centres, so they grow toward the
    // middle of the view.
    planetRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--spin-shift', `${progress * PLANET_SCROLL_SPIN[i]}%`);
      el.style.transform = `scale(${1 + progress * PLANET_SCROLL_GROW})`;
    });

    // Headings hand off across the same windows the cards flip in: the
    // outgoing title fades over the first half of the flip, the incoming one
    // over the second half, so the two never overlap. The first title is
    // there from the start and the last one stays up as the pin releases.
    CATEGORIES.forEach((_, i) => {
      let opacity = 1;
      if (i > 0) opacity = clamp01((progress - BOUNDARIES[i - 1]) / FLIP_HALF_WIDTH);
      if (i < CATEGORIES.length - 1) opacity = Math.min(opacity, clamp01((BOUNDARIES[i] - progress) / FLIP_HALF_WIDTH));

      const headEl = headingRefs.current[i];
      if (headEl) headEl.style.opacity = String(opacity);

      const fillEl = progressFillRefs.current[i];
      if (fillEl) fillEl.style.transform = `scaleX(${clamp01((progress - STOPS[i]) / (STOPS[i + 1] - STOPS[i]))})`;
    });

    // The 3 persistent card slots only get a new target angle here; the
    // eased rotation and face-content swap happen in runFlipLoop.
    for (let slot = 0; slot < 3; slot++) {
      targetAnglesRef.current[slot] = computeSlotFlip(progress, slot);
    }
    if (flipRafRef.current === null) {
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const k = 1 - Math.exp(-dt / FLIP_EASE_TAU);
        let settled = true;

        for (let slot = 0; slot < 3; slot++) {
          const target = targetAnglesRef.current[slot];
          let shown = shownAnglesRef.current[slot];
          shown += (target - shown) * k;
          if (Math.abs(target - shown) < 0.05) shown = target;
          else settled = false;
          shownAnglesRef.current[slot] = shown;

          const flipEl = flipRefs.current[slot];
          if (flipEl) flipEl.style.transform = `rotateY(${shown}deg)`;

          // faceA is fully back-facing at 180deg: below that it will next be
          // seen showing category 0, above it showing category 2. Swapping
          // at the displayed 180 means the change is never on screen.
          const faceAShowsThird = shown > 180;
          if (faceAShowsThird !== slotSwappedRef.current[slot]) {
            slotSwappedRef.current[slot] = faceAShowsThird;
            setFaceAKeys((prev) => {
              const next = [...prev];
              next[slot] = faceAShowsThird ? CATEGORIES[2].projects[slot] : CATEGORIES[0].projects[slot];
              return next;
            });
          }
        }

        flipRafRef.current = settled ? null : requestAnimationFrame(tick);
      };
      flipRafRef.current = requestAnimationFrame(tick);
    }

    const catIndex = progress < BOUNDARIES[0] ? 0 : progress < BOUNDARIES[1] ? 1 : 2;
    if (catIndex !== lastCategoryRef.current) {
      lastCategoryRef.current = catIndex;
      setActiveCategory(catIndex);
    }

    const timelineIdx = progress > 0.995 ? 3 : catIndex;
    if (timelineIdx !== lastTimelineRef.current) {
      lastTimelineRef.current = timelineIdx;
      setActiveTimelineIndex(timelineIdx);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Paint the correct initial (progress = 0) state immediately, since
    // ScrollTrigger's onUpdate only fires on subsequent scroll changes.
    applyProgress(0);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: PIN_LENGTH,
        pin: true,
        // Kept tight to the actual scroll position — the eased flip comes
        // from the JS easing loop, and stacking a laggy scrub on top of it
        // felt floaty.
        scrub: 0.15,
        onUpdate: (self) => applyProgress(self.progress),
        onRefresh: (self) => applyProgress(self.progress),
      });
    }, containerRef);

    return () => {
      ctx.revert();
      if (flipRafRef.current !== null) {
        cancelAnimationFrame(flipRafRef.current);
        flipRafRef.current = null;
      }
    };
  }, [applyProgress]);

  return (
    <section
      ref={containerRef}
      className="cs-section"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Starfield */}
      <SpaceCanvas />

      {/* ── CSS-only deep space backdrop: planets, nebula, asteroids, horizon ── */}
      <div className="cs-bg" aria-hidden="true">
        <div className="cs-planet cs-planet-tl" ref={(el) => { planetRefs.current[0] = el; }} />
        <div className="cs-planet cs-planet-tr" ref={(el) => { planetRefs.current[1] = el; }} />
        <div className="cs-nebula" />
        <div className="cs-asteroids">
          {ASTEROIDS.map((a, i) => (
            <span
              key={i}
              className="cs-asteroid"
              style={{
                left: a.left,
                bottom: a.bottom,
                width: a.size,
                height: a.size,
                transform: `rotate(${a.rotate}deg)`,
                opacity: a.opacity,
              }}
            />
          ))}
        </div>
        <div className="cs-horizon">
          <div className="cs-horizon-curve" />
          <div className="cs-horizon-glow" />
          <div className="cs-horizon-lights">
            {CITY_LIGHTS.map((l, i) => (
              <span
                key={i}
                className={`cs-city-light${l.bright ? ' is-bright' : ''}`}
                style={{ left: l.left, animationDelay: `${l.delay}s` }}
              />
            ))}
          </div>
        </div>
        <PlanetSurface progressRef={surfaceProgressRef} />
      </div>

      {/* ── Left-side numbered timeline ── */}
      <div className="cs-timeline" role="navigation" aria-label="Showcase categories">
        <div className="cs-timeline-line" />
        {TIMELINE_ITEMS.map((item, idx) => (
          <div
            key={item.num}
            className={`cs-timeline-item${activeTimelineIndex === idx ? ' is-active' : ''}`}
          >
            <span className="cs-timeline-node">{item.num}</span>
            <span className="cs-timeline-label">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Top-left counter ── */}
      <div className="cs-corner cs-corner-tl">
        <span className="cs-counter-active">
          {String(activeCategory + 1).padStart(2, '0')}
        </span>
        <span className="cs-counter-sep">/</span>
        <span className="cs-counter-total">
          {String(CATEGORIES.length).padStart(2, '0')}
        </span>
      </div>

      {/* ── Category titles ── */}
      <div className="cs-heading-stack">
        {CATEGORIES.map((cat, idx) => (
          <div
            key={idx}
            ref={(el) => { headingRefs.current[idx] = el; }}
            className="cs-heading"
            style={{ opacity: idx === 0 ? 1 : 0 }}
          >
            <h2 className="cs-title">
              {cat.title}
              <strong>{cat.titleBold}</strong>
            </h2>
            <p className="cs-subtitle">{cat.subtitle}</p>
            <div className="cs-title-divider" />
          </div>
        ))}
      </div>

      {/* ── 3 persistent card slots — each flips in place to reveal the
          next category's project, rather than a new set of cards
          animating in per category. Off-centered + gently floating. ── */}
      <div className="cs-cards-layer">
        {SLOT_LAYOUT.map((layout, slot) => {
          const tiltY = CARD_TILTS[slot] ?? 0;
          const frontKey = faceAKeys[slot];
          const backKey = CATEGORIES[1].projects[slot];
          return (
            <div
              key={slot}
              className="cs-slot"
              style={{
                '--ox': `${layout.x}px`,
                '--oy': `${layout.y}px`,
                '--orz': `${layout.rotZ}deg`,
              } as React.CSSProperties}
            >
              <div
                className="cs-slot-float"
                style={{ animationDuration: `${layout.dur}s`, animationDelay: `${layout.delay}s` }}
              >
                <div className="cs-flip" ref={(el) => { flipRefs.current[slot] = el; }}>
                  <div className="cs-face cs-face-front">
                    <CardFace projKey={frontKey} tiltY={tiltY} />
                  </div>
                  <div className="cs-face cs-face-back">
                    <CardFace projKey={backKey} tiltY={tiltY} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom-center: progress + scroll cue ── */}
      <div className="cs-bottom-center">
        <div className="cs-progress">
          {CATEGORIES.map((_, idx) => (
            <span key={idx} className="cs-progress-track">
              <span
                ref={(el) => { progressFillRefs.current[idx] = el; }}
                className="cs-progress-fill"
                style={{ transform: 'scaleX(0)' }}
              />
            </span>
          ))}
        </div>

        <div className="cs-scroll-cue">SCROLL TO EXPLORE</div>
      </div>
    </section>
  );
}
