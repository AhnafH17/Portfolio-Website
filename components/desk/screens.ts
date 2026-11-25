import type { Accent } from '@/lib/accent';
import { projectData, stripMeta, type ProjectKey } from '@/lib/projects';
import { THUMBNAIL_ATLAS } from './thumbnailAtlas';

export const CATEGORIES = [
  {
    monitor: 'Left',
    title: 'Software &',
    titleBold: 'AI Engineering',
    crumb: 'Software & AI',
    status: 'Online',
    subtitle: 'Building intelligent systems, tools and platforms that solve real problems.',
    projects: ['notion', 'dashboard', 'scripting', 'data'],
  },
  {
    monitor: 'Centre',
    title: 'Web Development &',
    titleBold: 'E-commerce',
    crumb: 'Web & E-commerce',
    status: 'Live',
    subtitle: 'Crafting high-performance websites and digital storefronts from scratch.',
    projects: ['urbandecant', 'bp', 'leadcraft', 'resizer'],
  },
  {
    monitor: 'Right',
    title: 'SEO, Security &',
    titleBold: 'Web Presence',
    crumb: 'SEO & Security',
    status: 'Secure',
    subtitle: 'Securing, optimizing and scaling digital presence for real-world results.',
    projects: ['cpc', 'revive', 'aurix'],
  },
] as const satisfies ReadonlyArray<{
  monitor: string;
  title: string;
  titleBold: string;
  crumb: string;
  status: string;
  subtitle: string;
  projects: readonly ProjectKey[];
}>;

export const tags = Object.fromEntries(stripMeta.map((p) => [p.key, p.tags])) as Record<ProjectKey, string[]>;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ScreenLayout {
  w: number;
  h: number;
  phone: boolean;
  pad: number;
  /** Height of the slim app bar. */
  bar: number;
  /** Corner radius of the project cards (the focus ring follows it). */
  radius: number;
  /** One per project, in CATEGORIES order: the link targets. */
  cards: Rect[];
  /** Centre only: the featured carousel, which opens the project it shows. */
  hero: Rect | null;
  header: Rect;
  /** Decorative live panels: left terminal + graph, right chart + security. */
  panels: Rect[];
  /** Right, desktop: the dashboard's icon rail. */
  rail: Rect | null;
}

/** Layout in CSS-like units. The same rectangles place the accessible links
 *  (DeskHero's overlay) and map pointer hits from the texture's UVs. */
export function screenLayout(index: number, phone: boolean): ScreenLayout {
  if (index === 0) {
    const w = 430,
      h = 764,
      pad = 22;
    return {
      w,
      h,
      phone,
      pad,
      bar: 38,
      radius: 14,
      cards: [0, 1, 2, 3].map((i) => ({ x: pad, y: 186 + i * 90, w: w - pad * 2, h: 82 })),
      hero: null,
      header: { x: pad, y: 52, w: w - pad * 2, h: 124 },
      panels: [
        { x: pad, y: 552, w: w - pad * 2, h: 100 },
        { x: pad, y: 662, w: w - pad * 2, h: 80 },
      ],
      rail: null,
    };
  }
  if (index === 1) {
    if (phone) {
      const w = 360,
        h = 154,
        pad = 9;
      const cw = (182 - 6) / 2,
        ch = (h - 52 - pad - 5) / 2;
      return {
        w,
        h,
        phone,
        pad,
        bar: 22,
        radius: 7,
        cards: [0, 1, 2, 3].map((i) => ({ x: 169 + (i % 2) * (cw + 6), y: 52 + Math.floor(i / 2) * (ch + 5), w: cw, h: ch })),
        hero: { x: pad, y: 29, w: 152, h: h - 29 - pad },
        header: { x: 169, y: 28, w: 182, h: 22 },
        panels: [],
        rail: null,
      };
    }
    const w = 960,
      h = 411,
      pad = 24;
    const cw = (376 - 12) / 2,
      ch = (387 - 164 - 12) / 2;
    return {
      w,
      h,
      phone,
      pad,
      bar: 38,
      radius: 14,
      cards: [0, 1, 2, 3].map((i) => ({ x: 560 + (i % 2) * (cw + 12), y: 164 + Math.floor(i / 2) * (ch + 12), w: cw, h: ch })),
      hero: { x: pad, y: 52, w: 520, h: 335 },
      header: { x: 560, y: 52, w: 376, h: 110 },
      panels: [],
      rail: null,
    };
  }
  if (phone) {
    const w = 360,
      h = 203,
      pad = 9;
    const ch = (h - 50 - pad - 8) / 3;
    return {
      w,
      h,
      phone,
      pad,
      bar: 22,
      radius: 7,
      cards: [0, 1, 2].map((i) => ({ x: pad, y: 50 + i * (ch + 4), w: 216, h: ch })),
      hero: null,
      header: { x: pad, y: 28, w: 216, h: 18 },
      panels: [
        { x: 233, y: 29, w: 118, h: 80 },
        { x: 233, y: 115, w: 118, h: h - 115 - pad },
      ],
      rail: null,
    };
  }
  const w = 960,
    h = 540,
    pad = 24;
  const cw = (864 - 32) / 3;
  return {
    w,
    h,
    phone,
    pad,
    bar: 38,
    radius: 16,
    cards: [0, 1, 2].map((i) => ({ x: 72 + i * (cw + 16), y: 286, w: cw, h: 230 })),
    hero: null,
    header: { x: 72, y: 56, w: 380, h: 140 },
    panels: [
      { x: 468, y: 56, w: 236, h: 214 },
      { x: 716, y: 56, w: 220, h: 214 },
    ],
    rail: { x: 0, y: 38, w: 52, h: h - 38 },
  };
}

let thumbnails: Promise<Thumbs | null> | undefined;
/** The project thumbnail atlas: HD on desktop, lighter on phones. */
export function loadDeskThumbnails() {
  if (!thumbnails) {
    const atlas = matchMedia('(max-width: 768px)').matches ? THUMBNAIL_ATLAS.sd : THUMBNAIL_ATLAS.hd;
    const image = new Image();
    image.src = atlas.src;
    thumbnails = image.decode().then(
      () => new Thumbs(image, atlas.width, atlas.height),
      () => null
    );
  }
  return thumbnails;
}

const thumbnailIndex = new Map<string, number>(THUMBNAIL_ATLAS.names.map((name, index) => [name, index]));

export class Thumbs {
  constructor(
    readonly image: HTMLImageElement,
    readonly tileW: number,
    readonly tileH: number
  ) {}
  /** Cover-fit one project's tile into `box`; zoom and focus drive Ken Burns. */
  draw(ctx: Ctx, key: ProjectKey, box: Rect, zoom = 1, fx = 0.5, fy = 0.5) {
    const index = thumbnailIndex.get(key);
    if (index === undefined) return;
    const k = this.image.naturalWidth / (THUMBNAIL_ATLAS.columns * this.tileW);
    const tw = this.tileW * k,
      th = this.tileH * k;
    const scale = Math.max(box.w / tw, box.h / th) * zoom;
    const sw = box.w / scale,
      sh = box.h / scale;
    const sx = (index % THUMBNAIL_ATLAS.columns) * tw + (tw - sw) * fx;
    const sy = Math.floor(index / THUMBNAIL_ATLAS.columns) * th + (th - sh) * fy;
    ctx.drawImage(this.image, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
  }
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;
const INK = {
  bg: '#07080b',
  text: '#eceef2',
  soft: '#c4c9d2',
  dim: '#8b919c',
  faint: '#5a606b',
  hair: 'rgba(255,255,255,0.06)',
  hair2: 'rgba(255,255,255,0.1)',
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const outCubic = (v: number) => 1 - (1 - clamp01(v)) ** 3;
function rgbOf(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
const rgba = (c: [number, number, number], a: number) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';

function shape(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}
function font(ctx: Ctx, size: number, weight = 400, display = false) {
  ctx.font = weight + ' ' + size + 'px "' + (display ? 'Greater Theory' : 'DM Sans') + '", sans-serif';
}
function track(ctx: Ctx, em: number) {
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = em + 'em';
}
function fit(ctx: Ctx, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}
function wrap(ctx: Ctx, text: string, x: number, y: number, max: number, lead: number, lines = 2) {
  const words = text.split(' ');
  const rows: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > max) {
      rows.push(line);
      line = word;
    } else line = next;
  }
  rows.push(line);
  if (rows.length > lines) {
    rows.length = lines;
    rows[lines - 1] = fit(ctx, rows[lines - 1] + '…', max);
  }
  rows.forEach((row, i) => ctx.fillText(row, x, y + i * lead));
  return rows.length;
}
/** The thin "↗" mark, drawn so no third typeface sneaks in. */
function arrow(ctx: Ctx, x: number, y: number, s: number, color: string, width = 1.3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x + s * 0.3, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s, y + s * 0.7);
  ctx.stroke();
}
function check(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.55);
  ctx.lineTo(x + s * 0.36, y + s * 0.9);
  ctx.lineTo(x + s, y + s * 0.12);
  ctx.stroke();
}

interface Item {
  rect: Rect;
  draw: (ctx: Ctx, t: number, s: ScreenState) => void;
  /** Animating at time t: repainted on every update. */
  live?: (t: number, s: ScreenState) => boolean;
  /** Hover target number (card index; the centre hero is cards.length). */
  target?: number;
}
export interface ScreenState {
  /** Hovered or focused target (card index, hero = cards.length), else -1. */
  hover: number;
  /** Seconds (performance clock) the camera first settled here, else null. */
  arrived: number | null;
}
export interface Patch {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

const STILL_T = 3.4;
const HERO_STEP = 5.2;
const HERO_FADE = 0.9;
const STAGGER = 0.09;
const RISE = 0.6;

/** One monitor's UI: a retained list of items painted into `canvas`, and
 *  small patches for whatever animates, so a frame uploads only those. */
export class DeskScreen {
  readonly canvas: HTMLCanvasElement;
  readonly layout: ScreenLayout;
  readonly scale: number;
  private readonly items: Item[] = [];
  private readonly patchCanvases = new Map<string, HTMLCanvasElement>();
  private readonly wasLive = new Set<Item>();
  private lastHover = -1;
  private readonly glow: [number, number, number];
  private readonly glowCorner: [number, number];

  constructor(
    readonly index: number,
    phone: boolean,
    longSide: number,
    readonly accent: Accent,
    readonly thumbs: Thumbs | null,
    readonly still: boolean
  ) {
    this.layout = screenLayout(index, phone);
    const { w, h } = this.layout;
    this.scale = longSide / Math.max(w, h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(w * this.scale);
    this.canvas.height = Math.round(h * this.scale);
    this.glow = rgbOf(accent.glow, accent.rgb);
    this.glowCorner = [[w * 0.92, h * 0.04], [w * 0.98, h * 0.02], [w * 0.95, h * 0.96]][index] as [number, number];
    this.build();
  }

  private get cat() {
    return CATEGORIES[this.index];
  }
  private time(t: number) {
    return this.still ? STILL_T : t;
  }

  /** Index (in cat.projects) the centre carousel is showing at time t. */
  featured(t: number) {
    const n = this.cat.projects.length;
    const tt = this.time(t);
    const k = Math.floor(tt / HERO_STEP);
    const local = tt - k * HERO_STEP;
    return (((local < HERO_FADE / 2 ? k - 1 : k) % n) + n) % n;
  }

  /** Target under a point in layout units: card index, hero, or -1. */
  hit(x: number, y: number) {
    const { cards, hero } = this.layout;
    const inside = (r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const card = cards.findIndex(inside);
    if (card >= 0) return card;
    return hero && inside(hero) ? cards.length : -1;
  }
  /** Project a target opens at time t. */
  keyAt(target: number, t: number): ProjectKey {
    const projects = this.cat.projects;
    return projects[target === projects.length ? this.featured(t) : target];
  }

  /** Paint the whole screen into `canvas`. */
  paintAll(t: number, state: ScreenState) {
    const ctx = this.canvas.getContext('2d')!;
    this.paintRegion(ctx, { x: 0, y: 0, w: this.layout.w, h: this.layout.h }, 0, 0, t, state);
    this.items.forEach((item) => (item.live?.(this.time(t), state) ? this.wasLive.add(item) : this.wasLive.delete(item)));
    this.lastHover = state.hover;
  }

  /** Repaint what changed since the last call; patches are in texture pixels. */
  update(t: number, state: ScreenState): Patch[] {
    const tt = this.time(t);
    const dirty: Item[] = [];
    for (const item of this.items) {
      const live = !!item.live?.(tt, state);
      const hover = item.target !== undefined && (item.target === state.hover) !== (item.target === this.lastHover);
      if (live || hover || this.wasLive.has(item)) dirty.push(item);
      if (live) this.wasLive.add(item);
      else this.wasLive.delete(item);
    }
    this.lastHover = state.hover;
    return dirty.map((item) => this.patch(item.rect, t, state));
  }

  private patch(r: Rect, t: number, state: ScreenState): Patch {
    const S = this.scale;
    const x0 = Math.max(0, Math.floor(r.x * S)),
      y0 = Math.max(0, Math.floor(r.y * S));
    const x1 = Math.min(this.canvas.width, Math.ceil((r.x + r.w) * S)),
      y1 = Math.min(this.canvas.height, Math.ceil((r.y + r.h) * S));
    const key = x0 + ',' + y0 + ',' + x1 + ',' + y1;
    let canvas = this.patchCanvases.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = x1 - x0;
      canvas.height = y1 - y0;
      this.patchCanvases.set(key, canvas);
    }
    const ctx = canvas.getContext('2d')!;
    this.paintRegion(ctx, { x: x0 / S, y: y0 / S, w: (x1 - x0) / S, h: (y1 - y0) / S }, x0, y0, t, state);
    return { canvas, x: x0, y: y0 };
  }

  private paintRegion(ctx: Ctx, r: Rect, ox: number, oy: number, t: number, state: ScreenState) {
    const S = this.scale;
    const tt = this.time(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setTransform(S, 0, 0, S, -ox, -oy);
    ctx.textBaseline = 'top';
    // Base: near-black with a soft accent bloom in one corner.
    ctx.fillStyle = INK.bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const [gx, gy] = this.glowCorner;
    const reach = Math.max(this.layout.w, this.layout.h) * 0.62;
    const bloom = ctx.createRadialGradient(gx, gy, 0, gx, gy, reach);
    bloom.addColorStop(0, rgba(this.glow, 0.16));
    bloom.addColorStop(0.45, rgba(this.glow, 0.05));
    bloom.addColorStop(1, rgba(this.glow, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (const item of this.items) {
      const b = item.rect;
      if (b.x >= r.x + r.w || b.x + b.w <= r.x || b.y >= r.y + r.h || b.y + b.h <= r.y) continue;
      ctx.save();
      item.draw(ctx, tt, state);
      ctx.restore();
    }
  }

  /* ---------------- shared pieces ---------------- */

  private glass(ctx: Ctx, r: Rect, radius: number, hover = false) {
    const S = this.scale;
    if (hover) {
      ctx.save();
      ctx.shadowColor = rgba(this.glow, 0.28);
      ctx.shadowBlur = 22 * S;
      ctx.shadowOffsetY = 4 * S;
      shape(ctx, r.x, r.y, r.w, r.h, radius);
      ctx.fillStyle = '#0f1117';
      ctx.fill();
      ctx.restore();
    }
    const fill = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    fill.addColorStop(0, hover ? '#151821' : '#11131a');
    fill.addColorStop(1, hover ? '#0f1118' : '#0d0f14');
    shape(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    shape(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, radius - 0.5);
    ctx.strokeStyle = hover ? rgba(this.glow, 0.62) : INK.hair;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Top highlight, like light catching the edge of glass.
    const hl = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)');
    hl.addColorStop(0.5, hover ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(r.x + radius, r.y + 0.5, r.w - radius * 2, 1);
  }

  private pill(ctx: Ctx, x: number, y: number, text: string, size: number, dot = true) {
    font(ctx, size, 500);
    const h = size * 1.75,
      padX = size * 0.75,
      dotW = dot ? size * 0.85 : 0;
    const w = ctx.measureText(text).width + padX * 2 + dotW;
    shape(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = INK.hair2;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (dot) {
      ctx.fillStyle = this.accent.glow;
      ctx.beginPath();
      ctx.arc(x + padX + size * 0.2, y + h / 2, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK.soft;
    ctx.fillText(text, x + padX + dotW, y + (h - size) / 2 + size * 0.02);
    return w;
  }

  private tagRow(ctx: Ctx, key: ProjectKey, x: number, y: number, max: number, size: number, count = 2) {
    let cx = x;
    for (const tag of tags[key].slice(0, count)) {
      font(ctx, size, 500);
      const need = ctx.measureText(tag).width + size * 2.35;
      if (cx + need > x + max) break;
      cx += this.pill(ctx, cx, y, tag, size, cx === x) + size * 0.5;
    }
  }

  /** Card appearance during the arrival stagger: alpha and rise. */
  private entrance(i: number, t: number, s: ScreenState) {
    if (s.arrived === null || this.still) return { alpha: 1, dy: 0 };
    const e = outCubic((t - s.arrived - i * STAGGER) / RISE);
    return { alpha: e, dy: (1 - e) * 10 };
  }
  private entering(i: number, t: number, s: ScreenState) {
    return s.arrived !== null && !this.still && t - s.arrived < i * STAGGER + RISE + 0.05;
  }

  /** A card slot: entrance, hover lift, then `body` in its moved frame. */
  private cardItem(i: number, body: (ctx: Ctx, r: Rect, hover: boolean, t: number) => void, extraLive?: (t: number) => boolean) {
    const r = this.layout.cards[i];
    const m = this.layout.phone ? 8 : 18;
    this.items.push({
      rect: { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 },
      target: i,
      live: (t, s) => this.entering(i, t, s) || !!extraLive?.(t),
      draw: (ctx, t, s) => {
        const { alpha, dy } = this.entrance(i, t, s);
        if (alpha <= 0) return;
        const hover = s.hover === i;
        ctx.globalAlpha = alpha;
        const lift = hover ? (this.layout.phone ? 1.5 : 3) : 0;
        body(ctx, { ...r, y: r.y + dy - lift }, hover, t);
      },
    });
  }

  private statusDot(ctx: Ctx, x: number, y: number, size: number, t: number) {
    const phase = (t % 2.2) / 2.2;
    ctx.fillStyle = rgba(this.glow, 0.45 * (1 - phase));
    ctx.beginPath();
    ctx.arc(x, y, size * (1 + phase * 1.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.accent.glow;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Slim app bar: monogram, breadcrumb, live status pill. */
  private chrome() {
    const { w, bar, pad, phone } = this.layout;
    const k = phone ? 0.62 : 1;
    const cat = this.cat;
    this.items.push({
      rect: { x: 0, y: 0, w, h: bar },
      draw: (ctx) => {
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(0, 0, w, bar);
        ctx.fillStyle = INK.hair;
        ctx.fillRect(0, bar - 1, w, 1);
        // AH mark
        const m = 18 * k,
          my = (bar - m) / 2;
        const g = ctx.createLinearGradient(pad, my, pad + m, my + m);
        g.addColorStop(0, this.accent.glow);
        g.addColorStop(1, this.accent.deep);
        shape(ctx, pad, my, m, m, 5 * k);
        ctx.fillStyle = g;
        ctx.fill();
        font(ctx, 7.4 * k, 400, true);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('AH', pad + m / 2, my + m * 0.3);
        ctx.textAlign = 'left';
        // Breadcrumb
        font(ctx, 12 * k, 400);
        let x = pad + m + 12 * k;
        const ty = (bar - 12 * k) / 2;
        ctx.fillStyle = INK.dim;
        ctx.fillText('Work', x, ty);
        x += ctx.measureText('Work').width + 7 * k;
        ctx.fillStyle = INK.faint;
        ctx.fillText('/', x, ty);
        x += ctx.measureText('/').width + 7 * k;
        font(ctx, 12 * k, 500);
        ctx.fillStyle = INK.text;
        ctx.fillText(cat.crumb, x, ty);
        // Status pill (the dot itself is a live item).
        font(ctx, 11 * k, 500);
        const label = cat.status;
        const pw = ctx.measureText(label).width + 30 * k,
          ph = 20 * k;
        const px = w - pad - pw,
          py = (bar - ph) / 2;
        shape(ctx, px, py, pw, ph, ph / 2);
        ctx.fillStyle = rgba(this.glow, 0.07);
        ctx.fill();
        ctx.strokeStyle = rgba(this.glow, 0.22);
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = INK.soft;
        ctx.fillText(label, px + 20 * k, py + (ph - 11 * k) / 2);
        if (!phone && this.index > 0) {
          // A command-bar hint, as product UIs have it.
          font(ctx, 11, 400);
          const sw = 150,
            sx = px - 14 - sw;
          shape(ctx, sx, py, sw, ph, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fill();
          ctx.strokeStyle = INK.hair;
          ctx.stroke();
          ctx.strokeStyle = INK.dim;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.arc(sx + 13, py + ph / 2 - 0.5, 3.6, 0, Math.PI * 2);
          ctx.moveTo(sx + 15.7, py + ph / 2 + 2.2);
          ctx.lineTo(sx + 18, py + ph / 2 + 4.5);
          ctx.stroke();
          ctx.fillStyle = INK.faint;
          ctx.fillText('Search projects', sx + 25, py + 4.6);
        }
      },
    });
    const dx = w - pad - 0,
      d = 3 * k;
    this.items.push({
      rect: { x: dx - 90 * k, y: 0, w: 90 * k, h: bar - 1 },
      live: () => !this.still,
      draw: (ctx, t) => {
        font(ctx, 11 * k, 500);
        const pw = ctx.measureText(this.cat.status).width + 30 * k;
        this.statusDot(ctx, w - pad - pw + 10 * k, bar / 2, d, t);
      },
    });
  }

  private header(compact = false) {
    const { header: r, phone } = this.layout;
    const cat = this.cat;
    this.items.push({
      rect: r,
      draw: (ctx) => {
        if (compact) {
          font(ctx, 7, 500);
          track(ctx, 0.14);
          ctx.fillStyle = this.accent.light;
          ctx.fillText(cat.title.toUpperCase(), r.x, r.y);
          track(ctx, -0.01);
          font(ctx, 12.5, 400, true);
          ctx.fillStyle = INK.text;
          ctx.fillText(fit(ctx, cat.titleBold.toUpperCase(), r.w), r.x, r.y + 10);
          return;
        }
        const big = this.index === 0 ? 29 : this.index === 1 ? 26 : 31;
        font(ctx, 10.5, 500);
        track(ctx, 0.16);
        ctx.fillStyle = this.accent.light;
        ctx.fillText('SELECTED WORK', r.x, r.y);
        track(ctx, 0);
        font(ctx, 16, 300);
        ctx.fillStyle = INK.soft;
        ctx.fillText(cat.title, r.x, r.y + 19);
        font(ctx, big, 400, true);
        track(ctx, -0.02);
        ctx.fillStyle = INK.text;
        ctx.fillText(fit(ctx, cat.titleBold.toUpperCase(), r.w), r.x, r.y + 41);
        track(ctx, 0);
        font(ctx, phone ? 13 : 12.5, 400);
        ctx.fillStyle = INK.dim;
        wrap(ctx, cat.subtitle, r.x, r.y + 41 + big + 9, r.w - 4, 17, 2);
      },
    });
  }

  /* ---------------- per screen ---------------- */

  private build() {
    this.chrome();
    if (this.index === 0) this.buildEditor();
    else if (this.index === 1) this.buildStore();
    else this.buildDashboard();
  }

  /** Left: an editor/terminal feel. Rows, a typing terminal, a pipeline. */
  private buildEditor() {
    this.header();
    const projects = this.cat.projects;
    projects.forEach((key, i) => {
      this.cardItem(i, (ctx, r, hover) => {
        this.glass(ctx, r, 14, hover);
        const img = { x: r.x + 8, y: r.y + 8, w: 118, h: r.h - 16 };
        this.thumb(ctx, key, img, 9, hover);
        const tx = img.x + img.w + 14,
          tw = r.x + r.w - tx - 14;
        this.tagRow(ctx, key, tx, r.y + 12, tw - 8, 9.5);
        font(ctx, 15.5, 600);
        ctx.fillStyle = INK.text;
        wrap(ctx, projectData[key].title, tx, r.y + 37, tw - 20, 18, 2);
        arrow(ctx, r.x + r.w - 24, r.y + r.h - 22, 8, hover ? this.accent.light : INK.dim);
      });
    });
    const [term, graph] = this.layout.panels;
    this.items.push({ rect: term, live: () => !this.still, draw: (ctx, t) => this.terminal(ctx, term, t) });
    this.items.push({ rect: graph, live: () => !this.still, draw: (ctx, t) => this.pipeline(ctx, graph, t) });
  }

  private terminal(ctx: Ctx, r: Rect, t: number) {
    this.glass(ctx, r, 14);
    font(ctx, 10, 500);
    track(ctx, 0.14);
    ctx.fillStyle = INK.dim;
    ctx.fillText('TERMINAL', r.x + 14, r.y + 12);
    track(ctx, 0);
    font(ctx, 10, 400);
    ctx.fillStyle = INK.faint;
    ctx.textAlign = 'right';
    ctx.fillText('~/work', r.x + r.w - 14, r.y + 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.hair;
    ctx.fillRect(r.x + 1, r.y + 30, r.w - 2, 1);
    const script: [boolean, string][] = [
      [true, 'pnpm dev --filter mission-control'],
      [false, 'ready · supabase connected'],
      [true, 'langgraph run script-engine'],
      [false, 'critic pass complete'],
      [true, 'python segment.py --clusters auto'],
      [false, 'segments written'],
      [true, 'vercel deploy --prod'],
      [false, 'deployed'],
    ];
    // Timeline: commands type at ~26 chars/s, output lands after a beat.
    const starts: number[] = [];
    let clock = 0;
    for (const [cmd, text] of script) {
      starts.push(clock);
      clock += cmd ? text.length / 26 + 0.35 : 0.9;
    }
    const cycle = clock + 2;
    const local = t % cycle;
    let shown = 0;
    while (shown < script.length && starts[shown] <= local) shown++;
    const visible = 3;
    const first = Math.max(0, shown - visible);
    font(ctx, 12, 400);
    for (let k = first; k < shown; k++) {
      const [cmd, text] = script[k];
      const y = r.y + 40 + (k - first) * 18;
      const x = r.x + 14;
      let chars = text.length;
      if (cmd && k === shown - 1) chars = Math.min(text.length, Math.floor((local - starts[k]) * 26));
      if (cmd) {
        ctx.strokeStyle = this.accent.glow;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y + 2.5);
        ctx.lineTo(x + 4, y + 6);
        ctx.lineTo(x, y + 9.5);
        ctx.stroke();
        ctx.fillStyle = '#dfe3ea';
      } else {
        check(ctx, x - 0.5, y + 2, 8, rgba(this.glow, 0.9));
        ctx.fillStyle = INK.dim;
      }
      const shownText = text.slice(0, chars);
      ctx.fillText(shownText, x + 14, y);
      if (k === shown - 1 && (cmd ? chars < text.length || t % 1 < 0.55 : false)) {
        const cx = x + 14 + ctx.measureText(shownText).width + 2;
        ctx.fillStyle = this.accent.light;
        ctx.fillRect(cx, y, 6, 13);
      }
    }
    if (shown > 0 && !script[shown - 1][0] && t % 1 < 0.55) {
      const y = r.y + 40 + Math.min(visible, shown - first) * 18;
      if (y + 13 < r.y + r.h - 4) {
        ctx.fillStyle = this.accent.light;
        ctx.fillRect(r.x + 14, y, 6, 13);
      }
    }
  }

  private pipeline(ctx: Ctx, r: Rect, t: number) {
    this.glass(ctx, r, 14);
    font(ctx, 10, 500);
    track(ctx, 0.14);
    ctx.fillStyle = INK.dim;
    ctx.fillText('PIPELINE', r.x + 14, r.y + 12);
    track(ctx, 0);
    const names = ['Brief', 'Context', 'Generate', 'Critic', 'Publish'];
    const gap = 14,
      nw = (r.w - 28 - gap * (names.length - 1)) / names.length,
      nh = 26,
      ny = r.y + 38;
    const centres = names.map((_, i) => r.x + 14 + i * (nw + gap));
    // Links
    ctx.strokeStyle = rgba(this.glow, 0.35);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < names.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(centres[i] + nw, ny + nh / 2);
      ctx.lineTo(centres[i + 1], ny + nh / 2);
      ctx.stroke();
    }
    // Pulse travelling the chain
    const period = 3.6;
    const u = (t % period) / period;
    const span = centres[names.length - 1] + nw - centres[0];
    const px = centres[0] + span * u;
    const active = centres.findIndex((cx) => px >= cx - 2 && px <= cx + nw + 2);
    names.forEach((name, i) => {
      const x = centres[i];
      const on = i === active;
      shape(ctx, x, ny, nw, nh, 7);
      ctx.fillStyle = on ? rgba(this.glow, 0.14) : 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.strokeStyle = on ? rgba(this.glow, 0.7) : INK.hair2;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      font(ctx, 10.5, on ? 600 : 500);
      ctx.fillStyle = on ? INK.text : INK.soft;
      ctx.textAlign = 'center';
      ctx.fillText(fit(ctx, name, nw - 6), x + nw / 2, ny + 8);
      ctx.textAlign = 'left';
    });
    if (active < 0) {
      const g = ctx.createRadialGradient(px, ny + nh / 2, 0, px, ny + nh / 2, 9);
      g.addColorStop(0, rgba(this.glow, 0.95));
      g.addColorStop(1, rgba(this.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - 9, ny + nh / 2 - 9, 18, 18);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, ny + nh / 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private thumb(ctx: Ctx, key: ProjectKey, box: Rect, radius: number, hover = false, zoom = 1, fx = 0.5, fy = 0.5) {
    ctx.save();
    shape(ctx, box.x, box.y, box.w, box.h, radius);
    ctx.clip();
    ctx.fillStyle = '#12141b';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    this.thumbs?.draw(ctx, key, box, zoom * (hover ? 1.04 : 1), fx, fy);
    ctx.restore();
    shape(ctx, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, radius - 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Centre: a storefront. A featured carousel and image-led product cards. */
  private buildStore() {
    const { phone, hero } = this.layout;
    const projects = this.cat.projects;
    this.header(phone);
    let lastFeatured = -1;
    const featureChanged = (t: number) => {
      const f = this.featured(t);
      const changed = f !== lastFeatured;
      lastFeatured = f;
      return changed;
    };
    const shimmer = (t: number) => {
      const period = 7.5;
      return (t % period) / 1.4;
    };
    projects.forEach((key, i) => {
      this.cardItem(
        i,
        (ctx, r, hover, t) => {
          const radius = this.layout.radius;
          if (hover) this.glass(ctx, r, radius, true);
          this.thumb(ctx, key, r, radius, hover);
          const shade = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
          shade.addColorStop(0, 'rgba(7,8,11,0.05)');
          shade.addColorStop(0.42, 'rgba(7,8,11,0.25)');
          shade.addColorStop(1, 'rgba(7,8,11,0.94)');
          shape(ctx, r.x, r.y, r.w, r.h, radius);
          ctx.fillStyle = shade;
          ctx.fill();
          const s = shimmer(t);
          if (s > 0 && s < 1 && !this.still) {
            ctx.save();
            shape(ctx, r.x, r.y, r.w, r.h, radius);
            ctx.clip();
            const span = this.layout.cards[3].x + this.layout.cards[3].w - this.layout.cards[0].x;
            const bx = this.layout.cards[0].x - 120 + (span + 240) * s;
            const band = ctx.createLinearGradient(bx - 70, r.y, bx + 70, r.y + r.h * 0.4);
            band.addColorStop(0, 'rgba(255,255,255,0)');
            band.addColorStop(0.5, 'rgba(255,255,255,0.09)');
            band.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = band;
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.restore();
          }
          const featuredHere = this.featured(t) === i;
          shape(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, radius - 0.5);
          ctx.strokeStyle = hover ? rgba(this.glow, 0.7) : featuredHere ? rgba(this.glow, 0.4) : INK.hair2;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (phone) {
            font(ctx, 9.5, 600);
            ctx.fillStyle = INK.text;
            wrap(ctx, projectData[key].title, r.x + 6, r.y + r.h - 24, r.w - 10, 11, 2);
            return;
          }
          this.pill(ctx, r.x + 10, r.y + 10, tags[key][0], 9.5);
          font(ctx, 14, 600);
          ctx.fillStyle = INK.text;
          const rows = ctx.measureText(projectData[key].title).width > r.w - 24 ? 2 : 1;
          wrap(ctx, projectData[key].title, r.x + 12, r.y + r.h - 10 - rows * 16.5, r.w - 24, 16.5, 2);
          shape(ctx, r.x + r.w - 30, r.y + 10, 20, 20, 10);
          ctx.fillStyle = hover ? this.accent.glow : 'rgba(255,255,255,0.08)';
          ctx.fill();
          arrow(ctx, r.x + r.w - 23.5, r.y + 16.5, 7, '#fff', 1.2);
        },
        (t) => {
          const s = shimmer(t);
          return !this.still && s > 0 && s < 1.05;
        }
      );
    });
    const h = hero!;
    this.items.push({
      rect: { x: h.x - 18, y: h.y - 18, w: h.w + 36, h: h.h + 36 },
      target: projects.length,
      live: () => !this.still,
      draw: (ctx, t, s) => this.heroPaint(ctx, h, t, s.hover === projects.length),
    });
    // When the carousel moves on, the cards repaint once to move the
    // "featured" ring. The detector runs once per update, shared by all four.
    const cards = this.items.filter((item) => item.target !== undefined && item.target < projects.length);
    let stamp = -1,
      result = false;
    cards.forEach((item) => {
      const inner = item.live!;
      item.live = (t, s) => {
        if (t !== stamp) {
          stamp = t;
          result = featureChanged(t);
        }
        return inner(t, s) || result;
      };
    });
  }

  private heroPaint(ctx: Ctx, r: Rect, t: number, hover: boolean) {
    const projects = this.cat.projects;
    const n = projects.length;
    const { phone, radius } = this.layout;
    const rad = phone ? radius : 18;
    const lift = hover ? (phone ? 1.5 : 3) : 0;
    const box = { ...r, y: r.y - lift };
    if (hover) this.glass(ctx, box, rad, true);
    const k = Math.floor(t / HERO_STEP);
    const local = t - k * HERO_STEP;
    const fade = smooth(local / HERO_FADE);
    const show = (j: number, alpha: number) => {
      const idx = ((j % n) + n) % n;
      const u = (t - j * HERO_STEP + HERO_FADE) / (HERO_STEP + HERO_FADE);
      const zoom = 1.03 + 0.09 * u;
      const dir = j % 2 ? 1 : -1;
      ctx.save();
      ctx.globalAlpha = alpha;
      shape(ctx, box.x, box.y, box.w, box.h, rad);
      ctx.clip();
      ctx.fillStyle = '#12141b';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      this.thumbs?.draw(ctx, projects[idx], box, zoom, 0.5 + dir * 0.25 * u, 0.35 + 0.2 * u);
      ctx.restore();
      return idx;
    };
    if (fade < 1) show(k - 1, 1);
    const current = show(k, fade);
    const shade = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    shade.addColorStop(0, 'rgba(7,8,11,0.25)');
    shade.addColorStop(0.45, 'rgba(7,8,11,0.05)');
    shade.addColorStop(1, 'rgba(7,8,11,0.92)');
    shape(ctx, box.x, box.y, box.w, box.h, rad);
    ctx.fillStyle = shade;
    ctx.fill();
    shape(ctx, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, rad - 0.5);
    ctx.strokeStyle = hover ? rgba(this.glow, 0.7) : INK.hair2;
    ctx.lineWidth = 1;
    ctx.stroke();
    const prev = (((k - 1) % n) + n) % n;
    const text = (idx: number, alpha: number) => {
      if (alpha <= 0.01) return;
      const key = projects[idx];
      ctx.save();
      ctx.globalAlpha = alpha;
      if (phone) {
        font(ctx, 10.5, 600);
        ctx.fillStyle = INK.text;
        wrap(ctx, projectData[key].title, box.x + 8, box.y + box.h - 30, box.w - 16, 12, 2);
      } else {
        font(ctx, 24, 600);
        ctx.fillStyle = INK.text;
        ctx.fillText(fit(ctx, projectData[key].title, box.w - 160), box.x + 22, box.y + box.h - 66);
        this.tagRow(ctx, key, box.x + 22, box.y + box.h - 34, box.w - 180, 9.5, 3);
      }
      ctx.restore();
    };
    text(prev, 1 - smooth(local / (HERO_FADE * 0.5)));
    text(current, smooth((local - HERO_FADE * 0.5) / (HERO_FADE * 0.5)));
    if (!phone) {
      this.pill(ctx, box.x + 18, box.y + 16, 'Featured', 10);
      // Carousel progress
      const bw = 22,
        gap = 6,
        bx = box.x + box.w - 22 - n * bw - (n - 1) * gap,
        by = box.y + box.h - 24;
      for (let i = 0; i < n; i++) {
        const x = bx + i * (bw + gap);
        shape(ctx, x, by, bw, 3, 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fill();
        const f = i === current ? clamp01(local / HERO_STEP) : 0;
        if (f > 0) {
          shape(ctx, x, by, bw * f, 3, 1.5);
          ctx.fillStyle = this.accent.glow;
          ctx.fill();
        }
      }
    } else {
      const d = 4;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i === current ? this.accent.glow : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(box.x + box.w - 8 - (n - 1 - i) * (d + 3), box.y + 9, d / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Right: a dashboard. Rail, project cards, a trend chart, a security scan. */
  private buildDashboard() {
    const { phone, rail, header } = this.layout;
    this.header(phone);
    if (!phone) {
      const chips = { x: header.x, y: header.y + header.h + 4, w: header.w, h: 64 };
      this.items.push({
        rect: chips,
        draw: (ctx) => {
          font(ctx, 10, 500);
          track(ctx, 0.14);
          ctx.fillStyle = INK.faint;
          ctx.fillText('SERVICES', chips.x, chips.y);
          track(ctx, 0);
          let x = chips.x,
            y = chips.y + 18;
          for (const label of ['Technical SEO', 'Site security', 'Performance', 'Local search', 'Analytics']) {
            font(ctx, 10.5, 500);
            const need = ctx.measureText(label).width + 10.5 * 1.5 + 8;
            if (x + need > chips.x + chips.w) {
              x = chips.x;
              y += 25;
            }
            x += this.pill(ctx, x, y, label, 10.5, false) + 7;
          }
        },
      });
    }
    if (rail) {
      this.items.push({
        rect: rail,
        draw: (ctx) => {
          ctx.fillStyle = 'rgba(255,255,255,0.012)';
          ctx.fillRect(rail.x, rail.y, rail.w, rail.h);
          ctx.fillStyle = INK.hair;
          ctx.fillRect(rail.x + rail.w - 1, rail.y, 1, rail.h);
          for (let i = 0; i < 5; i++) {
            const x = rail.x + 14,
              y = rail.y + 18 + i * 42;
            const on = i === 0;
            shape(ctx, x, y, 24, 24, 7);
            ctx.fillStyle = on ? rgba(this.glow, 0.14) : 'rgba(255,255,255,0)';
            ctx.fill();
            if (on) {
              ctx.strokeStyle = rgba(this.glow, 0.45);
              ctx.lineWidth = 0.9;
              ctx.stroke();
            }
            ctx.strokeStyle = on ? this.accent.light : INK.dim;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            const cx = x + 12,
              cy = y + 12;
            if (i === 0) {
              ctx.rect(cx - 5, cy - 5, 4, 4);
              ctx.rect(cx + 1, cy - 5, 4, 4);
              ctx.rect(cx - 5, cy + 1, 4, 4);
              ctx.rect(cx + 1, cy + 1, 4, 4);
            } else if (i === 1) {
              ctx.moveTo(cx - 5, cy + 4);
              ctx.lineTo(cx - 1, cy - 1);
              ctx.lineTo(cx + 2, cy + 2);
              ctx.lineTo(cx + 6, cy - 4);
            } else if (i === 2) {
              ctx.moveTo(cx, cy - 6);
              ctx.lineTo(cx + 5, cy - 4);
              ctx.lineTo(cx + 5, cy);
              ctx.quadraticCurveTo(cx + 5, cy + 4, cx, cy + 6);
              ctx.quadraticCurveTo(cx - 5, cy + 4, cx - 5, cy);
              ctx.lineTo(cx - 5, cy - 4);
              ctx.closePath();
            } else if (i === 3) {
              ctx.arc(cx, cy, 5, 0, Math.PI * 2);
              ctx.moveTo(cx + 5, cy);
              ctx.ellipse(cx, cy, 2.2, 5, 0, 0, Math.PI * 2);
            } else {
              ctx.arc(cx, cy, 2, 0, Math.PI * 2);
              ctx.moveTo(cx + 5.5, cy);
              ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
            }
            ctx.stroke();
          }
        },
      });
    }
    const projects = this.cat.projects;
    projects.forEach((key, i) => {
      this.cardItem(i, (ctx, r, hover) => {
        const radius = this.layout.radius;
        this.glass(ctx, r, radius, hover);
        if (phone) {
          const img = { x: r.x + 4, y: r.y + 4, w: 62, h: r.h - 8 };
          this.thumb(ctx, key, img, 5, hover);
          font(ctx, 7.5, 600);
          track(ctx, 0.08);
          ctx.fillStyle = this.accent.light;
          ctx.fillText(tags[key][0].toUpperCase(), img.x + img.w + 8, r.y + 8);
          track(ctx, 0);
          font(ctx, 11, 600);
          ctx.fillStyle = INK.text;
          wrap(ctx, projectData[key].title, img.x + img.w + 8, r.y + 19, r.w - img.w - 18, 12, 2);
          return;
        }
        const img = { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: 128 };
        this.thumb(ctx, key, img, 10, hover);
        this.tagRow(ctx, key, r.x + 14, img.y + img.h + 12, r.w - 28, 9.5);
        font(ctx, 16, 600);
        ctx.fillStyle = INK.text;
        ctx.fillText(fit(ctx, projectData[key].title, r.w - 50), r.x + 14, img.y + img.h + 40);
        font(ctx, 11.5, 500);
        ctx.fillStyle = hover ? this.accent.light : INK.dim;
        ctx.fillText('View case study', r.x + 14, r.y + r.h - 24);
        arrow(ctx, r.x + r.w - 26, r.y + r.h - 25, 8, hover ? this.accent.light : INK.dim);
      });
    });
    const [chart, security] = this.layout.panels;
    this.items.push({ rect: chart, live: () => !this.still, draw: (ctx, t) => this.chart(ctx, chart, t) });
    this.items.push({ rect: security, live: () => !this.still, draw: (ctx, t) => this.security(ctx, security, t) });
  }

  private panelTitle(ctx: Ctx, r: Rect, title: string) {
    const phone = this.layout.phone;
    font(ctx, phone ? 7.5 : 10, 500);
    track(ctx, 0.14);
    ctx.fillStyle = INK.dim;
    ctx.fillText(title.toUpperCase(), r.x + (phone ? 8 : 16), r.y + (phone ? 7 : 15));
    track(ctx, 0);
  }

  private chart(ctx: Ctx, r: Rect, t: number) {
    const phone = this.layout.phone;
    this.glass(ctx, r, phone ? 7 : 16);
    this.panelTitle(ctx, r, 'Search visibility');
    const inset = phone ? 8 : 16;
    const area = { x: r.x + inset, y: r.y + (phone ? 22 : 44), w: r.w - inset * 2, h: r.h - (phone ? 30 : 60) };
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = Math.round(area.y + (area.h * i) / 3) + 0.5;
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
      ctx.stroke();
    }
    // A decorative rising line (no values, no axes).
    const shapeY = [0.82, 0.74, 0.78, 0.63, 0.66, 0.52, 0.56, 0.42, 0.45, 0.31, 0.27, 0.16];
    const pts = shapeY.map((v, i) => [area.x + (area.w * i) / (shapeY.length - 1), area.y + area.h * v]);
    const cycle = 7;
    const local = t % cycle;
    const draw = outCubic(local / 2.4);
    const fadeOut = 1 - smooth((local - 6.2) / 0.6);
    const until = area.x + area.w * draw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x - 2, area.y - 8, until - area.x + 4, area.h + 16);
    ctx.clip();
    ctx.globalAlpha = fadeOut;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        const mx = (x0 + x1) / 2;
        ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
      }
    };
    trace();
    ctx.lineTo(area.x + area.w, area.y + area.h);
    ctx.lineTo(area.x, area.y + area.h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    fill.addColorStop(0, rgba(this.glow, 0.26));
    fill.addColorStop(1, rgba(this.glow, 0));
    ctx.fillStyle = fill;
    ctx.fill();
    trace();
    ctx.strokeStyle = this.accent.glow;
    ctx.lineWidth = phone ? 1.3 : 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    // Leading dot
    let ey = pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= until) {
        const [x0, y0] = pts[i - 1],
          [x1, y1] = pts[i];
        const f = smooth((until - x0) / (x1 - x0));
        ey = y0 + (y1 - y0) * f;
        break;
      }
    }
    ctx.globalAlpha = fadeOut;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = rgba(this.glow, 0.25 + 0.2 * pulse);
    ctx.beginPath();
    ctx.arc(until, ey, (phone ? 3 : 6) + pulse * (phone ? 1 : 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(until, ey, phone ? 1.3 : 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private security(ctx: Ctx, r: Rect, t: number) {
    const phone = this.layout.phone;
    this.glass(ctx, r, phone ? 7 : 16);
    this.panelTitle(ctx, r, 'Security');
    const rows: [string, string][] = phone
      ? [
          ['SSL / TLS', 'Active'],
          ['Firewall', 'Active'],
          ['Malware scan', 'Clean'],
        ]
      : [
          ['SSL / TLS', 'Active'],
          ['Firewall', 'Active'],
          ['Malware scan', 'Clean'],
          ['Backups', 'On'],
        ];
    const top = r.y + (phone ? 21 : 46),
      rh = phone ? 16 : 38,
      inset = phone ? 8 : 16;
    const period = 3.2;
    const scan = top - 6 + ((t % period) / period) * (rows.length * rh + 12);
    rows.forEach(([name, state], i) => {
      const y = top + i * rh;
      const near = 1 - clamp01(Math.abs(scan - (y + rh / 2)) / rh);
      if (!phone) {
        ctx.fillStyle = INK.hair;
        if (i) ctx.fillRect(r.x + inset, y, r.w - inset * 2, 1);
      }
      const s = phone ? 8 : 16;
      const cy = y + (rh - s) / 2;
      ctx.fillStyle = rgba(this.glow, 0.1 + 0.25 * near);
      ctx.beginPath();
      ctx.arc(r.x + inset + s / 2, cy + s / 2, s / 2, 0, Math.PI * 2);
      ctx.fill();
      check(ctx, r.x + inset + s * 0.27, cy + s * 0.27, s * 0.46, this.accent.light);
      font(ctx, phone ? 8 : 12, 500);
      ctx.fillStyle = near > 0.3 ? INK.text : INK.soft;
      ctx.fillText(name, r.x + inset + s + (phone ? 5 : 10), cy + (s - (phone ? 8 : 12)) / 2);
      font(ctx, phone ? 7.5 : 11, 400);
      ctx.fillStyle = INK.dim;
      ctx.textAlign = 'right';
      ctx.fillText(state, r.x + r.w - inset, cy + (s - (phone ? 7.5 : 11)) / 2);
      ctx.textAlign = 'left';
    });
    // Scan line
    ctx.save();
    shape(ctx, r.x, r.y, r.w, r.h, phone ? 7 : 16);
    ctx.clip();
    const trail = ctx.createLinearGradient(0, scan - (phone ? 14 : 28), 0, scan);
    trail.addColorStop(0, rgba(this.glow, 0));
    trail.addColorStop(1, rgba(this.glow, 0.12));
    ctx.fillStyle = trail;
    ctx.fillRect(r.x, scan - (phone ? 14 : 28), r.w, phone ? 14 : 28);
    const line = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    line.addColorStop(0, rgba(this.glow, 0));
    line.addColorStop(0.5, rgba(this.glow, 0.9));
    line.addColorStop(1, rgba(this.glow, 0));
    ctx.fillStyle = line;
    ctx.fillRect(r.x, scan, r.w, phone ? 0.8 : 1.4);
    ctx.restore();
  }
}
