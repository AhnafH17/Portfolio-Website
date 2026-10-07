import {
  bell, clamp01, drawSprite, easeInOut, lerp, seeded, smooth, sprite, tintSprite, topProgress,
  type Handoff, type HandoffEnv,
} from '@/lib/handoff';
import { DOT_COUNT, globeState, projectDot } from '@/lib/globe';
import { deviceScreen } from '@/lib/deviceScreen';
import { BEATS } from '@/components/device/beats';
import { coreHandoff } from '@/lib/coreHandoff';

/* Section handoffs, one visual style each, all in the palette's accent
   colour (see lib/handoff.ts for how they run). */

const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const bez = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

/** The text's own box (a block element's rect is as wide as its container). */
function textRect(el: Element) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

/* ── Hero → Showcase: Y2K chrome. A drop of liquid chrome (a Blender-
   rendered loop, public/images/handoff/chrome-drop.webp) swells under the
   hero's photo arch, falls, and splashes onto the showcase's giant title,
   flooding the letters with chrome that then drains away. ── */
const CHROME = '/images/handoff/chrome-drop.webp';
const BEADS = (() => {
  const r = seeded(0xc0de);
  return Array.from({ length: 9 }, (_, i) => ({ vx: (i / 8 - 0.5) * 2.2 + (r() - 0.5) * 0.4, vy: 0.55 + r() * 0.7, s: 0.12 + r() * 0.16 }));
})();
interface ChromeState {
  title: HTMLElement; x: number; y: number; size: number; rot: number; sx: number; sy: number; alpha: number;
  ix: number; iy: number; splash: number; flood: number; drain: number; textL: number; textW: number; t: number;
}
const heroToShowcase: Handoff<ChromeState> = {
  id: 'hero-showcase',
  usesCanvas: true,
  zone: () => [q('#hero'), q('.cs-section')],
  read(env) {
    const t = topProgress(q('.cs-section'), env.vh, 1, 0);
    const frame = q('.hero-image-frame');
    const title = q<HTMLElement>('.cs-kinetic-track:not(.is-echo) .cs-kinetic-big');
    if (t === null || !frame || !title || t <= 0.005 || t >= 0.995) return null;
    sprite(CHROME, 24, 6);
    const fr = frame.getBoundingClientRect();
    const tr = textRect(title);
    const size = Math.min(230, Math.max(70, tr.height * 1.5));
    // Drip point: the bottom of the arch. Impact: on the letters' top edge.
    const dx = fr.left + fr.width / 2, dy = fr.bottom;
    const ix = tr.left + tr.width * 0.62, iy = tr.top + tr.height * 0.18;
    const form = smooth(clamp01(t / 0.2));
    const fall = clamp01((t - 0.2) / 0.4);
    const splash = clamp01((t - 0.6) / 0.2);
    let x: number, y: number, sx = 1, sy = 1, rot = 0, alpha = 1;
    if (fall <= 0) {
      // Swelling and stretching as it hangs from the arch.
      x = dx; y = dy + size * 0.5 * form;
      sy = 0.4 + 0.75 * form; sx = 0.6 + 0.35 * form;
    } else if (splash <= 0) {
      const g = fall * fall;
      x = lerp(dx, ix, easeInOut(fall)); y = lerp(dy + size * 0.5, iy - size * 0.32, g);
      const vx = (ix - dx) * (easeInOut(Math.min(1, fall + 0.02)) - easeInOut(fall));
      const vy = (iy - dy) * 0.04 * fall;
      rot = Math.atan2(vx, vy) * -0.6;
      sy = 1.05 + 0.4 * fall; sx = 1 / Math.sqrt(sy);
    } else {
      // Squash flat into the letters, then gone.
      const k = smooth(clamp01(splash / 0.45));
      x = ix; y = iy - size * 0.32 * (1 - k);
      sx = 1 + 1.5 * k; sy = Math.max(0.05, 1 - 0.9 * k); alpha = 1 - k;
    }
    return {
      title, x, y, size, rot, sx, sy, alpha, ix, iy, splash, t,
      flood: smooth(clamp01((t - 0.62) / 0.14)),
      drain: smooth(clamp01((t - 0.84) / 0.15)),
      textL: tr.left, textW: tr.width,
    };
  },
  write(st, { ctx, accent, time }) {
    const drop = sprite(CHROME, 24, 6);
    const f = time * 18;
    // A soft accent glow travels with the drop (its only colour: the chrome
    // itself stays silver).
    if (st.alpha > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.size * 0.9);
      g.addColorStop(0, `rgba(${accent},${0.32 * st.alpha})`);
      g.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(st.x - st.size, st.y - st.size, st.size * 2, st.size * 2);
      ctx.globalCompositeOperation = 'source-over';
      drawSprite(ctx, drop, f, st.x, st.y, st.size, st.rot, st.sx, st.sy, st.alpha);
    }
    if (st.splash > 0 && st.splash < 1) {
      // Beads thrown off the impact, and a ripple ring.
      const k = st.splash;
      for (const b of BEADS) {
        const bx = st.ix + b.vx * st.size * 1.4 * k;
        const by = st.iy - b.vy * st.size * 1.6 * k + st.size * 2.6 * k * k;
        drawSprite(ctx, drop, f + b.vx * 7, bx, by, st.size * b.s * (1 - 0.5 * k), 0, 1, 1, 1 - k);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(st.ix, st.iy, st.size * (0.4 + 2.4 * k), st.size * (0.1 + 0.45 * k), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(${accent},${0.7 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(st.ix, st.iy, st.size * (0.2 + 1.6 * k), st.size * (0.06 + 0.3 * k), 0, 0, Math.PI * 2); ctx.stroke();
    }
    // The chrome flood: spreads both ways from the impact across the
    // letters, shimmers, then drains off downward.
    const el = st.title.style;
    if (st.flood > 0 && st.drain < 1) {
      const ox = st.ix - st.textL;
      el.setProperty('--chrome-l', `${ox * (1 - st.flood)}px`);
      el.setProperty('--chrome-r', `${ox + (st.textW - ox) * st.flood}px`);
      el.setProperty('--chrome-top', `${st.drain * 100}%`);
      el.setProperty('--chrome-shift', `${(st.t * 260) % 100}%`);
      el.setProperty('--chrome-a', '1');
    } else {
      el.setProperty('--chrome-a', '0');
    }
  },
  hide() {
    q<HTMLElement>('.cs-kinetic-track:not(.is-echo) .cs-kinetic-big')?.style.setProperty('--chrome-a', '0');
  },
};

/** CSS matrix3d mapping a w x h box onto the quad q (TL, TR, BR, BL). */
function quadTransform(w: number, h: number, q: ArrayLike<number>) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = Array.from(q);
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-6;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${k / h},0,0,1,0,${x0},${y0},0,1)`;
}

/* ── Showcase → Laptop: glassmorphic. The AurixLab card lifts off the
   showcase and turns to frosted glass, floats in 3D while the laptop spins
   and opens, then dives onto the screen, matched to its exact perspective
   (the device publishes its screen corners, lib/deviceScreen.ts), just as
   the display wakes. ── */
let glassEl: HTMLDivElement | null = null;
let glassSrc: Element | null = null;
interface GlassState { face: HTMLElement; quad: number[]; w: number; h: number; frost: number; flash: number; alpha: number; sheen: number; hideSrc: boolean }
const glassBox = { w: 320, h: 300 };
const showcaseToLaptop: Handoff<GlassState> = {
  id: 'showcase-laptop',
  usesCanvas: false,
  zone: () => [q('.cs-section'), q('.dv-section')],
  read(env) {
    const dv = q('.dv-section');
    const face = document.querySelectorAll<HTMLElement>('.cs-slot[data-slot="2"] .cs-face')[2];
    if (!dv || !face) return null;
    const r = dv.getBoundingClientRect();
    const y = r.top / env.vh;
    const p = clamp01(-r.top / Math.max(1, r.height - env.vh));
    const wake = env.phone ? BEATS.wakePhone : BEATS.wake;
    const diveStart = wake[0], diveEnd = wake[0] + (wake[1] - wake[0]) * 0.55;
    const fadeEnd = diveEnd + (wake[1] - diveEnd) * 0.6;
    if (y > 1.3 || p >= fadeEnd) return null;
    const lift = smooth(clamp01((1.3 - y) / 0.75));
    const dive = easeInOut(clamp01((p - diveStart) / (diveEnd - diveStart)));
    const fade = smooth(clamp01((p - diveEnd) / (fadeEnd - diveEnd)));

    // Source: the card where it sits (its box size is the pane's own size).
    const fr = face.getBoundingClientRect();
    if (lift < 0.02 && fr.width > 0) { glassBox.w = fr.width; glassBox.h = fr.height; }
    const { w, h } = glassBox;
    const src = [fr.left, fr.top, fr.right, fr.top, fr.right, fr.bottom, fr.left, fr.bottom];

    // Hover: floating beside the device, turned towards it, bobbing.
    const t = env.time;
    const hw = (env.phone ? env.vw * 0.22 : Math.min(env.vw * 0.085, 210));
    const hh = hw * (h / w);
    const cx = env.phone ? env.vw * 0.5 : env.vw * 0.8, cy = (env.phone ? 0.2 : 0.3) * env.vh + Math.sin(t * 1.3) * 8;
    const yaw = -0.5 + Math.sin(t * 0.7) * 0.14, pitch = 0.14 + Math.sin(t * 0.9) * 0.05;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const P = 1000;
    const hover: number[] = [];
    for (const [ux, uy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = ux * hw, y0 = uy * hh;
      // yaw about the vertical axis, then pitch about the horizontal
      const x1 = x * cyw, z1 = -x * syw;
      const y1 = y0 * cp - z1 * sp, z2 = y0 * sp + z1 * cp;
      const s2 = P / (P + z2);
      hover.push(cx + x1 * s2, cy + y1 * s2);
    }

    // Destination: the live screen, if the device is publishing it.
    let dst = hover;
    if (deviceScreen.canvas && performance.now() - deviceScreen.at < 400) {
      const cr = deviceScreen.canvas.getBoundingClientRect();
      const dq = deviceScreen.quad;
      dst = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => dq[i] + (i % 2 ? cr.top : cr.left));
    }
    const quad = src.map((v, i) => lerp(lerp(v, hover[i], lift), dst[i], dive));
    return {
      face, quad, w, h,
      frost: smooth(clamp01(lift * 1.6)),
      flash: smooth(clamp01((dive - 0.6) / 0.4)) * (1 - fade),
      alpha: 1 - fade,
      sheen: (t * 0.35) % 1,
      hideSrc: lift > 0,
    };
  },
  write(st, { layer }) {
    if (!glassEl || glassEl.parentElement !== layer) {
      glassEl = document.createElement('div');
      glassEl.className = 'handoff-glass';
      glassEl.innerHTML = '<div class="handoff-glass-frost"></div><div class="handoff-glass-card"></div><i class="handoff-glass-sheen"></i><i class="handoff-glass-flash"></i>';
      layer.appendChild(glassEl);
      glassSrc = null;
    }
    // The pane starts as an exact copy of the card.
    const card = st.face.querySelector('.cs-card');
    if (card && glassSrc !== card) {
      const clone = card.cloneNode(true) as HTMLElement;
      clone.setAttribute('inert', '');
      clone.removeAttribute('href');
      glassEl.querySelector('.handoff-glass-card')!.replaceChildren(clone);
      glassSrc = card;
    }
    const gs = glassEl.style;
    gs.display = 'block';
    gs.width = `${st.w}px`; gs.height = `${st.h}px`;
    gs.transform = quadTransform(st.w, st.h, st.quad);
    gs.opacity = String(st.alpha);
    gs.setProperty('--frost', st.frost.toFixed(3));
    gs.setProperty('--flash', st.flash.toFixed(3));
    gs.setProperty('--sheen', `${(st.sheen * 300 - 150).toFixed(1)}%`);
    st.face.style.opacity = st.hideSrc ? '0' : '';
  },
  hide() {
    if (glassEl) glassEl.style.display = 'none';
    const face = document.querySelectorAll<HTMLElement>('.cs-slot[data-slot="2"] .cs-face')[2];
    if (face) face.style.opacity = '';
  },
};

/* ── Laptop → About: clay 3D. After `export default about;` the Return key
   pops off the laptop as a soft clay keycap (a Blender-rendered tumble,
   public/images/handoff/clay-key.webp, tinted to the palette), arcs out
   toward you, and lands on the About island's core cube with a squash,
   powering it up (the same cube then flies on into Impacts). ── */
const CLAY = '/images/handoff/clay-key.webp';
const keyAt = { x: 0, y: 0, w: 24, ok: false };
interface ClayState { x: number; y: number; size: number; frame: number; sx: number; sy: number; alpha: number; glow: number; ring: number; cx: number; cy: number; edge: number }
const laptopToAbout: Handoff<ClayState> = {
  id: 'laptop-about',
  usesCanvas: true,
  zone: () => [q('.dv-section'), q('#about')],
  read(env) {
    const about = q('#about');
    if (!about) return null;
    const ar = about.getBoundingClientRect();
    // Target: the core cube, as the About scene publishes it; until that
    // scene has drawn, where it will be.
    let cx: number, cy: number, edge: number;
    const cv = coreHandoff.canvas;
    if (cv && coreHandoff.ready) {
      const cr = cv.getBoundingClientRect();
      cx = cr.left + coreHandoff.x; cy = cr.top + coreHandoff.y; edge = Math.max(24, coreHandoff.edge);
    } else {
      const c = about.querySelector('canvas')?.getBoundingClientRect();
      cx = c ? c.left + c.width * 0.55 : ar.left + ar.width * 0.8;
      cy = c ? c.top + c.height * 0.7 : ar.top + env.vh * 0.73;
      edge = 40;
    }
    // From About's top entering, until the cube itself (low on the island,
    // and below the text on phones) is well up the screen.
    const from = env.vh * 1.35, to = env.vh * 0.62 - (cy - ar.top);
    const t = clamp01((from - ar.top) / Math.max(1, from - to));
    if (t <= 0.003 || t >= 0.997) return null;
    // Start: the Return key while the device is drawing (or the bottom of a
    // phone's screen), remembered in page coordinates for when it stops.
    const live = deviceScreen.canvas && performance.now() - deviceScreen.at < 400;
    if (live) {
      const dr = deviceScreen.canvas!.getBoundingClientRect();
      if (!env.phone) {
        keyAt.x = dr.left + deviceScreen.key[0]; keyAt.y = dr.top + deviceScreen.key[1] + window.scrollY; keyAt.w = Math.max(18, deviceScreen.key[2]);
      } else {
        const qd = deviceScreen.quad;
        keyAt.x = dr.left + (qd[4] + qd[6]) / 2; keyAt.y = dr.top + (qd[5] + qd[7]) / 2 - 40 + window.scrollY; keyAt.w = 30;
      }
      keyAt.ok = true;
    }
    if (!keyAt.ok) return null;
    const kx = keyAt.x, ky = keyAt.y - window.scrollY, kw = keyAt.w;
    sprite(CLAY, 24, 6);

    const pop = smooth(clamp01(t / 0.12));
    const fly = clamp01((t - 0.1) / 0.68);
    const land = clamp01((t - 0.78) / 0.1);
    const sink = smooth(clamp01((t - 0.88) / 0.1));
    const big = Math.min(env.vw * 0.12, 190);
    let x: number, y: number, size: number, sx = 1, sy = 1;
    if (fly <= 0) {
      // Rises straight up out of the keyboard, growing toward you.
      x = kx; y = ky - pop * kw * 1.4; size = lerp(kw * 0.9, kw * 2.2, pop);
    } else {
      const u = easeInOut(fly);
      const sx0 = kx, sy0 = ky - kw * 1.4;
      const ex = cx, ey = cy - edge * 0.6;
      // The arc's peak stays on screen even once the laptop has scrolled off.
      const mx = lerp(sx0, ex, 0.5) + env.vw * 0.08, my = Math.max(env.vh * 0.12, Math.min(sy0, ey) - env.vh * 0.18);
      x = bez(sx0, mx, ex, u); y = bez(sy0, my, ey, u);
      // Swells as it arcs toward the viewer, then settles to the cube's size.
      size = lerp(kw * 2.2, edge * 1.1, u) + bell(u) * big;
      // Stretch along the fall as it comes down.
      const s = 1 + 0.18 * Math.max(0, u - 0.5) * 2 * (1 - land);
      sy = s; sx = 1 / Math.sqrt(s);
    }
    if (land > 0) {
      // Clay squash on contact, a small rebound, then it sinks into the core.
      const sq = Math.sin(Math.PI * land) * (1 - land * 0.5);
      sx = 1 + 0.45 * sq; sy = 1 - 0.38 * sq;
      y += edge * 0.2 * sq;
    }
    size *= 1 - sink * 0.75;
    y += sink * edge * 0.5;
    coreHandoff.pulse = bell(clamp01((t - 0.8) / 0.2));
    return {
      x, y, size, sx, sy,
      // Two full tumbles in flight, landing on the frame that faces up.
      frame: Math.round(easeInOut(fly) * 48),
      alpha: clamp01(t / 0.04) * (1 - sink),
      glow: 0.25 + 0.5 * bell(fly) + coreHandoff.pulse * 0.6,
      ring: land > 0 ? clamp01((t - 0.8) / 0.17) : 0,
      cx, cy, edge,
    };
  },
  write(st, { ctx, accent }) {
    const key = sprite(CLAY, 24, 6);
    tintSprite(key, accent);
    if (st.ring > 0 && st.ring < 1) {
      ctx.strokeStyle = `rgba(${accent},${0.8 * (1 - st.ring)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(st.cx, st.cy, st.edge * (0.6 + 2.2 * st.ring), st.edge * (0.25 + 0.8 * st.ring), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.size * 0.95);
    g.addColorStop(0, `rgba(${accent},${0.35 * st.glow * st.alpha})`);
    g.addColorStop(1, `rgba(${accent},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(st.x - st.size, st.y - st.size, st.size * 2, st.size * 2);
    ctx.globalCompositeOperation = 'source-over';
    drawSprite(ctx, key, st.frame, st.x, st.y, st.size, 0, st.sx, st.sy, st.alpha);
  },
  hide() {
    coreHandoff.pulse = 0;
  },
};

/* ── Impacts → Testimonials: particles. The Impacts stars drain into a
   stream of light that assembles, dot by dot, into the testimonials' globe:
   each particle lands on exactly the dot the globe then draws there. ── */
const DOT_PLAN = (() => {
  const r = seeded(0x5ca1e);
  return Array.from({ length: DOT_COUNT }, () => ({ star: Math.floor(r() * 12), jx: r() - 0.5, jy: r() - 0.5, bend: r() - 0.5, delay: r() * 0.42 }));
})();
interface StreamState { pts: Float32Array; n: number; alpha: number; section: HTMLElement; drain: number }
const proj = new Float32Array(3);
const impactsToTestimonials: Handoff<StreamState> = {
  id: 'impacts-testimonials',
  usesCanvas: true,
  zone: () => [q('#impact'), q('.ts-section')],
  read(env) {
    const t = topProgress(q('.ts-section'), env.vh, 1, 0.12);
    const section = q<HTMLElement>('#impact');
    const g = globeState.canvas;
    if (t === null || !section || !g || t <= 0.01 || t >= 0.995) return null;
    const stars = Array.from(document.querySelectorAll('.im-star')).map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2] as const;
    });
    if (!stars.length) return null;
    const gr = g.getBoundingClientRect();
    // Phones fly every third dot; the globe fills in the rest as it fades up.
    const step = env.phone ? 3 : 1;
    const pts = new Float32Array(Math.ceil(DOT_COUNT / step) * 5);
    let n = 0;
    for (let i = 0; i < DOT_COUNT; i += step) {
      projectDot(i, proj);
      if (proj[2] <= 0.05) continue;
      const d = DOT_PLAN[i];
      const [sx0, sy0] = stars[d.star % stars.length];
      const sx = sx0 + d.jx * 18, sy = sy0 + d.jy * 18;
      const ex = gr.left + proj[0], ey = gr.top + proj[1];
      const cx = (sx + ex) / 2 + d.bend * env.vw * 0.35, cy = Math.min(sy, ey) - env.vh * 0.08;
      const u = easeInOut(clamp01((t - d.delay) / 0.5));
      const u0 = Math.max(0, u - 0.07);
      pts[n * 5] = bez(sx, cx, ex, u); pts[n * 5 + 1] = bez(sy, cy, ey, u);
      pts[n * 5 + 2] = bez(sx, cx, ex, u0); pts[n * 5 + 3] = bez(sy, cy, ey, u0);
      pts[n * 5 + 4] = proj[2] * clamp01(u * 6);
      n++;
    }
    // The real globe fades up under the particles as the last ones land.
    globeState.reveal = smooth(clamp01((t - 0.8) / 0.18));
    return { pts, n, alpha: 1 - smooth(clamp01((t - 0.9) / 0.1)), section, drain: smooth(clamp01(t / 0.55)) };
  },
  write({ pts, n, alpha, section, drain }, { ctx, accent }) {
    section.style.setProperty('--drain', drain.toFixed(3));
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const a = pts[k * 5 + 4] * alpha;
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(${accent},${0.5 * a})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(pts[k * 5 + 2], pts[k * 5 + 3]); ctx.lineTo(pts[k * 5], pts[k * 5 + 1]); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`;
      ctx.fillRect(pts[k * 5] - 0.9, pts[k * 5 + 1] - 0.9, 1.8, 1.8);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  hide() {
    globeState.reveal = 1;
    q<HTMLElement>('#impact')?.style.setProperty('--drain', '0');
  },
};

/* ── Testimonials → Contact: glitch transmission. The active testimonial
   card glitches apart into scanline slices (offset light and accent
   copies), the slices collapse into a data packet that streaks down to the
   contact console, and a scan frame sweeps the console as it lands. ── */
const SLICES = 14;
const GLITCH = (() => { const r = seeded(0x611c4); return Array.from({ length: SLICES }, () => [r() - 0.5, r(), r()] as const); })();
const BITS = (() => { const r = seeded(0xb175); return Array.from({ length: 26 }, () => [r(), r() - 0.5, 0.5 + r()] as const); })();
interface TxState {
  card: DOMRect; con: DOMRect; split: number; travel: number; land: number; alpha: number;
  section: HTMLElement; console: HTMLElement; sx: number; sy: number; cx: number; cy: number; ex: number; ey: number;
}
const testimonialsToContact: Handoff<TxState> = {
  id: 'testimonials-contact',
  usesCanvas: true,
  zone: () => [q('.ts-section'), q('#contact')],
  read(env) {
    const t = topProgress(q('#contact'), env.vh, 1, 0.2);
    const cardEl = q('.ts-stack-card'), conEl = q<HTMLElement>('.ct-console'), section = q<HTMLElement>('.ts-section');
    if (t === null || !cardEl || !conEl || !section || t <= 0.01 || t >= 0.995) return null;
    const card = cardEl.getBoundingClientRect(), con = conEl.getBoundingClientRect();
    const sx = card.left + card.width / 2, sy = card.top + card.height / 2;
    const ex = con.left + con.width * 0.5, ey = con.top + 18;
    return {
      card, con, section, console: conEl, sx, sy, ex, ey,
      cx: (sx + ex) / 2 + env.vw * 0.12, cy: Math.min(sy, ey) - env.vh * 0.06,
      split: smooth(clamp01(t / 0.32)),
      travel: easeInOut(clamp01((t - 0.24) / 0.6)),
      land: clamp01((t - 0.8) / 0.2),
      alpha: 1 - smooth(clamp01((t - 0.94) / 0.06)),
    };
  },
  write(s, { ctx, accent }) {
    s.section.style.setProperty('--dissolve', s.split.toFixed(3));
    s.console.style.setProperty('--landed', bell(s.land).toFixed(3));
    s.console.dataset.incoming = String(s.land > 0 && s.land < 1);
    ctx.globalAlpha = s.alpha;
    // A: the card glitching apart and collapsing to a line.
    if (s.split > 0 && s.travel < 0.35) {
      const k = 1 - clamp01(s.travel / 0.35);
      const h = s.card.height / SLICES;
      for (let i = 0; i < SLICES; i++) {
        const [jx, ja, jw] = GLITCH[i];
        const y0 = s.card.top + i * h;
        const y = lerp(y0, s.sy - h / 2, s.split);           // slices slide to the centre line
        const hh = Math.max(1, h * (1 - s.split * 0.85));
        const off = jx * 90 * Math.sin(Math.PI * s.split) * (0.4 + ja);
        const w = s.card.width * lerp(1, 0.35 + jw * 0.4, s.split);
        const x = s.sx - w / 2 + off;
        ctx.fillStyle = `rgba(10,12,16,${0.85 * k})`;
        ctx.fillRect(x, y, w, hh);
        ctx.fillStyle = `rgba(${accent},${0.55 * k})`;
        ctx.fillRect(x - 3, y, w, Math.max(1, hh * 0.18));
        ctx.fillStyle = `rgba(255,255,255,${0.35 * k})`;
        ctx.fillRect(x + 3, y + hh - Math.max(1, hh * 0.12), w, Math.max(1, hh * 0.12));
      }
    }
    // B: the data packet streaking down to the console, with a split trail.
    if (s.travel > 0 && s.travel < 1) {
      const at = (u: number) => [bez(s.sx, s.cx, s.ex, u), bez(s.sy, s.cy, s.ey, u)];
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const [dx, col, wdt] of [[-2, accent, 3], [2, '255,255,255', 1.6]] as const) {
        ctx.strokeStyle = `rgba(${col},0.8)`;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        for (let j = 0; j <= 16; j++) {
          const u = Math.max(0, s.travel - 0.22 + (0.22 * j) / 16);
          const [x, y] = at(u);
          if (j) ctx.lineTo(x + dx, y); else ctx.moveTo(x + dx, y);
        }
        ctx.stroke();
      }
      const [hx, hy] = at(s.travel);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, `rgba(${accent},0.7)`);
      g.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(hx - 26, hy - 26, 52, 52);
      // Data bits shedding off the packet.
      for (const [d, lat, sz] of BITS) {
        const u = Math.max(0, s.travel - d * 0.25);
        const [bx, by] = at(u);
        const a = (1 - d) * 0.9;
        ctx.fillStyle = `rgba(${accent},${a})`;
        ctx.fillRect(bx + lat * 40 * d, by + lat * 22 * d, 3 * sz, 3 * sz);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // C: a scan frame sweeping the console as the packet lands.
    if (s.land > 0) {
      const { con } = s;
      const y = con.top + con.height * s.land;
      ctx.strokeStyle = `rgba(${accent},${0.9 * (1 - s.land * 0.6)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(con.left - 6, con.top - 6, con.width + 12, con.height + 12);
      ctx.fillStyle = `rgba(${accent},${0.8 * (1 - s.land)})`;
      ctx.fillRect(con.left - 6, y, con.width + 12, 2);
    }
    ctx.globalAlpha = 1;
  },
  hide() {
    q<HTMLElement>('.ts-section')?.style.setProperty('--dissolve', '0');
    const c = q<HTMLElement>('.ct-console');
    if (c) { c.style.setProperty('--landed', '0'); c.dataset.incoming = 'false'; }
  },
};

export const HANDOFFS: Handoff[] = [heroToShowcase, showcaseToLaptop, laptopToAbout, impactsToTestimonials, testimonialsToContact] as Handoff[];
export type { HandoffEnv };
