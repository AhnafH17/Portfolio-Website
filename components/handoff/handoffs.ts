import {
  anchorPoint, getAnchor, bell, clamp01, easeInOut, lerp, seeded, smooth, topProgress,
  type Handoff, type HandoffEnv,
} from '@/lib/handoff';

/* Section handoffs, one visual style each, all in the palette's accent
   colour (see lib/handoff.ts for how they run). */

type Pt = [number, number];
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);

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

export const HANDOFFS: Handoff[] = [impactsToTestimonials, testimonialsToContact] as Handoff[];
export type { HandoffEnv };
