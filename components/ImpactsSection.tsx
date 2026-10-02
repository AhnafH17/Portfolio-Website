'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Pinned "Impacts" scene: the title rises into the centre, then stars shoot
   out of it on curved paths, settle around the section and each reveal one
   real result. Title, stars and results are HTML (readable by search engines
   and screen readers); only the background stars and the light trails are
   drawn on a single 2D canvas. Everything is a pure function of the scroll
   progress, so it runs backwards cleanly too. */

type Side = 'r' | 'l' | 'b';

interface Impact {
  big: string;
  text: string;
  src: string;
  /** Desktop resting spot: x%, y% of the section, and which side the text sits on. */
  at: [number, number, Side];
  /** Phone resting spot (text always sits below the star). */
  atMobile: [number, number];
}

// Every figure is real: project Results in lib/projects.ts, Search Console
// (LeadCraft IT: 101 clicks, 14.8% CTR in its first 7 weeks; Vista
// Preservation: 56 clicks), and the Client Dashboard / Therapy Matching /
// email-automation repos. Kept short so each fits two lines on a phone.
const IMPACTS: Impact[] = [
  { big: '582K', text: 'search impressions in six months', src: 'CPC Clinics', at: [12, 15, 'r'], atMobile: [25, 9] },
  { big: '14.8%', text: 'search click-through, about 5× the norm', src: 'LeadCraft IT', at: [37, 12, 'r'], atMobile: [75, 9] },
  { big: '10.9K', text: 'contacts sorted into 9 business sectors', src: 'Segmentation Engine', at: [61, 15, 'r'], atMobile: [25, 21] },
  { big: '66 → 1', text: 'services narrowed to one therapist from a sentence', src: 'Therapy Matching', at: [88, 16, 'b'], atMobile: [75, 21] },
  { big: '0', text: 'manual reports: live dashboards sync 4 platforms', src: 'Client Dashboard', at: [90.5, 47, 'b'], atMobile: [25, 33] },
  { big: '$220', text: 'saved monthly on tooling, used daily by 11 people', src: 'Mission Control', at: [89, 71, 'l'], atMobile: [75, 33] },
  { big: '3 min', text: 'to a personal follow-up on every quote; replies are up', src: 'Email Automation', at: [89, 88, 'l'], atMobile: [25, 64] },
  { big: '95+', text: 'SEO score on every site I’ve led', src: 'CPC · Merch Express · AurixLab', at: [52, 85, 'r'], atMobile: [75, 64] },
  { big: '157', text: 'search clicks within weeks of launch', src: 'LeadCraft IT · Vista Preservation', at: [31, 87, 'r'], atMobile: [25, 76] },
  { big: '40+', text: 'pages designed and built from scratch', src: 'CPC Clinics', at: [12, 72, 'r'], atMobile: [75, 76] },
  { big: '18', text: 'collection pages rebuilt, at a 95+ load speed', src: 'Merch Express rebrand', at: [9.5, 46, 'b'], atMobile: [25, 88] },
  { big: 'Head of Dev', text: 'from technical specialist to leading the team', src: 'AurixLab', at: [14, 32, 'r'], atMobile: [75, 88] },
];

// Order the stars leave the word in — mixed so they don't fan out in a ring.
const LAUNCH_ORDER = [3, 0, 8, 5, 10, 2, 7, 11, 1, 6, 9, 4];

// Timing, as fractions of the pinned scroll.
// At a 900px screen the pin is ~1800px: ~2 wheel notches for the title,
// ~7 for the star flights, then ~7 more where the results slowly grow.
const PIN_LENGTH = '+=200%';
const TITLE_END = 0.1;    // "Impacts" finishes rising
const LAUNCH = 0.11;      // first star leaves
const TRAVEL = 0.26;      // each star's flight
const STAGGER = 0.016;
const LABEL_FADE = 0.05;
const GROW_START = 0.6;   // every result is in by here; from now on they grow
const GROW_BY = 0.14;     // total growth by the end of the pin (14%)
const GROW_BY_MOBILE = 0.06; // phones: two near-full-width columns leave less room

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Geo {
  w: number; h: number; cx: number; cy: number;
  from: { x: number; y: number }[];
  to: { x: number; y: number }[];
  ctrl: { x: number; y: number }[];
}

function starTiming(i: number) {
  const start = LAUNCH + LAUNCH_ORDER.indexOf(i) * STAGGER;
  return { start, arrive: start + TRAVEL };
}

function bezier(g: Geo, i: number, t: number) {
  const a = g.from[i], c = g.ctrl[i], b = g.to[i];
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

export default function ImpactsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const starRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const progressRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const title = titleRef.current;
    const ctx = canvas?.getContext('2d');
    if (!section || !canvas || !title || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '201,168,76';

    // Seeded background stars (same sky every visit), in -1..1 around centre.
    let seed = 0x1a2b3c;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Warp starfield: real 3D points (x, y in -1..1, depth z in 0..1, 1 =
    // far). Scrolling moves the camera through them; each star's trail is the
    // line from last frame's projected position to this one, so a streak is
    // always actual motion, never a stretched static dot.
    const sky = Array.from({ length: 320 }, () => ({
      x: rand() * 2 - 1, y: rand() * 2 - 1, z: 0.05 + rand() * 0.95,
      r: 0.6 + rand() * 1.2, a: 0.35 + rand() * 0.6,
      tw: 0.6 + rand() * 1.8, ph: rand() * Math.PI * 2,
      warm: rand() > 0.7,
      px: NaN, py: NaN,
    }));

    // Spiral galaxy behind the title: three arms of particles in polar form
    // (radius 0..1, angle), bucketed by colour so each bucket is one fillStyle.
    const galaxy: { r: number; a: number; s: number; alpha: number }[][] = [[], [], []]; // core, cool, warm
    for (let i = 0; i < 1500; i++) {
      const r = Math.pow(rand(), 0.75);
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const scatter = (rand() - 0.5) * (0.9 * (1 - r) + 0.25);
      const bucket = r < 0.22 ? 0 : rand() > 0.35 ? 1 : 2;
      galaxy[bucket].push({ r, a: arm + r * 3.4 + scatter, s: rand() < 0.12 ? 2.4 : 1.5, alpha: (0.45 + rand() * 0.55) * (1 - r * 0.45) });
    }

    let geo: Geo | null = null;
    let dpr = 1;
    let growBy = GROW_BY;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      growBy = mobile ? GROW_BY_MOBILE : GROW_BY;
      const cx = w / 2, cy = h / 2;
      const titleW = title.offsetWidth;

      const to = IMPACTS.map((im) => {
        const [x, y] = mobile ? im.atMobile : im.at;
        return { x: (x / 100) * w, y: (y / 100) * h };
      });
      // Each star leaves from the part of the word nearest where it lands.
      const from = to.map((b) => ({ x: cx + Math.max(-1, Math.min(1, (b.x - cx) / (w / 2))) * titleW * 0.42, y: cy }));
      // Curve each flight to one side, alternating, so the paths arc outward.
      const ctrl = to.map((b, i) => {
        const a = from[i];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const bend = (i % 2 ? 1 : -1) * len * 0.22;
        return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
      });
      geo = { w, h, cx, cy, from, to, ctrl };

      // Results sit at their star's resting spot; only their fade-in moves per frame.
      IMPACTS.forEach((im, i) => {
        const el = itemRefs.current[i];
        if (!el) return;
        el.style.left = `${to[i].x}px`;
        el.style.top = `${to[i].y}px`;
        el.dataset.side = mobile ? 'b' : im.at[2];
      });
      lastP = -1; // force a repaint of the DOM state
    };

    let lastP = -1;
    const applyDom = (p: number, g: Geo) => {
      const tt = easeOut(clamp01(p / TITLE_END));
      title.style.opacity = String(tt);
      title.style.transform = `translate(-50%, -50%) translateY(${(1 - tt) * 70}px) scale(${1 - 0.06 * clamp01((p - LAUNCH) / 0.25)})`;

      const grow = 1 + growBy * clamp01((p - GROW_START) / (1 - GROW_START));
      IMPACTS.forEach((_, i) => {
        const { start, arrive } = starTiming(i);
        const t = clamp01((p - start) / TRAVEL);
        const star = starRefs.current[i];
        if (star) {
          const pos = bezier(g, i, easeOut(t));
          star.style.opacity = t > 0 ? String(Math.min(1, t * 6)) : '0';
          star.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${0.4 + 0.6 * t})`;
          star.classList.toggle('is-landed', t >= 1);
        }
        const item = itemRefs.current[i];
        if (item) {
          const lt = easeOut(clamp01((p - arrive + 0.02) / LABEL_FADE));
          item.style.opacity = String(lt);
          item.style.setProperty('--rise', `${(1 - lt) * 10}px`);
          item.style.setProperty('--grow', String(grow));
          item.style.pointerEvents = lt > 0.5 ? 'auto' : 'none';
        }
      });
    };

    // Camera speed through the starfield, eased so it builds and coasts
    // rather than jumping with every wheel tick. Signed: scrolling back up
    // flies backwards.
    let camSpeed = 0;
    let prevDrawP = 0;
    let prevTime = 0;
    const IDLE_SPEED = 0.035;   // depth units/sec — a gentle drift when still
    const SCROLL_GAIN = 7;      // depth units/sec per (progress/sec) of scrolling
    const MAX_SPEED = 2.4;

    const draw = (time: number, p: number, g: Geo) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, g.w, g.h);
      const t = time / 1000;
      const dt = prevTime ? Math.min(0.05, (time - prevTime) / 1000) : 0;
      prevTime = time;

      const scrollVel = dt > 0 ? (p - prevDrawP) / dt : 0;
      prevDrawP = p;
      const target = reduceMotion ? 0 : Math.max(-MAX_SPEED, Math.min(MAX_SPEED, IDLE_SPEED + scrollVel * SCROLL_GAIN));
      camSpeed += (target - camSpeed) * (1 - Math.exp(-dt / 0.25));

      // Focal length so a star at the far plane (z = 1) sits at its x/y share
      // of the half-screen — the field fills the view evenly at depth.
      const fl = Math.max(g.w, g.h) * 0.5;
      for (const s of sky) {
        s.z -= camSpeed * dt;
        // Wrap through the far/near planes. Alpha is 0 at both ends (below),
        // so a wrapped star never pops; its trail restarts from scratch.
        if (s.z <= 0.03) { s.z += 0.97; s.px = NaN; }
        else if (s.z > 1) { s.z -= 0.97; s.px = NaN; }

        const x = g.cx + (s.x * fl) / (s.z * 2.2);
        const y = g.cy + (s.y * fl) / (s.z * 2.2);
        const depthFade = Math.min(1, (1 - s.z) * 3) * Math.min(1, s.z * 10);
        const tw = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(t * s.tw + s.ph);
        const alpha = s.a * tw * depthFade;
        const size = s.r * (0.8 + (1 - s.z) * 1.2);
        const color = s.warm ? `rgba(255,220,170,${alpha})` : `rgba(235,240,255,${alpha})`;

        const moved = Number.isNaN(s.px) ? 0 : Math.hypot(x - s.px, y - s.py);
        if (moved < 1.2 || moved > g.w * 0.5) {
          ctx.fillStyle = color;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          // Trail = ~3 frames of this star's real motion, pointing back along
          // the way it came.
          ctx.beginPath();
          ctx.moveTo(x + (s.px - x) * 3, y + (s.py - y) * 3);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        s.px = x;
        s.py = y;
      }

      // Spiral galaxy behind the title — turns and swells with scroll (plus a
      // slow idle drift), tilted like a disc seen at an angle.
      const titleIn = clamp01(p / TITLE_END);
      const gAlpha = 0.6 + 0.4 * titleIn;
      const R = Math.min(g.w, g.h) * 0.46 * (0.8 + 0.4 * p);
      const spin = p * 2.2 + (reduceMotion ? 0 : t * 0.03);
      const tiltY = 0.42, tiltRot = -0.32;
      const cosT = Math.cos(tiltRot), sinT = Math.sin(tiltRot);
      const core = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, R * 0.55);
      core.addColorStop(0, `rgba(${accent},${0.5 * gAlpha})`);
      core.addColorStop(0.45, `rgba(${accent},${0.18 * gAlpha})`);
      core.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = core;
      ctx.fillRect(g.cx - R, g.cy - R, R * 2, R * 2);
      const bucketColor = [`rgb(${accent})`, 'rgb(225,232,255)', 'rgb(255,214,160)'];
      galaxy.forEach((bucket, b) => {
        ctx.fillStyle = bucketColor[b];
        for (const s of bucket) {
          const ang = s.a + spin;
          const lx = Math.cos(ang) * s.r * R;
          const ly = Math.sin(ang) * s.r * R * tiltY;
          ctx.globalAlpha = s.alpha * gAlpha;
          ctx.fillRect(g.cx + lx * cosT - ly * sinT, g.cy + lx * sinT + ly * cosT, s.s, s.s);
        }
      });
      ctx.globalAlpha = 1;

      // Faint constellation joining the landed stars, once all are home.
      const lastArrive = Math.max(...IMPACTS.map((_, i) => starTiming(i).arrive));
      const joined = clamp01((p - lastArrive) / 0.08);
      if (joined > 0) {
        ctx.strokeStyle = `rgba(${accent},${0.14 * joined})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        g.to.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.stroke();
      }

      // Light trails: a comet tail while flying, a faint thread once landed.
      IMPACTS.forEach((_, i) => {
        const { start } = starTiming(i);
        const raw = clamp01((p - start) / TRAVEL);
        if (raw <= 0) return;
        const head = easeOut(raw);
        const tail = raw < 1 ? Math.max(0, head - 0.35) : 0;
        const steps = 18;
        const flying = raw < 1;
        let prev = bezier(g, i, tail);
        for (let k = 1; k <= steps; k++) {
          const s = tail + ((head - tail) * k) / steps;
          const pt = bezier(g, i, s);
          const along = k / steps; // 0 at the tail, 1 at the head
          if (flying) {
            // Soft wide glow under a bright core line.
            ctx.strokeStyle = `rgba(${accent},${0.22 * along * along})`;
            ctx.lineWidth = 3 + 6 * along;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
          }
          ctx.strokeStyle = flying ? `rgba(255,255,255,${0.9 * along * along})` : `rgba(${accent},0.12)`;
          ctx.lineWidth = flying ? 0.8 + 2.4 * along : 1;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          prev = pt;
        }
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(section);

    // One loop does everything, only while the section is on screen.
    let raf: number | null = null;
    const loop = (time: number) => {
      const p = reduceMotion ? 1 : progressRef.current;
      if (geo) {
        if (p !== lastP) { applyDom(p, geo); lastP = p; }
        draw(time, p, geo);
      }
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
      else if (!entry.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    });
    io.observe(section);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: PIN_LENGTH,
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => { progressRef.current = self.progress; },
      onRefresh: (self) => { progressRef.current = self.progress; measure(); },
    });

    return () => {
      st.kill();
      io.disconnect();
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={sectionRef} id="impact" className="im-section" aria-labelledby="im-title">
      <div className="im-nebula" aria-hidden="true" />
      <canvas ref={canvasRef} className="im-canvas" aria-hidden="true" />
      <h2 ref={titleRef} id="im-title" className="im-title">Impacts</h2>
      {IMPACTS.map((_, i) => (
        <span key={i} ref={(el) => { starRefs.current[i] = el; }} className="im-star" aria-hidden="true" />
      ))}
      <ul className="im-list">
        {IMPACTS.map((im, i) => (
          <li key={im.big} ref={(el) => { itemRefs.current[i] = el; }} className="im-item">
            <div className="im-item-inner">
              <strong className="im-big">{im.big}</strong>
              <span className="im-text">{im.text}</span>
              <span className="im-src">{im.src}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
