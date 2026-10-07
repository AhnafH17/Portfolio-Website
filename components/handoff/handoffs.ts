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

export const HANDOFFS: Handoff[] = [impactsToTestimonials, testimonialsToContact] as Handoff[];
export type { HandoffEnv };
