import {
  anchorPoint, getAnchor, bell, clamp01, easeInOut, lerp, seeded, smooth, topProgress,
  type Handoff, type HandoffEnv,
} from '@/lib/handoff';

/* The five section handoffs, one visual style each, all in the palette's
   accent colour (see lib/handoff.ts for how they run):
   1. Hero → Showcase      line art      the rings around the photo become the planet's horizon
   2. Showcase → Laptop    pixel art     the last panel dissolves into a pixel "AH" that lands on the lid emblem
   3. Laptop → About       isometric     a tile lifts off the laptop screen and lands on the island's desk
   4. Impacts → Testimonials  particles  the title's light streams down into the globe
   5. Testimonials → Contact  paper collage  a torn paper scrap folds into a plane and flies to "Send" */

type Pt = [number, number];
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);

/** Resample a dense polyline to n points evenly spaced along its length. */
function resample(dense: Pt[], n: number): Pt[] {
  const seg: number[] = [0];
  for (let i = 1; i < dense.length; i++) seg.push(seg[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = seg[seg.length - 1] || 1;
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (j < seg.length - 1 && seg[j] < d) j++;
    const a = dense[j - 1], b = dense[j];
    const f = (d - seg[j - 1]) / ((seg[j] - seg[j - 1]) || 1);
    out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
  }
  return out;
}

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, out: Pt[]) => {
  for (let i = 0; i <= 16; i++) {
    const a = lerp(a0, a1, i / 16);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
};

/** The hero ring outline (CSS border-radius 220 220 40 40, scaled down to
    fit like the browser does), from top centre, clockwise. */
function archPoints(r: DOMRect, n: number): Pt[] {
  const f = Math.min(1, r.width / 440);
  const rt = Math.min(220 * f, r.width / 2, r.height / 2);
  const rb = 40 * f;
  const { left: x, top: y, width: w, height: h } = r;
  const d: Pt[] = [[x + w / 2, y]];
  arc(x + w - rt, y + rt, rt, rt, -Math.PI / 2, 0, d);
  arc(x + w - rb, y + h - rb, rb, rb, 0, Math.PI / 2, d);
  arc(x + rb, y + h - rb, rb, rb, Math.PI / 2, Math.PI, d);
  arc(x + rt, y + rt, rt, rt, Math.PI, Math.PI * 1.5, d);
  return resample(d, n);
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n: number): Pt[] {
  const d: Pt[] = [];
  for (let i = 0; i <= 200; i++) {
    const a = -Math.PI / 2 + (i / 200) * Math.PI * 2;
    d.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return resample(d, n);
}

/* ── 1. Hero → Showcase: line art ─────────────────────────────────────── */
interface LineState { curves: { pts: Pt[]; alpha: number; dashed: boolean }[]; t: number; rings: HTMLElement[] }
const RING_SCALE = [1, 1.05, 1.1];
const RING_ALPHA = [0.95, 0.55, 0.32];
const heroToShowcase: Handoff<LineState> = {
  id: 'hero-showcase',
  usesCanvas: true,
  zone: () => [q('#hero'), q('.cs-section')],
  read(env) {
    const t = topProgress(q('.cs-section'), env.vh);
    const curve = q('.cs-horizon-curve');
    if (t === null || !curve || t <= 0.02 || t >= 1) return null;
    const rings = Array.from(document.querySelectorAll<HTMLElement>('.hero-ring')).filter((r) => r.offsetWidth > 0);
    const c = curve.getBoundingClientRect();
    const w = smooth(clamp01((t - 0.04) / 0.86));
    const fade = 1 - smooth(clamp01((t - 0.86) / 0.14));
    const N = 120;
    const curves = rings.map((ring, i) => {
      const from = archPoints(ring.getBoundingClientRect(), N);
      const k = RING_SCALE[i] ?? 1;
      const to = ellipsePoints(c.left + c.width / 2, c.top + c.height / 2, (c.width / 2) * k, (c.height / 2) * k, N);
      return {
        pts: from.map((p, j) => [lerp(p[0], to[j][0], w), lerp(p[1], to[j][1], w)] as Pt),
        alpha: (RING_ALPHA[i] ?? 0.3) * fade,
        dashed: i > 0,
      };
    });
    return { curves, t, rings };
  },
  write({ curves, t, rings }, { ctx, accent }) {
    // The real rings step aside while their line-art copies travel.
    rings.forEach((r) => { r.style.opacity = '0'; });
    ctx.lineJoin = 'round';
    for (const c of curves) {
      if (c.alpha <= 0.01) continue;
      ctx.beginPath();
      c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.setLineDash(c.dashed ? [12, 9] : []);
      ctx.lineDashOffset = -t * 420;
      ctx.strokeStyle = `rgba(${accent},${c.alpha * 0.22})`;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${accent},${c.alpha})`;
      ctx.lineWidth = c.dashed ? 1 : 1.6;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  },
  hide() {
    document.querySelectorAll<HTMLElement>('.hero-ring').forEach((r) => { r.style.opacity = ''; });
  },
};

/* ── 2. Showcase → Laptop: pixel art ──────────────────────────────────── */
// "AH" in 5x7 pixel letters with a one-pixel gap.
const GLYPH = [
  '.###..#...#',
  '#...#.#...#',
  '#...#.#...#',
  '#####.#####',
  '#...#.#...#',
  '#...#.#...#',
  '#...#.#...#',
];
const CELLS: Pt[] = [];
GLYPH.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === '#') CELLS.push([x, y]); }));
const GLYPH_W = GLYPH[0].length, GLYPH_H = GLYPH.length;
const PIX_START = (() => { const r = seeded(0xa11ce); return CELLS.map(() => [r(), r(), r()] as const); })();

interface PixState { cells: { x: number; y: number; s: number; light: boolean }[]; alpha: number; pulse: number }
const showcaseToLaptop: Handoff<PixState> = {
  id: 'showcase-laptop',
  usesCanvas: true,
  zone: () => [q('.cs-section'), q('.dv-section')],
  read(env) {
    const t = topProgress(q('.dv-section'), env.vh);
    const panel = q('.cs-slot[data-slot="2"]');
    if (t === null || !panel || t <= 0.01 || t >= 0.995) return null;
    const p = panel.getBoundingClientRect();
    const target = anchorPoint('device-emblem') ?? { x: env.vw / 2, y: env.vh * 0.72, size: 40 };
    const cell0 = Math.max(6, Math.min(22, p.width / 15));
    const cell1 = Math.max(2, target.size / GLYPH_W);
    // A: pixels gather from the panel into the glyph; B: the glyph falls to the emblem.
    const a = smooth(clamp01(t / 0.34));
    const b = easeInOut(clamp01((t - 0.3) / 0.7));
    const cell = lerp(cell0, cell1, b);
    const sx = p.left + p.width / 2, sy = p.top + p.height / 2;
    // Arc: up a little, then down onto the lid.
    const cx = lerp(sx, target.x, b), cy = lerp(sy, target.y, b) - Math.sin(Math.PI * b) * env.vh * 0.08;
    const gx = cx - (GLYPH_W * cell) / 2, gy = cy - (GLYPH_H * cell) / 2;
    const cells = CELLS.map(([x, y], i) => {
      const [rx, ry, rd] = PIX_START[i];
      const k = smooth(clamp01((a - rd * 0.35) / 0.65));
      const fx = p.left + rx * p.width, fy = p.top + ry * p.height;
      return { x: lerp(fx, gx + x * cell, k), y: lerp(fy, gy + y * cell, k), s: lerp(cell0 * 0.8, cell, k), light: y === 0 || x === 0 };
    });
    return { cells, alpha: clamp01(t / 0.06) * (1 - smooth(clamp01((t - 0.9) / 0.1))), pulse: bell((t - 0.78) / 0.22) };
  },
  write({ cells, alpha, pulse }, { ctx, accent }) {
    getAnchor('device-emblem').pulse = pulse;
    ctx.globalAlpha = alpha;
    for (const c of cells) {
      const s = Math.max(1, Math.round(c.s - 1));
      ctx.fillStyle = c.light ? `rgba(255,255,255,0.92)` : `rgb(${accent})`;
      ctx.fillRect(Math.round(c.x), Math.round(c.y), s, s);
    }
    ctx.globalAlpha = 1;
  },
  hide() { getAnchor('device-emblem').pulse = 0; },
};

/* ── 3. Laptop → About: isometric tile (desktop) ──────────────────────── */
let isoEl: HTMLElement | null = null;
interface IsoState { x: number; y: number; scale: number; rx: number; rz: number; alpha: number; w: number; h: number }
const laptopToAbout: Handoff<IsoState> = {
  id: 'laptop-about',
  usesCanvas: false,
  desktopOnly: true,
  zone: () => [q('.dv-section'), q('#about')],
  read(env) {
    const t = topProgress(q('#about'), env.vh, 1, 0.05);
    if (t === null || t <= 0.01 || t >= 0.995) return null;
    // Stale is fine: the laptop scene stops drawing once it scrolls away,
    // but its last published point still rides along with its canvas.
    const from = anchorPoint('device-screen', Infinity);
    const to = anchorPoint('about-desk', Infinity);
    if (!from) return null;
    const dst = to ?? { x: env.vw * 0.66, y: env.vh * 0.55, size: 60 };
    const k = easeInOut(t);
    const tilt = smooth(clamp01(t / 0.25));
    // A window-sized tile lifts off the screen (not the whole screen).
    const w = Math.min(240, Math.max(120, from.size * 0.28)), h = w * 0.64;
    const endScale = Math.max(0.35, Math.min(1, dst.size / w));
    return {
      x: lerp(from.x, dst.x, k),
      y: lerp(from.y, dst.y, k) - Math.sin(Math.PI * k) * env.vh * 0.12,
      scale: lerp(1, endScale, smooth(clamp01(t / 0.6))),
      rx: 58 * tilt, rz: -45 * tilt,
      alpha: clamp01(t / 0.06) * (1 - smooth(clamp01((t - 0.88) / 0.12))),
      w, h,
    };
  },
  write(s, { layer }) {
    if (!isoEl) {
      isoEl = document.createElement('div');
      isoEl.className = 'handoff-iso';
      isoEl.innerHTML = '<div class="iso-slab"><i class="iso-top"></i><i class="iso-front"></i><i class="iso-side"></i></div>';
      layer.appendChild(isoEl);
    }
    isoEl.style.display = 'block';
    isoEl.style.opacity = String(s.alpha);
    isoEl.style.transform = `translate3d(${s.x}px,${s.y}px,0)`;
    const slab = isoEl.firstElementChild as HTMLElement;
    slab.style.width = `${s.w}px`;
    slab.style.height = `${s.h}px`;
    slab.style.transform = `translate(-50%,-50%) scale(${s.scale}) rotateX(${s.rx}deg) rotateZ(${s.rz}deg)`;
  },
  hide() { if (isoEl) isoEl.style.display = 'none'; },
};

/* ── 4. Impacts → Testimonials: particles ─────────────────────────────── */
const SPARKS = (() => {
  const r = seeded(0x5ca1e);
  return Array.from({ length: 110 }, () => ({ ox: r(), oy: r() - 0.5, bend: r() - 0.5, delay: r() * 0.4, size: 1 + r() * 1.8 }));
})();
interface SparkState { pts: { x: number; y: number; px: number; py: number; s: number; a: number }[]; glow: number; gx: number; gy: number; gr: number }
const bez = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;
const impactsToTestimonials: Handoff<SparkState> = {
  id: 'impacts-testimonials',
  usesCanvas: true,
  zone: () => [q('#impact'), q('.ts-section')],
  read(env) {
    const t = topProgress(q('.ts-section'), env.vh, 1, 0.1);
    const title = q('#im-title'), globe = q('.ts-globe-clip');
    if (t === null || !title || !globe || t <= 0.01 || t >= 0.995) return null;
    const a = title.getBoundingClientRect(), g = globe.getBoundingClientRect();
    const gx = g.left + g.width / 2, gy = g.top + g.height / 2;
    const n = env.phone ? 40 : SPARKS.length;
    const pts = SPARKS.slice(0, n).map((sp) => {
      const sx = a.left + sp.ox * a.width, sy = a.top + a.height / 2 + sp.oy * a.height;
      const cx = (sx + gx) / 2 + sp.bend * env.vw * 0.5, cy = Math.min(sy, gy) - env.vh * 0.1;
      const u = easeInOut(clamp01((t - sp.delay) / 0.6));
      const u0 = Math.max(0, u - 0.06);
      return {
        x: bez(sx, cx, gx, u), y: bez(sy, cy, gy, u),
        px: bez(sx, cx, gx, u0), py: bez(sy, cy, gy, u0),
        s: sp.size * (1 - u * 0.5), a: clamp01(u * 8) * (1 - smooth(clamp01((u - 0.92) / 0.08))),
      };
    });
    return { pts, glow: bell((t - 0.6) / 0.4), gx, gy, gr: Math.min(g.width, g.height) * 0.08 };
  },
  write({ pts, glow, gx, gy, gr }, { ctx, accent }) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of pts) {
      if (p.a <= 0.01) continue;
      ctx.strokeStyle = `rgba(${accent},${0.55 * p.a})`;
      ctx.lineWidth = p.s;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.85 * p.a})`;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    if (glow > 0.01) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * (1 + glow));
      g.addColorStop(0, `rgba(255,255,255,${0.8 * glow})`);
      g.addColorStop(0.3, `rgba(${accent},${0.55 * glow})`);
      g.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr * 2, gy - gr * 2, gr * 4, gr * 4);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  hide() {},
};

/* ── 5. Testimonials → Contact: paper collage ─────────────────────────── */
// The same 8 points (clockwise from top-left) as a torn scrap and as a
// paper plane, so clip-path can morph between them.
const SCRAP: Pt[] = [[0, 0], [50, 3], [100, 0], [96, 52], [100, 100], [48, 97], [0, 100], [4, 48]];
const PLANE: Pt[] = [[0, 14], [52, 36], [100, 50], [100, 50], [100, 50], [52, 64], [0, 86], [16, 50]];
let paperEl: HTMLElement | null = null;
interface PaperState { x: number; y: number; w: number; h: number; rot: number; poly: string; fold: number; alpha: number; land: number; btn: HTMLElement }
const testimonialsToContact: Handoff<PaperState> = {
  id: 'testimonials-contact',
  usesCanvas: false,
  zone: () => [q('.ts-section'), q('#contact')],
  read(env) {
    const t = topProgress(q('#contact'), env.vh, 1, 0.2);
    const card = q('.ts-stack-card'), btn = q<HTMLElement>('.ct-submit');
    if (t === null || !card || !btn || t <= 0.01 || t >= 0.995) return null;
    const c = card.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const fold = smooth(clamp01(t / 0.3));
    const fly = easeInOut(clamp01((t - 0.22) / 0.78));
    const w = lerp(lerp(c.width, Math.min(150, c.width * 0.4), fold), 54, fly);
    const h = lerp(lerp(c.height, Math.min(100, c.width * 0.27), fold), 36, fly);
    const sx = c.left + c.width / 2, sy = c.top + c.height / 2;
    const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    const cx = lerp(sx, ex, 0.5) - env.vw * 0.18, cy = Math.min(sy, ey) - env.vh * 0.12;
    const x = bez(sx, cx, ex, fly), y = bez(sy, cy, ey, fly);
    const dx = 2 * (1 - fly) * (cx - sx) + 2 * fly * (ex - cx), dy = 2 * (1 - fly) * (cy - sy) + 2 * fly * (ey - cy);
    const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
    const poly = SCRAP.map((p, i) => `${lerp(p[0], PLANE[i][0], fold).toFixed(1)}% ${lerp(p[1], PLANE[i][1], fold).toFixed(1)}%`).join(',');
    return {
      x, y, w, h, poly, fold, btn,
      rot: lerp(-4, heading, smooth(clamp01((t - 0.2) / 0.2))),
      alpha: clamp01(t / 0.05) * (1 - smooth(clamp01((t - 0.9) / 0.1))),
      land: bell((t - 0.8) / 0.2),
    };
  },
  write(s, { layer }) {
    if (!paperEl) {
      paperEl = document.createElement('div');
      paperEl.className = 'handoff-paper';
      paperEl.innerHTML = '<i class="paper-tape"></i><i class="paper-fold"></i>';
      layer.appendChild(paperEl);
    }
    const el = paperEl;
    el.style.display = 'block';
    el.style.width = `${s.w}px`;
    el.style.height = `${s.h}px`;
    el.style.opacity = String(s.alpha);
    el.style.clipPath = `polygon(${s.poly})`;
    el.style.transform = `translate3d(${s.x - s.w / 2}px,${s.y - s.h / 2}px,0) rotate(${s.rot}deg)`;
    el.style.setProperty('--fold', s.fold.toFixed(3));
    s.btn.style.setProperty('--landed', s.land.toFixed(3));
  },
  hide() {
    if (paperEl) paperEl.style.display = 'none';
    q<HTMLElement>('.ct-submit')?.style.setProperty('--landed', '0');
  },
};

export const HANDOFFS: Handoff[] = [
  heroToShowcase, showcaseToLaptop, laptopToAbout, impactsToTestimonials, testimonialsToContact,
] as Handoff[];
export type { HandoffEnv };
