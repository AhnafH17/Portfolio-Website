import * as THREE from 'three';
import {
  siNextdotjs, siReact, siTypescript, siGreensock,
  siThreedotjs, siWordpress, siShopify, siPython,
} from 'simple-icons';
import { readAccent } from '@/lib/accent';

/**
 * The device screen as a scrollable canvas texture.
 *
 * The full About-Me page is drawn ONCE onto a tall canvas and uploaded to the
 * GPU a single time. "Scrolling" is done purely by shifting `texture.offset.y`
 * (a cheap shader-uniform change) — no per-frame canvas redraw and no texture
 * re-upload, so it stays smooth on every device. Because it is the screen
 * surface itself, it is pixel-aligned regardless of DPR / viewport quirks.
 */
export interface ScreenSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number) => void;
}

const ICONS = [siNextdotjs, siReact, siTypescript, siGreensock, siThreedotjs, siWordpress, siShopify, siPython];

interface Cfg {
  cw: number; padX: number; planeAspect: number;
  name: number; head: number; role: number; body: number; bodyLH: number;
  bullet: number; bulletLH: number; eyebrow: number; logo: number;
}

const CFG: Record<'laptop' | 'phone', Cfg> = {
  laptop: {
    cw: 1200, padX: 84, planeAspect: 2.92 / 1.87,
    name: 112, head: 54, role: 34, body: 32, bodyLH: 47, bullet: 30, bulletLH: 45, eyebrow: 23, logo: 96,
  },
  // Phone texture kept light for mobile GPUs (~2.8 MB VRAM: 384 × ~1.8k × 4 bytes).
  // Sizes are the desktop proportions scaled ~0.565, so the layout is identical,
  // just rendered at lower pixel density.
  phone: {
    cw: 384, padX: 32, planeAspect: 1.36 / 2.88,
    name: 54, head: 33, role: 20, body: 20, bodyLH: 30, bullet: 20, bulletLH: 30, eyebrow: 15, logo: 52,
  },
};

const NAME = '#f5f1e9';

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, draw: boolean): number {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      if (draw) ctx.fillText(line, x, y);
      line = w; y += lh;
    } else line = test;
  }
  if (draw && line) ctx.fillText(line, x, y);
  return y + lh;
}

export function createScreenSurface(kind: 'laptop' | 'phone'): ScreenSurface {
  const a = readAccent();
  const f = CFG[kind];
  const { cw, padX } = f;
  const rgba = (o: number) => `rgba(${a.r},${a.g},${a.b},${o})`;

  // One layout function — run once to measure (draw=false), once to paint.
  const layout = (ctx: CanvasRenderingContext2D, draw: boolean): number => {
    let y = padX + f.eyebrow + 28;

    if (draw) {
      ctx.fillStyle = rgba(0.9);
      ctx.font = `600 ${f.eyebrow}px system-ui, sans-serif`;
      ctx.fillText('W H O   I   A M', padX, y - f.name * 0.72);
    }

    if (draw) { ctx.fillStyle = NAME; ctx.font = `800 ${f.name}px "Syne", system-ui, sans-serif`; ctx.fillText('Ahnaf', padX, y); }
    y += f.name * 0.95;
    if (draw) ctx.fillText('Hussain', padX, y);
    y += f.name * 0.34;

    if (draw) { ctx.fillStyle = a.glow; ctx.fillRect(padX, y, cw * 0.18, Math.max(4, cw * 0.006)); }
    y += f.role * 1.7;

    if (draw) { ctx.fillStyle = rgba(0.95); ctx.font = `600 ${f.role}px system-ui, sans-serif`; ctx.fillText('Head of Web Development · AurixLab', padX, y); }
    y += f.head * 1.7;

    const heading = (t: string) => {
      if (draw) {
        ctx.fillStyle = a.glow;
        ctx.fillRect(padX, y - f.head * 0.78, Math.max(5, cw * 0.007), f.head);
        ctx.fillStyle = NAME;
        ctx.font = `700 ${f.head}px "Syne", system-ui, sans-serif`;
        ctx.fillText(t, padX + cw * 0.03, y);
      }
      y += f.head * 1.15;
    };
    const para = (t: string) => {
      if (draw) { ctx.fillStyle = 'rgba(214,208,196,0.94)'; ctx.font = `400 ${f.body}px system-ui, sans-serif`; }
      y = wrap(ctx, t, padX, y, cw - padX * 2, f.bodyLH, draw);
      y += f.body * 0.55;
    };
    const bullet = (t: string) => {
      if (draw) {
        ctx.fillStyle = a.glow;
        ctx.beginPath();
        ctx.arc(padX + f.bullet * 0.35, y - f.bullet * 0.32, f.bullet * 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(214,208,196,0.94)';
        ctx.font = `400 ${f.bullet}px system-ui, sans-serif`;
      }
      y = wrap(ctx, t, padX + f.bullet * 1.1, y, cw - padX * 2 - f.bullet * 1.1, f.bulletLH, draw);
      y += f.bullet * 0.45;
    };

    heading('My Journey');
    para('I started out obsessed with how interfaces feel — the weight of a transition, the rhythm of a layout. That obsession became a career building high-performance frontends and interactive experiences.');
    para('Today I lead the web team at AurixLab, shipping SaaS products and marketing sites that are fast, accessible, and a little bit unexpected.');
    y += f.head * 0.6;

    heading('How I Work');
    bullet('Performance first — every animation earns its frame budget.');
    bullet('Design and engineering are one loop, not two steps.');
    bullet('Ship, measure, refine. Real devices over assumptions.');
    bullet('The details are the product.');
    y += f.head * 0.6;

    heading('Toolkit');
    // Logo collage — two rows of four, static.
    const cols = 4;
    const gap = (cw - padX * 2 - cols * f.logo) / (cols - 1);
    const startY = y;
    ICONS.forEach((ic, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lx = padX + col * (f.logo + gap);
      const ly = startY + row * (f.logo + f.logo * 0.7);
      if (draw) {
        const p = new Path2D(ic.path);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.scale(f.logo / 24, f.logo / 24);
        ctx.shadowColor = a.glow;
        ctx.shadowBlur = 60;
        ctx.fillStyle = '#f5f1e9';
        ctx.fill(p);
        ctx.restore();
      }
    });
    y = startY + 2 * (f.logo + f.logo * 0.7) + padX;

    return y;
  };

  // Measure pass (needs a real ctx for measureText).
  const measure = document.createElement('canvas');
  measure.width = cw; measure.height = 16;
  const ch = Math.ceil(layout(measure.getContext('2d')!, false));

  // Paint pass.
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const paint = () => {
    ctx.fillStyle = '#090d13';
    ctx.fillRect(0, 0, cw, ch);
    const wash = ctx.createRadialGradient(cw * 0.2, 80, 0, cw * 0.2, 80, cw * 1.1);
    wash.addColorStop(0, rgba(0.22));
    wash.addColorStop(0.5, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, cw, ch);
    layout(ctx, true);
  };
  paint();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;

  // Show a window of the texture matching the screen-plane aspect, scroll via offset.
  const windowH = cw / f.planeAspect;          // px of content visible at once
  const repeatY = Math.min(1, windowH / ch);
  texture.repeat.set(1, repeatY);
  const topOffset = 1 - repeatY;               // v-offset showing the very top
  const bottomOffset = 1 - Math.min(ch, ch) / ch; // = 0 (shows bottom)
  texture.offset.set(0, topOffset);

  // Redraw once when the brand font finishes loading (one extra upload, not per frame).
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }

  const render = (scroll01: number) => {
    const s = THREE.MathUtils.clamp(scroll01, 0, 1);
    texture.offset.y = topOffset + (bottomOffset - topOffset) * s;
  };

  return { texture, render };
}
