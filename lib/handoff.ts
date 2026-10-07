/* Section-to-section "handoffs": an object that leaves one section and
   lands in the next as you scroll (a chrome droplet falling from the hero
   onto the showcase title, a clay key popping off the laptop, ...). Driven by
   components/handoff/HandoffLayer.tsx: one fixed overlay, one 2D canvas and
   one loop for all of them. Each handoff is a pure function of where its
   sections are on screen, so scrolling back up plays it in reverse.

   The About cube's flight into Impacts predates this and stays in
   ImpactsSection (its burst is part of the Impacts pin); it uses the same
   idea through lib/coreHandoff.ts. */

/** A point inside a WebGL scene, published every frame by that scene so a
    handoff can start or land exactly on it. Position is relative to `canvas`. */
export interface Anchor {
  canvas: HTMLElement | null;
  x: number;
  y: number;
  /** On-screen size of the thing at the anchor, in CSS px. */
  size: number;
  /** performance.now() of the last publish; stale anchors are ignored. */
  at: number;
  /** 0..1, written by a handoff: how strongly the scene should light the
      anchored object up (e.g. the moment something lands on it). */
  pulse: number;
}

const anchors = new Map<string, Anchor>();

export function getAnchor(id: string): Anchor {
  let a = anchors.get(id);
  if (!a) {
    a = { canvas: null, x: 0, y: 0, size: 0, at: 0, pulse: 0 };
    anchors.set(id, a);
  }
  return a;
}

/** The anchor's position in viewport px, or null if it isn't live. */
export function anchorPoint(id: string, maxAgeMs = 600): { x: number; y: number; size: number } | null {
  const a = anchors.get(id);
  if (!a || !a.canvas?.isConnected || performance.now() - a.at > maxAgeMs) return null;
  const r = a.canvas.getBoundingClientRect();
  return { x: r.left + a.x, y: r.top + a.y, size: a.size };
}

export interface HandoffEnv {
  vw: number;
  vh: number;
  phone: boolean;
  /** seconds */
  time: number;
  layer: HTMLElement;
  ctx: CanvasRenderingContext2D;
  /** Accent colour as "r,g,b". */
  accent: string;
}

export interface Handoff<S = unknown> {
  id: string;
  /** Sections whose nearness switches this handoff on. */
  zone(): Array<Element | null>;
  /** Layout reads only. Returns null when there's nothing to show. */
  read(env: HandoffEnv): S | null;
  /** Writes only (styles, canvas drawing). */
  write(state: S, env: HandoffEnv): void;
  /** Put everything back (source restored, overlay pieces hidden). */
  hide(env: HandoffEnv): void;
  /** Whether to draw on the shared canvas (it's cleared only when needed). */
  usesCanvas: boolean;
  /** Skip on phones. */
  desktopOnly?: boolean;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const bell = (t: number) => Math.sin(Math.PI * clamp01(t));

/** 0 → 1 as `el`'s top travels from `from` to `to` (fractions of the viewport height). */
export function topProgress(el: Element | null, vh: number, from = 1, to = 0): number | null {
  if (!el) return null;
  const top = el.getBoundingClientRect().top;
  return clamp01((vh * from - top) / (vh * (from - to)));
}

/** Seeded random, so every visit gets the same particles. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A looping sprite sheet rendered in Blender (public/images/handoff/):
    `frames` square cells, `cols` per row. Loads on first use. */
export interface Sprite { img: HTMLImageElement; frames: number; cols: number; cell: number; ready: boolean; tinted: HTMLCanvasElement | null }
const sprites = new Map<string, Sprite>();
export function sprite(url: string, frames: number, cols: number): Sprite {
  let s = sprites.get(url);
  if (!s) {
    const img = new Image();
    img.decoding = 'async';
    const made: Sprite = { img, frames, cols, cell: 0, ready: false, tinted: null };
    img.onload = () => { made.cell = img.naturalWidth / cols; made.ready = true; };
    img.src = url;
    sprites.set(url, (s = made));
  }
  return s;
}

/** The sheet multiplied by the accent colour (for the matte clay), made once. */
export function tintSprite(s: Sprite, rgb: string) {
  if (!s.ready || s.tinted) return;
  const c = document.createElement('canvas');
  c.width = s.img.naturalWidth; c.height = s.img.naturalHeight;
  const g = c.getContext('2d');
  if (!g) return;
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${rgb})`;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(s.img, 0, 0);
  s.tinted = c;
}

/** Draws frame `f` centred on (x, y), `size` px across, stretched by
    (sx, sy) along an axis rotated by `rot`. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, f: number, x: number, y: number, size: number, rot = 0, sx = 1, sy = 1, alpha = 1) {
  if (!s.ready || alpha <= 0) return;
  const i = ((Math.floor(f) % s.frames) + s.frames) % s.frames;
  const src = s.tinted ?? s.img;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.drawImage(src, (i % s.cols) * s.cell, Math.floor(i / s.cols) * s.cell, s.cell, s.cell, -size / 2, -size / 2, size, size);
  ctx.restore();
}
