import * as THREE from 'three';
import { readAccent } from '@/lib/accent';

/**
 * The device screen as a scrollable canvas texture.
 *
 * The full About-Me page is drawn ONCE onto a tall canvas and uploaded to the
 * GPU a single time. "Scrolling" is done purely by shifting `texture.offset.y`
 * (a cheap shader-uniform change) — no per-frame canvas redraw and no texture
 * re-upload, so it stays smooth on every device. Because it is the screen
 * surface itself, it is pixel-aligned regardless of DPR / viewport quirks.
 *
 * The content mirrors the page's <AboutSection>.
 */
export interface ScreenSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number) => void;
}

// ── Content (kept in sync with components/AboutSection.tsx) ──
const BIO1 =
  "Hi, I'm Ahnaf Hussain — Head of Web Development at AurixLab. I lead a development team building high-performance websites, SaaS frontends, and data-driven digital products for clients across North America. Currently finishing my degree at BRAC University while running a professional engineering team full-time.";
const BIO2 =
  'My focus is on systems architecture — building internal boilerplates, component standards, and development workflows that let my team consistently deliver 90+ SEO scores, GSAP-driven interactivity, and scalable frontend infrastructure at speed.';
const SKILLS = ['Next.js', 'WordPress', 'Shopify', 'Python', 'Systems Architecture', 'GSAP', 'Team Leadership', 'SEO', 'Data Science'];
const BLOCKS: { h: string; items: string[] }[] = [
  {
    h: 'My Journey',
    items: [
      'Joined AurixLab in August 2025 and rapidly advanced from technical specialist to leading the entire development function',
      'Architected Mission Control — a full-stack internal PM system used by all 11 team members daily, replacing fragmented Slack threads and spreadsheets',
      'Established frontend standards and boilerplates adopted across all client projects at AurixLab',
    ],
  },
  {
    h: 'What Drives Me',
    items: [
      'Building systems that scale — internal tooling, team workflows, and frontend architectures that outlast any single project',
      'The intersection of engineering rigour and design quality: products that perform, convert, and look world-class',
    ],
  },
  {
    h: 'How I Work',
    items: [
      'Architecture-first: define the system before writing a line of code',
      'Lead by doing — from recovering hacked production sites to directing GSAP animation pipelines across a team',
      'Raise the floor, not just the ceiling: standards, documentation, and repeatable processes over heroic one-off fixes',
    ],
  },
];

interface Cfg {
  cw: number; padX: number; planeAspect: number;
  eyebrow: number; title: number; titleLH: number;
  body: number; bodyLH: number; head: number;
  bullet: number; bulletLH: number; chip: number;
}

const CFG: Record<'laptop' | 'phone', Cfg> = {
  laptop: {
    cw: 1200, padX: 84, planeAspect: 2.92 / 1.87,
    eyebrow: 24, title: 76, titleLH: 86, body: 34, bodyLH: 50, head: 50, bullet: 31, bulletLH: 46, chip: 29,
  },
  // Phone texture kept light for mobile GPUs. Sizes are small so the (much
  // longer) content doesn't blow past mobile max-texture height.
  phone: {
    cw: 384, padX: 30, planeAspect: 1.36 / 2.88,
    eyebrow: 15, title: 34, titleLH: 40, body: 21, bodyLH: 30, head: 27, bullet: 20, bulletLH: 28, chip: 18,
  },
};

const TEXT = 'rgba(214,208,196,0.94)';
const WHITE = '#f5f1e9';

function roundRect(ctx: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + w, py, px + w, py + h, r);
  ctx.arcTo(px + w, py + h, px, py + h, r);
  ctx.arcTo(px, py + h, px, py, r);
  ctx.arcTo(px, py, px + w, py, r);
  ctx.closePath();
}

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
  const maxW = cw - padX * 2;

  // Single layout fn: draw=false measures total height, draw=true paints.
  // NOTE: fonts are set in BOTH passes so measureText (and thus wrapping/height)
  // is accurate; only colours are gated behind `draw`.
  const layout = (ctx: CanvasRenderingContext2D, draw: boolean): number => {
    let y = padX + f.eyebrow;

    // Eyebrow
    ctx.font = `600 ${f.eyebrow}px system-ui, sans-serif`;
    if (draw) { ctx.fillStyle = rgba(0.9); ctx.fillText('A B O U T   M E', padX, y); }
    y += f.title * 0.62;

    // Title (two lines: accent then white)
    ctx.font = `800 ${f.title}px "Syne", system-ui, sans-serif`;
    if (draw) ctx.fillStyle = a.glow;
    y = wrap(ctx, 'Technical leader by role,', padX, y, maxW, f.titleLH, draw);
    if (draw) ctx.fillStyle = WHITE;
    y = wrap(ctx, 'architect by craft.', padX, y, maxW, f.titleLH, draw);
    y += f.body * 0.3;

    // Divider
    if (draw) { ctx.fillStyle = a.glow; ctx.fillRect(padX, y, cw * 0.16, Math.max(4, cw * 0.005)); }
    y += f.body * 1.5;

    const para = (t: string) => {
      ctx.font = `400 ${f.body}px system-ui, sans-serif`;
      if (draw) ctx.fillStyle = TEXT;
      y = wrap(ctx, t, padX, y, maxW, f.bodyLH, draw);
      y += f.body * 0.6;
    };
    para(BIO1);
    para(BIO2);
    y += f.body * 0.4;

    // Skill chips
    const chH = f.chip * 2.0;
    const inner = f.chip * 0.8;
    const gap = f.chip * 0.55;
    ctx.font = `500 ${f.chip}px system-ui, sans-serif`;
    let cx = padX;
    for (const tag of SKILLS) {
      const tw = ctx.measureText(tag).width + inner * 2;
      if (cx + tw > cw - padX) { cx = padX; y += chH + gap; }
      if (draw) {
        roundRect(ctx, cx, y, tw, chH, chH / 2);
        ctx.fillStyle = rgba(0.08); ctx.fill();
        ctx.strokeStyle = rgba(0.4); ctx.lineWidth = Math.max(1, cw * 0.0015); ctx.stroke();
        ctx.fillStyle = WHITE;
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, cx + inner, y + chH / 2 + 1);
        ctx.textBaseline = 'alphabetic';
      }
      cx += tw + gap;
    }
    y += chH + f.head * 0.7;

    // Journey blocks
    for (const block of BLOCKS) {
      // heading with left accent bar
      ctx.font = `700 ${f.head}px "Syne", system-ui, sans-serif`;
      if (draw) {
        ctx.fillStyle = a.glow;
        ctx.fillRect(padX, y - f.head * 0.74, Math.max(4, cw * 0.006), f.head);
        ctx.fillStyle = WHITE;
        ctx.fillText(block.h, padX + cw * 0.028, y);
      }
      y += f.head * 1.05;

      for (const item of block.items) {
        if (draw) {
          ctx.fillStyle = a.glow;
          ctx.beginPath();
          ctx.arc(padX + f.bullet * 0.32, y - f.bullet * 0.34, f.bullet * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = TEXT;
        }
        ctx.font = `400 ${f.bullet}px system-ui, sans-serif`;
        y = wrap(ctx, item, padX + f.bullet * 1.05, y, maxW - f.bullet * 1.05, f.bulletLH, draw);
        y += f.bullet * 0.5;
      }
      y += f.head * 0.5;
    }

    return y + padX;
  };

  // Measure pass (needs a real ctx for measureText).
  const measure = document.createElement('canvas');
  measure.width = cw; measure.height = 16;
  const ch = Math.min(4096, Math.ceil(layout(measure.getContext('2d')!, false)));

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

  // Show a window of the texture matching the screen-plane aspect; scroll via offset.
  const windowH = cw / f.planeAspect;
  const repeatY = Math.min(1, windowH / ch);
  texture.repeat.set(1, repeatY);
  const topOffset = 1 - repeatY;
  texture.offset.set(0, topOffset);

  // Redraw once when the brand font loads (one extra upload, not per frame).
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }

  const render = (scroll01: number) => {
    const s = THREE.MathUtils.clamp(scroll01, 0, 1);
    texture.offset.y = topOffset * (1 - s); // top → bottom (bottomOffset = 0)
  };

  return { texture, render };
}
