import {
  bell, clamp01, easeInOut, lerp, seeded, smooth, topProgress,
  type Handoff, type HandoffEnv,
} from '@/lib/handoff';
import { DOT_COUNT, globeState, projectDot } from '@/lib/globe';

/* Section handoffs, one visual style each, all in the palette's accent
   colour (see lib/handoff.ts for how they run). */

const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const bez = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;


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
    // A share of the dots fly (every 3rd, every 6th on phones); the globe
    // fills in the rest as it fades up.
    const step = env.phone ? 6 : 3;
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
    ctx.lineWidth = 1.4;
    // Batched by brightness: one stroke and one fill per band rather than
    // one per particle (hundreds a frame on phones).
    const B = 8;
    const trails = Array.from({ length: B }, () => new Path2D());
    const heads = Array.from({ length: B }, () => new Path2D());
    for (let k = 0; k < n; k++) {
      const a = pts[k * 5 + 4] * alpha;
      if (a <= 0.01) continue;
      const b = Math.min(B - 1, Math.floor(a * B));
      trails[b].moveTo(pts[k * 5 + 2], pts[k * 5 + 3]); trails[b].lineTo(pts[k * 5], pts[k * 5 + 1]);
      heads[b].rect(pts[k * 5] - 0.9, pts[k * 5 + 1] - 0.9, 1.8, 1.8);
    }
    for (let b = 0; b < B; b++) {
      const a = (b + 0.5) / B;
      ctx.strokeStyle = `rgba(${accent},${(0.5 * a).toFixed(3)})`;
      ctx.stroke(trails[b]);
      ctx.fillStyle = `rgba(255,255,255,${(0.7 * a).toFixed(3)})`;
      ctx.fill(heads[b]);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  hide() {
    globeState.reveal = 1;
    q<HTMLElement>('#impact')?.style.setProperty('--drain', '0');
  },
};

/* ── Testimonials → Contact: transmission. The active testimonial card
   switches off like a CRT (squashes to a glowing line, then a point), the
   point streaks down as a data packet to the contact console (on phones,
   the contact heading), and a scan frame sweeps it as it lands. ── */
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
    const cardEl = q('.ts-stack-card'), conEl = q<HTMLElement>('.ct-console'), section = q<HTMLElement>('.ts-section');
    if (!cardEl || !conEl || !section) return null;
    const card = cardEl.getBoundingClientRect();
    // The landing: the console on desktop. On phones the console sits far
    // below the form, so the transmission lands on the "Let's build"
    // heading instead of streaking across the inputs.
    const target = (env.phone && q('.ct-heading')) || conEl;
    const con = target.getBoundingClientRect();
    // Starts only once the testimonial card itself scrolls up off the
    // screen (its top passing the top quarter), and lands as the target
    // reaches the upper part of the screen.
    const scrolled = env.vh * 0.25 - card.top;
    const dist = con.top + scrolled - env.vh * 0.32;
    const t = clamp01(scrolled / Math.max(1, dist));
    if (t <= 0.01 || t >= 0.995) return null;
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
    // A: the card switches off like an old CRT: it squashes vertically into
    // a glowing line, the line shrinks to a bright point, and that point
    // is the packet that leaves. (It used to split into offset glitch
    // slices, which read as a rendering bug when frozen in a screenshot.)
    if (s.split > 0 && s.travel < 0.35) {
      const k = 1 - clamp01(s.travel / 0.35);
      const squash = clamp01(s.split / 0.75), shrink = clamp01((s.split - 0.75) / 0.25);
      const e = squash * squash;
      const h = Math.max(2, lerp(s.card.height, 2, e));
      const w = Math.max(6, lerp(s.card.width, 6, shrink * shrink));
      const x = s.sx - w / 2, y = s.sy - h / 2;
      const cover = Math.min(1, s.split * 5) * k;
      // the screen going dark, edged in the accent
      ctx.fillStyle = `rgba(10,12,16,${0.92 * cover})`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(${accent},${0.55 * cover})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      // the bright line across its middle, gathering everything
      ctx.globalCompositeOperation = 'lighter';
      const line = Math.max(1.5, h * 0.08);
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, `rgba(${accent},0)`);
      g.addColorStop(0.5, `rgba(255,255,255,${0.9 * e * k})`);
      g.addColorStop(1, `rgba(${accent},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, s.sy - line / 2, w, line);
      ctx.fillStyle = `rgba(${accent},${0.35 * e * k})`;
      ctx.fillRect(x, s.sy - line * 3, w, line * 6);
      ctx.globalCompositeOperation = 'source-over';
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

export const HANDOFFS: Handoff[] = [impactsToTestimonials, testimonialsToContact] as Handoff[];
export type { HandoffEnv };
