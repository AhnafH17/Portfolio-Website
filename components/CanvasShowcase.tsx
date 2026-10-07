'use client';

import { useRef, useEffect } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';
import PlanetSurface, { ShowcaseStars, STAR_PARALLAX } from './canvas-showcase/PlanetSurface';

gsap.registerPlugin(ScrollTrigger);

/* "Orbital HUD": the pinned Selected Work scene. A flight over the night
   side of a planet (one 2D canvas: stars, perspective grid, city lights),
   framed by hairline HUD marks. One giant category title rides a horizontal
   track (Swiss kinetic type) and three flat project panels change category
   with a shutter wipe. Every per-frame change is written to the DOM through
   refs, never React state, so scrolling never re-renders the section. */

interface CategoryGroup {
  title: string;
  titleBold: string;
  subtitle: string;
  projects: ProjectKey[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    title: 'Software &',
    titleBold: 'AI Engineering',
    subtitle: 'Building intelligent systems, tools and platforms that solve real problems.',
    projects: ['notion', 'scripting', 'data'],
  },
  {
    title: 'Web Development &',
    titleBold: 'E-commerce',
    subtitle: 'Crafting high-performance websites and digital storefronts from scratch.',
    projects: ['leadcraft', 'bp', 'resizer'],
  },
  {
    title: 'SEO, Security &',
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

/* Short descriptions for each project (one-liner for the panel) */
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

/* Fixed (non-random) asteroid silhouettes along the bottom edge. */
const ASTEROIDS = [
  { left: '4%', bottom: '-4%', size: 110, rotate: -12, opacity: 0.9 },
  { left: '19%', bottom: '-8%', size: 150, rotate: 8, opacity: 0.95 },
  { left: '30%', bottom: '10%', size: 30, rotate: -20, opacity: 0.6 },
  { left: '80%', bottom: '-10%', size: 160, rotate: -6, opacity: 0.95 },
  { left: '90%', bottom: '4%', size: 60, rotate: 22, opacity: 0.8 },
];

/* Scroll-driven planet motion across the pin: extra spin and growth. */
const PLANET_SCROLL_SPIN = [12, 9];
const PLANET_SCROLL_GROW = 0.08;

/* ── Scroll timing ──
   The pin lasts PIN_LENGTH of the viewport height. Progress (0-1) changes
   category at BOUNDARIES; the first category is kept short so the first
   change starts after ~3 wheel notches. Each change plays over ±HALF of
   progress around its boundary, staggered per panel. */
const PIN_LENGTH = '+=170%';
const BOUNDARIES = [0.28, 0.64];
const STOPS = [0, BOUNDARIES[0], BOUNDARIES[1], 1];
const HALF = 0.08;
const SLOT_STAGGER = 0.022;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** 0 → 1 as the change across boundary `b` plays (shifted per slot). */
const wipe = (p: number, b: number, shift = 0) => smoothstep(clamp01((p - (b - HALF + shift)) / (2 * HALF)));

function ProjectPanel({ projKey, eager }: { projKey: ProjectKey; eager: boolean }) {
  const project = projectData[projKey];
  return (
    // A real link, so search engines can follow it to the case study.
    <a className="cs-card" href={`/projects/${projKey}`}>
      <div className="cs-card-media">
        <Image
          src={`/${project.image}`}
          alt={project.title}
          fill
          sizes="(max-width: 768px) 40vw, 380px"
          className="cs-card-img"
          // All nine sit in the same three spots, so they're needed together:
          // load them as the section approaches, not mid-wipe.
          loading={eager ? 'eager' : 'lazy'}
        />
      </div>
      <div className="cs-card-body">
        <div className="cs-card-tags">
          {(TAGS[projKey] ?? []).map((tag) => (
            <span key={tag} className="cs-tag-pill">{tag}</span>
          ))}
        </div>
        <h3 className="cs-card-title">{project.title}</h3>
        <p className="cs-card-desc">{SHORT_DESC[projKey]}</p>
        <span className="cs-card-cta">
          View project
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </a>
  );
}

export default function CanvasShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const echoRef = useRef<HTMLDivElement>(null);
  const subtitleRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const faceRefs = useRef<Array<Array<HTMLDivElement | null>>>([[], [], []]);
  const scanRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const progressFillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const timelineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const counterRef = useRef<HTMLSpanElement>(null);
  const flightRef = useRef<HTMLSpanElement>(null);
  const planetRefs = useRef<Array<HTMLDivElement | null>>([]);
  const surfaceProgressRef = useRef(0);
  const starsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = containerRef.current;
    if (!section) return;
    let lastCat = -1;
    let lastTimeline = -1;
    let lastFlight = -1;

    const apply = (p: number) => {
      surfaceProgressRef.current = p;
      // The starfield (painted once) rises slowly as you fly on.
      if (starsRef.current) starsRef.current.style.transform = `translate3d(0,${-p * STAR_PARALLAX * 100 / (1 + STAR_PARALLAX)}%,0)`;

      planetRefs.current.forEach((el, i) => {
        if (!el) return;
        el.style.setProperty('--spin-shift', `${p * PLANET_SCROLL_SPIN[i]}%`);
        el.style.transform = `scale(${1 + p * PLANET_SCROLL_GROW})`;
      });

      // Kinetic title: the track slides one title per category change and
      // keeps drifting a little in between; the outlined echo lags behind.
      const pos = wipe(p, BOUNDARIES[0]) + wipe(p, BOUNDARIES[1]);
      const drift = (p - (pos / 2)) * 6;
      if (trackRef.current) trackRef.current.style.transform = `translate3d(${-pos * 100 - drift}vw,0,0)`;
      // The echo words are wider than the screen and differ in width, so the
      // track moves between their real offsets.
      const echo = echoRef.current;
      if (echo) {
        const items = echo.children as HTMLCollectionOf<HTMLElement>;
        const i0 = Math.min(1, Math.floor(pos));
        const at = items[i0].offsetLeft + (items[i0 + 1].offsetLeft - items[i0].offsetLeft) * (pos - i0);
        echo.style.transform = `translate3d(${-at + drift * 0.016 * window.innerWidth}px,0,0)`;
      }

      CATEGORIES.forEach((_, i) => {
        // Subtitles cross over the same windows as the titles.
        let o = 1;
        if (i > 0) o = clamp01((p - BOUNDARIES[i - 1]) / HALF);
        if (i < CATEGORIES.length - 1) o = Math.min(o, clamp01((BOUNDARIES[i] - p) / HALF));
        const sub = subtitleRefs.current[i];
        if (sub) sub.style.opacity = String(o);
        const fill = progressFillRefs.current[i];
        if (fill) fill.style.transform = `scaleX(${clamp01((p - STOPS[i]) / (STOPS[i + 1] - STOPS[i]))})`;
      });

      // Panels: each later category's face wipes down over the one before,
      // with a scan line riding the edge of the wipe.
      for (let slot = 0; slot < 3; slot++) {
        const shift = slot * SLOT_STAGGER;
        const w = [1, wipe(p, BOUNDARIES[0], shift), wipe(p, BOUNDARIES[1], shift)];
        let top = 0;
        for (let f = 0; f < 3; f++) if (w[f] > 0.5) top = f;
        for (let f = 0; f < 3; f++) {
          const face = faceRefs.current[slot][f];
          if (!face) continue;
          // Not yet wiped in, or fully covered by a later face: hidden, so
          // nothing of it shows through and it can't take clicks.
          const covered = w.some((x, g) => g > f && x >= 1);
          face.style.visibility = w[f] <= 0 || covered ? 'hidden' : 'visible';
          face.style.clipPath = w[f] >= 1 ? 'none' : `inset(0 0 ${(1 - w[f]) * 100}% 0)`;
          face.style.pointerEvents = f === top ? 'auto' : 'none';
          face.dataset.top = String(f === top);
        }
        const moving = [w[1], w[2]].find((x) => x > 0 && x < 1);
        const scan = scanRefs.current[slot];
        if (scan) {
          scan.style.opacity = moving === undefined ? '0' : '1';
          if (moving !== undefined) scan.style.transform = `translateY(${moving * 100}%)`;
        }
      }

      const cat = p < BOUNDARIES[0] ? 0 : p < BOUNDARIES[1] ? 1 : 2;
      if (cat !== lastCat) {
        lastCat = cat;
        if (counterRef.current) counterRef.current.textContent = String(cat + 1).padStart(2, '0');
      }
      const tl = p > 0.995 ? 3 : cat;
      if (tl !== lastTimeline) {
        lastTimeline = tl;
        timelineRefs.current.forEach((el, i) => { if (el) el.dataset.active = String(i === tl); });
      }
      const flight = Math.round(p * 100);
      if (flight !== lastFlight && flightRef.current) {
        lastFlight = flight;
        flightRef.current.textContent = String(flight).padStart(3, '0');
      }
    };

    // Paint progress 0 now: ScrollTrigger only reports later changes.
    apply(0);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: PIN_LENGTH,
        pin: true,
        anticipatePin: 1,
        scrub: 0.15,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="cs-section" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Backdrop: two gradient planets, horizon, and one canvas for the
          stars, the grid and the city lights ── */}
      <div className="cs-bg" aria-hidden="true">
        <ShowcaseStars starsRef={starsRef} />
        <div className="cs-planet cs-planet-tl" ref={(el) => { planetRefs.current[0] = el; }} />
        <div className="cs-planet cs-planet-tr" ref={(el) => { planetRefs.current[1] = el; }} />
        <div className="cs-nebula" />
        <div className="cs-asteroids">
          {ASTEROIDS.map((a, i) => (
            <span
              key={i}
              className="cs-asteroid"
              style={{ left: a.left, bottom: a.bottom, width: a.size, height: a.size, transform: `rotate(${a.rotate}deg)`, opacity: a.opacity }}
            />
          ))}
        </div>
        <div className="cs-horizon">
          <div className="cs-horizon-curve" />
          <div className="cs-horizon-glow" />
        </div>
        <PlanetSurface progressRef={surfaceProgressRef} />
      </div>

      {/* ── HUD: hairline corner marks and microtype ── */}
      <div className="cs-hud" aria-hidden="true">
        <span className="cs-hud-corner is-tl" />
        <span className="cs-hud-corner is-tr" />
        <span className="cs-hud-corner is-bl" />
        <span className="cs-hud-corner is-br" />
        <span className="cs-hud-text is-tl">Selected work</span>
        <span className="cs-hud-text is-tr">
          Sector <span ref={counterRef} className="cs-hud-strong">01</span> / 03
        </span>
        <span className="cs-hud-text is-bl">
          Flight <span ref={flightRef} className="cs-hud-strong">000</span>%
        </span>
        <span className="cs-hud-text is-br">3 projects / sector</span>
      </div>

      {/* ── Kinetic title: three titles on one horizontal track ── */}
      <div className="cs-kinetic">
        <div ref={echoRef} className="cs-kinetic-track is-echo" aria-hidden="true">
          {CATEGORIES.map((cat, i) => (
            <span key={i} className="cs-kinetic-item"><span className="cs-kinetic-big">{cat.titleBold}</span></span>
          ))}
        </div>
        <div ref={trackRef} className="cs-kinetic-track">
          {CATEGORIES.map((cat, i) => (
            <div key={i} className="cs-kinetic-item">
              <h2 className="cs-title">
                <span className="cs-kinetic-pre">{cat.title}</span>
                <span className="cs-kinetic-big">{cat.titleBold}</span>
              </h2>
            </div>
          ))}
        </div>
        <div className="cs-subtitles">
          {CATEGORIES.map((cat, i) => (
            <p
              key={i}
              ref={(el) => { subtitleRefs.current[i] = el; }}
              className="cs-subtitle"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              {cat.subtitle}
            </p>
          ))}
        </div>
      </div>

      {/* ── Left-side numbered timeline ── */}
      <div className="cs-timeline" role="navigation" aria-label="Showcase categories">
        <div className="cs-timeline-line" />
        {TIMELINE_ITEMS.map((item, idx) => (
          <div
            key={item.num}
            ref={(el) => { timelineRefs.current[idx] = el; }}
            className="cs-timeline-item"
            data-active={idx === 0 ? 'true' : 'false'}
          >
            <span className="cs-timeline-node">{item.num}</span>
            <span className="cs-timeline-label">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── 3 panel slots; each holds all three categories' projects stacked,
          and the later ones wipe down over the earlier ── */}
      <div className="cs-cards-layer">
        {[0, 1, 2].map((slot) => (
          <div key={slot} className="cs-slot" data-slot={slot}>
            {CATEGORIES.map((cat, f) => (
              <div
                key={f}
                ref={(el) => { faceRefs.current[slot][f] = el; }}
                className="cs-face"
                data-top={f === 0 ? 'true' : 'false'}
                style={f > 0 ? { clipPath: 'inset(0 0 100% 0)', pointerEvents: 'none', visibility: 'hidden' } : undefined}
              >
                <ProjectPanel projKey={cat.projects[slot]} eager={f === 0} />
              </div>
            ))}
            <span ref={(el) => { scanRefs.current[slot] = el; }} className="cs-scan" aria-hidden="true" />
          </div>
        ))}
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
        <div className="cs-scroll-cue">Scroll to explore</div>
      </div>
    </section>
  );
}
