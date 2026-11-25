/* The preloader's line drawing of the desk (no three.js, no React). The
   lines come from the real model (scripts/make-desk-outline.mjs writes
   public/models/desk-outline.json) and are projected with the hero camera
   (heroPose.ts), so each one sits on the pixels where that part of the 3D
   desk renders. Each part is its own small canvas, so the handover to the
   scene only changes opacity; the LED strip, screen glow and fan blades are
   DOM pieces moved with transforms. */
import { FURNITURE, heroPose, panelTransform, PHONE_MAX_WIDTH, projector, type Box, type Vec3 } from './heroPose';
import { introAt, outlineAt } from './timeline';

interface ViewData {
  parts: { id: string; lines: number[][] }[];
  led: [number, number][];
  screens: { cols: number; rows: number; bits: string }[];
}
export interface OutlineData {
  v: number;
  q: number;
  boxes: Record<string, number[]>;
  displays: Vec3[][];
  led: [Vec3, Vec3];
  sweep: [number, number];
  fan: { centre: Vec3; x: Vec3; y: Vec3; radius: number; blades: number[][] };
  views: { desk: ViewData; phone: ViewData };
}

let request: Promise<OutlineData | null> | null = null;
/** The outline file, fetched once (about 16 KB compressed). */
export const loadOutline = () =>
  (request ??= fetch('/models/desk-outline.json')
    .then((r) => (r.ok ? (r.json() as Promise<OutlineData>) : null))
    .catch(() => null));

/** Lit stages: the light bar's part lights at 1, the fan at 2; at 3 the
 *  screens glow. */
const LIT_AT: Record<string, number> = { bar: 1, fan: 2 };
/** The drawing is fully traced at this progress; the rest is the screens. */
export const TRACED = 0.9;
/** How long (in progress) a just-drawn line takes to settle from the pen's
 *  colour to the drawing's. */
const SETTLE = 0.05;
/** Settled lines are drawn bright and shown at this opacity, so the
 *  handover can brighten them with opacity alone. */
const DIM = 0.6;

interface Part {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Screen-space polylines (x, y pairs), and each one's cumulative length. */
  lines: Float32Array[];
  ends: number[];
  total: number;
  /** This part's share of the tracing progress. */
  from: number;
  until: number;
  x0: number;
  y0: number;
  /** What was drawn last (progress), to skip redundant redraws. */
  drawn: number;
}

const decode = (line: number[], q: number) => {
  const out = new Float32Array(line.length);
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < line.length; i += 3) {
    x = i ? x + line[i] : line[i];
    y = i ? y + line[i + 1] : line[i + 1];
    z = i ? z + line[i + 2] : line[i + 2];
    out[i] = x / q;
    out[i + 1] = y / q;
    out[i + 2] = z / q;
  }
  return out;
};

function css(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export class OutlineDrawing {
  private parts: Part[] = [];
  private head: HTMLDivElement;
  private ledRuns: { el: HTMLDivElement; fill: HTMLDivElement; clip: HTMLDivElement; t0: number; t1: number; share: [number, number]; ax: number; ay: number; len: number; dirX: number; dirY: number }[] = [];
  private screens: HTMLDivElement[] = [];
  private fan: HTMLDivElement;
  private p = 0;
  private lit = 0;
  private bright = false;
  private project: ReturnType<typeof projector> | null = null;
  private colours = { line: '#c9d1d8', accent: '#f23d50', rgb: '242,61,80' };
  /** Where things landed, for the preloader's layout. */
  box = { top: 0, bottom: 0, deskBottom: 0, ledX: 0, ledY: 0 };

  constructor(private root: HTMLElement, private data: OutlineData) {
    this.head = document.createElement('div');
    this.head.className = 'pl-ol-head';
    this.fan = document.createElement('div');
    this.fan.className = 'pl-ol-fan';
    this.fan.innerHTML = '<canvas></canvas>';
  }

  /** (Re)build for a view of `width` x `height` CSS px: the desk's canvas. */
  layout(width: number, height: number) {
    const { data, root } = this;
    const view = width <= PHONE_MAX_WIDTH ? data.views.phone : data.views.desk;
    const boxes = FURNITURE.map((n): Box => [data.boxes[n].slice(0, 3) as Vec3, data.boxes[n].slice(3) as Vec3]);
    const pose = heroPose(boxes, width / height, width <= PHONE_MAX_WIDTH);
    const project = (this.project = projector(pose, width, height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lineWidth = width <= PHONE_MAX_WIDTH ? 1 : width >= 1800 ? 1.4 : 1.15;
    root.replaceChildren();
    this.readColours();

    // Parts: project, measure, and give each a canvas over its own bounds.
    let total = 0;
    let top = Infinity,
      bottom = -Infinity;
    this.parts = view.parts.map(({ id, lines }) => {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity,
        run = 0;
      const ends: number[] = [];
      const flat = lines.map((encoded) => {
        const world = decode(encoded, data.q);
        const out = new Float32Array((world.length / 3) * 2);
        for (let i = 0, j = 0; i < world.length; i += 3, j += 2) {
          const [x, y] = project(world[i], world[i + 1], world[i + 2]);
          out[j] = x;
          out[j + 1] = y;
          if (j) run += Math.hypot(x - out[j - 2], y - out[j - 1]);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        ends.push(run);
        return out;
      });
      const pad = 8;
      x0 = Math.max(0, Math.floor(x0 - pad));
      y0 = Math.max(0, Math.floor(y0 - pad));
      x1 = Math.min(width, Math.ceil(x1 + pad));
      y1 = Math.min(height, Math.ceil(y1 + pad));
      top = Math.min(top, y0 + pad);
      bottom = Math.max(bottom, y1 - pad);
      if (id === 'desk') this.box.deskBottom = y1 - pad;
      const canvas = document.createElement('canvas');
      canvas.className = 'pl-ol-part';
      canvas.width = Math.max(1, Math.round((x1 - x0) * dpr));
      canvas.height = Math.max(1, Math.round((y1 - y0) * dpr));
      Object.assign(canvas.style, {
        left: x0 + 'px',
        top: y0 + 'px',
        width: x1 - x0 + 'px',
        height: y1 - y0 + 'px',
      });
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = lineWidth;
      root.appendChild(canvas);
      total += run;
      return { id, canvas, ctx, lines: flat, ends, total: run, from: 0, until: 0, x0, y0, drawn: -1 };
    });
    // Each part's share of the progress, by length, so the pen keeps one pace.
    let at = 0;
    for (const part of this.parts) {
      part.from = (at / total) * TRACED;
      at += part.total;
      part.until = (at / total) * TRACED;
    }
    this.box.top = Math.max(0, top);
    this.box.bottom = Math.min(height, bottom);

    // Screens: a faint scan glow mapped onto each screen, masked to where
    // the screen shows (the figure and tower cover parts of it).
    this.screens = data.displays.map((corners, i) => {
      const [tl, tr, , bl] = corners;
      const w = 320;
      const h = Math.round((w * Math.hypot(bl[0] - tl[0], bl[1] - tl[1], bl[2] - tl[2])) / Math.hypot(tr[0] - tl[0], tr[1] - tl[1], tr[2] - tl[2]));
      const ndc = corners.map((c) => {
        const [x, y] = project(c[0], c[1], c[2]);
        return { x: (x / width) * 2 - 1, y: 1 - (y / height) * 2 };
      });
      const el = document.createElement('div');
      el.className = 'pl-ol-screen';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.transform = panelTransform(ndc, width, height, w, h);
      el.style.setProperty('--i', String(i));
      const mask = view.screens[i];
      if (mask && mask.bits.includes('0')) {
        const m = document.createElement('canvas');
        m.width = mask.cols;
        m.height = mask.rows;
        const mc = m.getContext('2d')!;
        const img = mc.createImageData(mask.cols, mask.rows);
        for (let k = 0; k < mask.bits.length; k++) img.data[k * 4 + 3] = mask.bits[k] === '1' ? 255 : 0;
        mc.putImageData(img, 0, 0);
        const url = `url(${m.toDataURL()})`;
        el.style.setProperty('mask-image', url);
        el.style.setProperty('-webkit-mask-image', url);
      }
      el.innerHTML = '<i class="pl-ol-band"></i><i class="pl-ol-cursor"></i>';
      root.appendChild(el);
      return el;
    });

    // Fan blades: drawn flat in the fan's plane, mapped there by the
    // projection's local (affine) shape at the fan's centre, and spun in CSS.
    const { fan } = data;
    const size = 160;
    const reach = fan.radius * 1.1;
    const local = (u: number, v: number) => {
      const p = [0, 1, 2].map((k) => fan.centre[k] + fan.x[k] * u + fan.y[k] * v) as Vec3;
      return project(p[0], p[1], p[2]);
    };
    const [cx, cy] = local(0, 0);
    const [ux, uy] = local(reach, 0);
    const [vx, vy] = local(0, reach);
    const k = 2 / size;
    // Local px (y down) -> screen: u = (px - size/2) * k * reach, v = -(py - size/2) * k * reach.
    const a = (ux - cx) * k,
      b = (uy - cy) * k,
      c = -(vx - cx) * k,
      d = -(vy - cy) * k;
    const e = cx - (a + c) * (size / 2),
      f = cy - (b + d) * (size / 2);
    this.fan.style.width = this.fan.style.height = size + 'px';
    this.fan.style.transform = `matrix(${a},${b},${c},${d},${e},${f})`;
    const bladeCanvas = this.fan.firstChild as HTMLCanvasElement;
    const scale = dpr * Math.max(1, Math.hypot(a, b));
    bladeCanvas.width = bladeCanvas.height = Math.round(size * scale);
    const bc = bladeCanvas.getContext('2d')!;
    bc.setTransform(scale, 0, 0, scale, 0, 0);
    bc.strokeStyle = this.colours.accent;
    bc.lineWidth = lineWidth / Math.max(0.2, Math.hypot(a, b));
    bc.lineCap = bc.lineJoin = 'round';
    bc.beginPath();
    for (const line of fan.blades) {
      for (let i = 0; i < line.length; i += 2) {
        const px = size / 2 + (line[i] / 1e4 / reach) * (size / 2);
        const py = size / 2 - (line[i + 1] / 1e4 / reach) * (size / 2);
        if (i) bc.lineTo(px, py);
        else bc.moveTo(px, py);
      }
    }
    bc.stroke();
    root.appendChild(this.fan);

    // The LED strip: the progress bar, along the stretches of the desk's
    // front edge that show.
    const [la, lb] = data.led;
    const at3 = (t: number) => project(la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, la[2] + (lb[2] - la[2]) * t);
    const runs = view.led
      .map(([t0, t1]) => {
        const [ax, ay] = at3(t0);
        const [bx, by] = at3(t1);
        return { t0, t1, ax, ay, len: Math.hypot(bx - ax, by - ay), dirX: (bx - ax), dirY: (by - ay) };
      })
      .filter((r) => r.len >= 8);
    const ledTotal = runs.reduce((s, r) => s + r.len, 0) || 1;
    let ledAt = 0;
    this.ledRuns = runs.map((r) => {
      const el = document.createElement('div');
      el.className = 'pl-ol-led';
      el.style.width = r.len + 'px';
      el.style.transform = `translate(${r.ax}px,${r.ay}px) rotate(${Math.atan2(r.dirY, r.dirX)}rad)`;
      el.innerHTML = '<div class="pl-ol-led-clip"><i></i><div class="pl-ol-led-fill"></div></div>';
      root.appendChild(el);
      const share: [number, number] = [ledAt / ledTotal, (ledAt + r.len) / ledTotal];
      ledAt += r.len;
      return { ...r, el, clip: el.firstChild as HTMLDivElement, fill: el.querySelector('.pl-ol-led-fill') as HTMLDivElement, share };
    });
    const last = runs[runs.length - 1];
    if (last) {
      this.box.ledX = last.ax + last.dirX / 2;
      this.box.ledY = last.ay + last.dirY / 2;
    }
    root.appendChild(this.head);
    const bright = this.bright;
    this.bright = false;
    this.paint(true);
    this.setLit(this.lit);
    if (bright) this.prepareHandover();
  }

  private readColours() {
    this.colours = {
      line: css('--gold', '#c2cad0'),
      accent: css('--accent-glow', '#f23d50'),
      rgb: css('--accent-rgb', '242,61,80'),
    };
  }

  /** The palette changed: redraw in the new colours. */
  recolour() {
    this.readColours();
    this.parts.forEach((part) => (part.drawn = -1));
    this.paint(true);
  }

  /** Tracing progress, 0-1 (the drawing is complete at TRACED). */
  setProgress(p: number) {
    this.p = p;
    this.paint(false);
  }

  /** Light the light bar (1), then the fan (2), then the screens (3). */
  setLit(lit: number) {
    if (lit !== this.lit) this.parts.forEach((part) => LIT_AT[part.id] && (part.drawn = -1));
    this.lit = lit;
    this.root.dataset.lit = String(lit);
    this.paint(false);
  }

  private paint(force: boolean) {
    const { p } = this;
    let tip: [number, number] | null = null;
    for (const part of this.parts) {
      // Redraw only parts that look different at this progress: the one
      // being traced and any still settling.
      const local = (p - part.from) / (part.until - part.from);
      const key = local <= 0 ? 0 : Math.min(p, part.until + SETTLE);
      if (!force && key === part.drawn) continue;
      part.drawn = key;
      const point = this.draw(part, Math.min(1, Math.max(0, local)));
      if (point && local > 0 && local < 1) tip = point;
    }
    this.head.style.opacity = tip ? '1' : '0';
    if (tip) this.head.style.transform = `translate(${tip[0]}px,${tip[1]}px)`;
    for (const run of this.ledRuns) {
      const fill = Math.min(1, Math.max(0, (p - run.share[0]) / (run.share[1] - run.share[0])));
      run.fill.style.transform = `scaleX(${fill})`;
    }
  }

  /** Draw `amount` (0-1) of a part. Lines just drawn go from the pen's
   *  colour to the drawing's; returns where the pen is. */
  private draw(part: Part, amount: number): [number, number] | null {
    const { ctx, canvas } = part;
    const { line, accent, rgb } = this.colours;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (amount <= 0) return null;
    const lit = (LIT_AT[part.id] ?? 99) <= this.lit;
    const budget = amount * part.total;
    const span = part.until - part.from;
    // Age in progress units of a line that ended at `end` (px along the part).
    const age = (end: number) => this.p - (part.from + (end / part.total) * span);
    const base = lit ? accent : line;
    const settledAlpha = this.bright || lit ? 1 : DIM;
    let tip: [number, number] | null = null;
    const trace = (k: number, limit: number) => {
      const pts = part.lines[k];
      const start = k ? part.ends[k - 1] : 0;
      ctx.moveTo(pts[0], pts[1]);
      let run = start;
      for (let i = 2; i < pts.length; i += 2) {
        const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
        if (run + seg >= limit) {
          const t = seg ? (limit - run) / seg : 0;
          const x = pts[i - 2] + (pts[i] - pts[i - 2]) * t,
            y = pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t;
          ctx.lineTo(x, y);
          tip = [x, y];
          return false;
        }
        ctx.lineTo(pts[i], pts[i + 1]);
        run += seg;
      }
      return true;
    };
    // Settled lines in one batch.
    ctx.beginPath();
    let k = 0;
    for (; k < part.lines.length && part.ends[k] <= budget && age(part.ends[k]) >= SETTLE; k++) trace(k, Infinity);
    ctx.strokeStyle = base;
    ctx.globalAlpha = settledAlpha;
    ctx.stroke();
    // Recent lines, each in its own colour, with a soft glow near the pen.
    for (; k < part.lines.length; k++) {
      const start = k ? part.ends[k - 1] : 0;
      if (start >= budget) break;
      const fresh = 1 - Math.min(1, age(Math.min(part.ends[k], budget)) / SETTLE);
      ctx.beginPath();
      trace(k, budget);
      ctx.globalAlpha = settledAlpha + (1 - settledAlpha) * fresh;
      if (fresh > 0.35 && !this.bright) {
        ctx.strokeStyle = `rgba(${rgb},${0.22 * fresh})`;
        const w = ctx.lineWidth;
        ctx.lineWidth = w * 4;
        ctx.stroke();
        ctx.lineWidth = w;
      }
      ctx.strokeStyle = fresh > 0 ? mix(base, accent, fresh) : base;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return amount >= 1 ? null : tip;
  }

  /** Before the hands come: draw every line bright and show it dimmed, so
   *  the handover only has to change opacity. */
  prepareHandover() {
    if (this.bright) return;
    this.p = Math.max(this.p, 1);
    this.bright = true;
    for (const part of this.parts) {
      this.draw(part, 1);
      part.drawn = this.p;
      part.canvas.style.opacity = String(this.base(part));
    }
    this.head.style.opacity = '0';
    for (const run of this.ledRuns) run.fill.style.transform = 'scaleX(1)';
  }

  /** A part's opacity once drawn bright: lit parts glow at full strength. */
  private base(part: Part) {
    return (LIT_AT[part.id] ?? 99) <= this.lit ? 1 : DIM;
  }

  /** One frame of the handover, `seconds` after the bars started to open.
   *  Opacity and transforms only. */
  handover(seconds: number) {
    const intro = introAt(seconds);
    this.parts.forEach((part, i) => {
      const { bright, opacity } = outlineAt(seconds, i);
      const base = this.base(part);
      part.canvas.style.opacity = String((base + (1 - base) * bright) * opacity);
      if (part.id === 'fan') this.fan.style.opacity = String(opacity);
    });
    // The drawn LED gives way exactly where the real strip has lit.
    const [la, lb] = this.data.led;
    const [from, to] = this.data.sweep;
    const lit = (from + (to - from) * intro.sweep - la[0]) / (lb[0] - la[0]);
    for (const run of this.ledRuns) {
      let gone = 0;
      if (lit > run.t0 && this.project) {
        const t = Math.min(run.t1, lit);
        const [x, y] = this.project(la[0] + (lb[0] - la[0]) * t, la[1], la[2]);
        gone = Math.min(1, Math.hypot(x - run.ax, y - run.ay) / run.len);
      }
      run.clip.style.transform = `scaleX(${1 - gone})`;
    }
    this.screens.forEach((el, i) => (el.style.opacity = String(this.lit >= 3 ? 1 - intro.screens[i] : 0)));
  }
}

/** Blend two #rrggbb colours. */
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
