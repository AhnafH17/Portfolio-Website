'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { coreHandoff } from '@/lib/coreHandoff';

gsap.registerPlugin(ScrollTrigger);

/* Pinned "Impacts" scene. On the way in, the glowing core cube lifts off the
   About section's 3D island and flies down into the middle of this section;
   once it pins, the cube charges up and bursts, the title comes out of it and
   the galaxy unfurls, then stars shoot out of the title on curved paths,
   settle around the section and each reveal one real result. Title, stars and
   results are HTML (readable by search engines and screen readers); only the
   background stars and the light trails are drawn on a single 2D canvas.
   Everything is a pure function of the scroll position, so it all runs
   backwards cleanly too: scrolling up puts the cube back on its platform. */

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

// The cube's flight, as fractions of the section's way up the screen (0 =
// its top at the bottom of the screen, 1 = pinned).
const DETACH = 0.1;       // the 3D cube rises off its platform until here, then the DOM copy takes over
const LAND = 0.9;         // ...and it has reached the middle by here

// Timing inside the pin, as fractions of the pinned scroll.
// At a 900px screen the pin is ~1575px: ~3 wheel notches for the cube's
// burst and the title, ~6 for the star flights, then ~5 more where the
// results slowly grow.
const PIN_LENGTH = '+=175%';
const CHARGE_END = 0.08;  // the cube spins up and brightens
const BURST = 0.07;       // ...then flies apart
const BURST_LEN = 0.12;
const TITLE_IN = 0.11;    // "Impacts" grows out of the burst
const TITLE_LEN = 0.11;
const GALAXY_LEN = 0.16;  // the galaxy unfurls from the burst
const LAUNCH = 0.23;      // first star leaves
const TRAVEL = 0.24;      // each star's flight
const STAGGER = 0.012;
const LABEL_FADE = 0.05;
const GROW_START = 0.67;  // every result is in by here; from now on they grow
const GROW_BY = 0.14;     // total growth by the end of the pin (14%)
const GROW_BY_MOBILE = 0.06; // phones: two near-full-width columns leave less room

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* The travelling cube: a CSS 3D copy of the model's core cube (lit glass
   faces with glowing edges, a thin light column and a bright spark inside),
   plus a glow behind it and a shockwave ring for the burst. Built on <body>
   so it can cross from the About section into this one. Faces are 100px; it
   is scaled to size. Each face gets its own glass tint: the top catches the
   most light, as on the model. */
const CUBE_FACES: [string, number][] = [
  ['rotateY(0deg)', 0.2], ['rotateY(180deg)', 0.1], ['rotateY(90deg)', 0.24],
  ['rotateY(-90deg)', 0.1], ['rotateX(90deg)', 0.36], ['rotateX(-90deg)', 0.06],
];
function buildCube() {
  const wrap = document.createElement('div');
  wrap.className = 'im-cube-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<div class="im-cube-glow"></div><div class="im-cube-ring"></div><div class="im-cube">' +
    CUBE_FACES.map(([f, a]) => `<i class="im-cube-face" style="--f:${f};--fa:${a}"></i>`).join('') +
    '<i class="im-cube-core" style="--f:rotateY(0deg)"></i><i class="im-cube-core" style="--f:rotateY(90deg)"></i>' +
    '</div><div class="im-cube-spark"></div>';
  document.body.appendChild(wrap);
  return {
    wrap,
    glow: wrap.children[0] as HTMLElement,
    ring: wrap.children[1] as HTMLElement,
    cube: wrap.children[2] as HTMLElement,
    spark: wrap.children[3] as HTMLElement,
  };
}
// How the model shows the cube (see about/WorkspaceCanvas: the camera looks
// down ~29 degrees, and at rest the cube's left face is ~51 degrees off the
// line of sight), so the copy lines up with the 3D cube when they swap.
const CUBE_TILT = -29.4;
const CUBE_YAW = -51;

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
  const stageRef = useRef<HTMLDivElement>(null);
  const nebulaRef = useRef<HTMLDivElement>(null);
  const starRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const progressRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const title = titleRef.current;
    const stage = stageRef.current;
    const nebula = nebulaRef.current;
    const ctx = canvas?.getContext('2d');
    if (!section || !canvas || !title || !stage || !nebula || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Phones get a lighter sky and galaxy.
    const phone = window.matchMedia('(max-width: 768px)').matches;
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
    const sky = Array.from({ length: phone ? 200 : 320 }, () => ({
      x: rand() * 2 - 1, y: rand() * 2 - 1, z: 0.05 + rand() * 0.95,
      r: 0.6 + rand() * 1.2, a: 0.35 + rand() * 0.6,
      tw: 0.6 + rand() * 1.8, ph: rand() * Math.PI * 2,
      warm: rand() > 0.7,
      px: NaN, py: NaN,
    }));

    // Spiral galaxy behind the title: three arms of particles in polar form
    // (radius 0..1, angle), bucketed by colour so each bucket is one fillStyle.
    const galaxy: { r: number; a: number; s: number; alpha: number }[][] = [[], [], []]; // core, cool, warm
    for (let i = 0; i < (phone ? 950 : 1500); i++) {
      const r = Math.pow(rand(), 0.75);
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const scatter = (rand() - 0.5) * (0.9 * (1 - r) + 0.25);
      const bucket = r < 0.22 ? 0 : rand() > 0.35 ? 1 : 2;
      galaxy[bucket].push({ r, a: arm + r * 3.4 + scatter, s: rand() < 0.12 ? 2.4 : 1.5, alpha: (0.45 + rand() * 0.55) * (1 - r * 0.45) });
    }

    let geo: Geo | null = null;
    let dpr = 1;
    let growBy = GROW_BY;

    // The canvas covers the whole section; everything is laid out in the
    // stage, which on phones is the part of the screen that stays visible
    // with the browser's toolbars showing (the section itself is as tall as
    // the screen with them hidden, so collapsing them never uncovers a gap).
    let canvasH = 0;
    const measure = () => {
      const w = section.offsetWidth;
      canvasH = section.offsetHeight;
      const h = stage.offsetHeight;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(canvasH * dpr);
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
      const tt = easeOut(clamp01((p - TITLE_IN) / TITLE_LEN));
      title.style.opacity = String(tt);
      title.style.transform = `translate(-50%, -50%) scale(${(0.3 + 0.7 * tt) * (1 - 0.06 * clamp01((p - LAUNCH) / 0.25))})`;
      nebula.style.opacity = String(easeOut(clamp01((p - TITLE_IN) / GALAXY_LEN)));

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
      ctx.clearRect(0, 0, g.w, canvasH);
      // The galaxy, and the sky's full brightness, arrive with the burst.
      const unfurl = easeOut(clamp01((p - TITLE_IN) / GALAXY_LEN));
      const burstKick = Math.sin(Math.PI * clamp01((p - BURST) / (GALAXY_LEN + 0.04)));
      const t = time / 1000;
      const dt = prevTime ? Math.min(0.05, (time - prevTime) / 1000) : 0;
      prevTime = time;

      const scrollVel = dt > 0 ? (p - prevDrawP) / dt : 0;
      prevDrawP = p;
      // Scrolling through the burst throws the camera forward much harder: a
      // short jump to warp as the space opens up.
      const gain = SCROLL_GAIN * (1 + 2.5 * burstKick);
      const target = reduceMotion ? 0 : Math.max(-MAX_SPEED * 1.6, Math.min(MAX_SPEED * 1.6, IDLE_SPEED + scrollVel * gain));
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
        const alpha = s.a * tw * depthFade * (0.4 + 0.6 * unfurl);
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

      // Spiral galaxy behind the title: turns and swells with scroll (plus a
      // slow idle drift), tilted like a disc seen at an angle. It unwinds out
      // of the burst, growing from a point while shedding an extra twist.
      const gAlpha = unfurl;
      const R = Math.max(1, Math.min(g.w, g.h) * 0.46 * (0.8 + 0.4 * p) * (0.08 + 0.92 * unfurl));
      const spin = p * 2.2 + (1 - unfurl) * 2.4 + (reduceMotion ? 0 : t * 0.03);
      const tiltY = 0.42, tiltRot = -0.32;
      const cosT = Math.cos(tiltRot), sinT = Math.sin(tiltRot);
      const core = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, R * 0.55);
      core.addColorStop(0, `rgba(${accent},${0.5 * gAlpha})`);
      core.addColorStop(0.45, `rgba(${accent},${0.18 * gAlpha})`);
      core.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = core;
      ctx.fillRect(g.cx - R, g.cy - R, R * 2, R * 2);
      const bucketColor = [`rgb(${accent})`, 'rgb(225,232,255)', 'rgb(255,214,160)'];
      if (unfurl > 0) galaxy.forEach((bucket, b) => {
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

    /* The travelling cube. `desc` is how far this section has come up the
       screen (0..1), `p` the pinned progress. Until DETACH the 3D cube rises
       off its platform; from there this copy takes over, starting exactly on
       top of it and easing into the middle while scaling up. Once pinned it
       charges (spins up, brightens) and bursts: the faces fly apart, a flash
       and a shockwave ring go out, and the title grows out of the light. */
    const cubeEls = reduceMotion ? null : buildCube();
    let cubeShown = false;
    const showCube = (on: boolean) => {
      if (!cubeEls || cubeShown === on) return;
      cubeEls.wrap.style.visibility = on ? 'visible' : 'hidden';
      cubeShown = on;
    };
    const releaseCube = () => {
      showCube(false);
      coreHandoff.detached = false;
      coreHandoff.lift = 0;
    };

    const applyCube = (time: number, desc: number, p: number, g: Geo, anchor: DOMRect | null) => {
      if (!cubeEls) return;
      coreHandoff.lift = easeInOut(clamp01(desc / DETACH));
      coreHandoff.detached = desc >= DETACH;
      const burst = clamp01((p - BURST) / BURST_LEN);
      if (desc < DETACH || burst >= 1) { showCube(false); return; }
      showCube(true);

      const targetEdge = Math.min(g.w, g.h) * (phone ? 0.2 : 0.13);
      // Start on the 3D cube (it keeps publishing its spot while hidden);
      // without the 3D scene, drop in from above instead.
      let sx = g.cx, sy = -targetEdge, se = targetEdge * 0.6, yaw = 0;
      if (anchor) {
        sx = anchor.left + coreHandoff.x;
        sy = anchor.top + coreHandoff.y;
        se = coreHandoff.edge;
        yaw = (coreHandoff.yaw * 180) / Math.PI;
      }
      const q = clamp01((desc - DETACH) / (LAND - DETACH));
      const w = 1 - (1 - q) * (1 - q);
      const t = time / 1000;
      const charge = clamp01(p / CHARGE_END);
      const b = easeOut(burst);
      const flash = Math.sin(Math.PI * burst);

      // Bob gently once free, so it never sits dead still.
      const x = lerp(sx, g.cx, w);
      const y = lerp(sy, g.cy, w) + Math.sin(t * 1.3) * 5 * w * (1 - charge);
      const edge = lerp(se, targetEdge, w);
      const rotY = CUBE_YAW + yaw * (1 - w) + 90 * easeInOut(q) + Math.sin(t * 0.8) * 7 * w + 360 * charge * charge + 90 * b;
      const rotX = CUBE_TILT - 6 * w + Math.sin(t * 0.6) * 3 * w;

      cubeEls.wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      cubeEls.wrap.style.opacity = anchor ? '1' : String(q);
      const scale = (edge / 100) * (1 + 0.12 * charge + 0.3 * b);
      cubeEls.cube.style.transform = `scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      cubeEls.cube.style.setProperty('--b', b.toFixed(3));
      cubeEls.spark.style.transform = `scale(${scale * (1 + 0.8 * charge + 2 * flash)})`;
      cubeEls.spark.style.opacity = String(1 - b);
      // A bright pop as it comes off the platform hides the swap, then a
      // steady glow that swells as it charges and flares in the burst.
      const pop = 1 - clamp01(q / 0.12);
      cubeEls.glow.style.opacity = String(Math.min(1, 0.5 + 0.2 * w + 0.3 * charge + 0.5 * pop + flash) * (1 - burst * burst * burst));
      cubeEls.glow.style.transform = `scale(${((edge * 3.2) / 300) * (1 + 0.5 * charge + 3 * b)})`;
      cubeEls.ring.style.opacity = burst > 0 ? String(0.9 * (1 - burst)) : '0';
      cubeEls.ring.style.transform = `scale(${(edge / 100) * (0.6 + 7 * b)})`;
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    ro.observe(stage);

    // One loop does everything, only while the section is on screen.
    let raf: number | null = null;
    const loop = (time: number) => {
      const p = reduceMotion ? 1 : progressRef.current;
      if (geo) {
        // Layout reads first, then all the writes.
        const desc = clamp01(1 - section.getBoundingClientRect().top / geo.h);
        const c = coreHandoff.canvas;
        const anchor = cubeEls && desc >= DETACH && coreHandoff.ready && c?.isConnected ? c.getBoundingClientRect() : null;
        if (p !== lastP) { applyDom(p, geo); lastP = p; }
        draw(time, p, geo);
        applyCube(time, desc, p, geo, anchor);
      }
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
      else if (!entry.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; releaseCube(); }
    });
    io.observe(section);

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: PIN_LENGTH,
      pin: true,
      // Pin a touch early on fast touch scrolls, so it doesn't jump into place.
      anticipatePin: 1,
      scrub: 0.5,
      onUpdate: (self) => { progressRef.current = self.progress; },
      onRefresh: (self) => { progressRef.current = self.progress; measure(); },
    });

    return () => {
      st.kill();
      io.disconnect();
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
      releaseCube();
      cubeEls?.wrap.remove();
    };
  }, []);

  return (
    <section ref={sectionRef} id="impact" className="im-section" aria-labelledby="im-title">
      <div ref={nebulaRef} className="im-nebula" aria-hidden="true" />
      <canvas ref={canvasRef} className="im-canvas" aria-hidden="true" />
      <div ref={stageRef} className="im-stage">
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
      </div>
    </section>
  );
}
