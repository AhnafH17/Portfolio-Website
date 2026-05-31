import * as THREE from 'three';
import { siNextdotjs, siWordpress, siShopify, siPython, siGreensock } from 'simple-icons';
import { readAccent } from '@/lib/accent';

/**
 * The device screen as a scrollable canvas texture.
 *
 * The full About page is drawn ONCE onto a tall canvas and uploaded to the GPU
 * a single time. Scrolling shifts `texture.offset.y` (a cheap uniform) — no
 * per-frame redraw / re-upload, so it's smooth on every device, and pixel-
 * aligned because it IS the screen surface. Content mirrors <AboutSection>.
 */
export interface ScreenSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number) => void;
}

// ── Content (kept in sync with components/AboutSection.tsx) ──
type Seg = { t: string; accent?: boolean; strong?: boolean };
const BIO1: Seg[] = [
  { t: "Hi, I'm " },
  { t: 'Ahnaf Hussain', accent: true },
  { t: ' — Head of Web Development at ' },
  { t: 'AurixLab', accent: true },
  { t: '. I lead a development team building high-performance websites, SaaS frontends, and data-driven digital products for clients across North America. Currently finishing my degree at ' },
  { t: 'BRAC University', accent: true },
  { t: ' while running a professional engineering team full-time.' },
];
const BIO2: Seg[] = [
  { t: 'My focus is on ' },
  { t: 'systems architecture', strong: true },
  { t: ' — building internal boilerplates, component standards, and development workflows that let my team consistently deliver ' },
  { t: '90+ SEO scores', strong: true },
  { t: ', GSAP-driven interactivity, and scalable frontend infrastructure at speed.' },
];
const SKILLS = ['Next.js', 'WordPress', 'Shopify', 'Python', 'Systems Architecture', 'GSAP', 'Team Leadership', 'SEO', 'Data Science'];
const ICON: Record<string, { path: string } | undefined> = {
  'Next.js': siNextdotjs, WordPress: siWordpress, Shopify: siShopify, Python: siPython, GSAP: siGreensock,
};
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
  cw: number; padX: number; planeAspect: number; cols: number;
  eyebrow: number; title: number; titleLH: number;
  body: number; bodyLH: number; head: number; num: number;
  bullet: number; bulletLH: number; label: number;
}
const CFG: Record<'laptop' | 'phone', Cfg> = {
  laptop: {
    cw: 1200, padX: 92, planeAspect: 2.92 / 1.87, cols: 3,
    eyebrow: 25, title: 78, titleLH: 88, body: 33, bodyLH: 51, head: 46, num: 30, bullet: 30, bulletLH: 46, label: 26,
  },
  phone: {
    cw: 430, padX: 34, planeAspect: 1.36 / 2.88, cols: 2,
    eyebrow: 16, title: 42, titleLH: 49, body: 22, bodyLH: 33, head: 30, num: 18, bullet: 21, bulletLH: 31, label: 18,
  },
};

const TEXT = 'rgba(208,202,190,0.92)';
const WHITE = '#f6f2ea';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createScreenSurface(kind: 'laptop' | 'phone'): ScreenSurface {
  const a = readAccent();
  const f = CFG[kind];
  const { cw, padX } = f;
  const rgba = (o: number) => `rgba(${a.r},${a.g},${a.b},${o})`;
  const maxW = cw - padX * 2;
  const SYNE = '"Syne", system-ui, sans-serif';
  const SANS = 'system-ui, -apple-system, sans-serif';
  const hair = Math.max(1, cw * 0.0014);

  // simple word-wrap; returns next y
  const wrap = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number, draw: boolean) => {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w && line) {
        if (draw) ctx.fillText(line, x, y);
        line = word; y += lh;
      } else line = test;
    }
    if (draw && line) ctx.fillText(line, x, y);
    return y + lh;
  };

  // rich wrap with inline accent/strong highlights
  const wrapRich = (ctx: CanvasRenderingContext2D, segs: Seg[], x: number, y: number, w: number, lh: number, draw: boolean) => {
    const tokens: { w: string; color: string; font: string }[] = [];
    for (const s of segs) {
      const color = s.accent ? a.glow : s.strong ? WHITE : TEXT;
      const font = `${s.accent || s.strong ? 600 : 400} ${f.body}px ${SANS}`;
      for (const part of s.t.split(' ')) {
        if (part === '') continue;
        tokens.push({ w: part, color, font });
      }
    }
    let lx = x; let cy = y; let first = true;
    for (const tk of tokens) {
      ctx.font = tk.font;
      const noSpace = /^[.,;:!?)]/.test(tk.w);
      const sp = first || noSpace ? 0 : ctx.measureText(' ').width;
      const ww = ctx.measureText(tk.w).width;
      if (!first && lx + sp + ww > x + w) { cy += lh; lx = x; first = true; }
      const dx = lx + (first ? 0 : sp);
      if (draw) { ctx.fillStyle = tk.color; ctx.fillText(tk.w, dx, cy); }
      lx = dx + ww; first = false;
    }
    return cy + lh;
  };

  const drawIconTile = (ctx: CanvasRenderingContext2D, skill: string, cx: number, cy: number, size: number) => {
    roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.26);
    ctx.fillStyle = rgba(0.1); ctx.fill();
    ctx.strokeStyle = rgba(0.22); ctx.lineWidth = hair; ctx.stroke();
    const ic = ICON[skill];
    if (ic) {
      const g = size * 0.5;
      ctx.save();
      ctx.translate(cx - g / 2, cy - g / 2);
      ctx.scale(g / 24, g / 24);
      ctx.fillStyle = WHITE;
      ctx.fill(new Path2D(ic.path));
      ctx.restore();
    } else {
      ctx.fillStyle = a.glow;
      ctx.font = `700 ${size * 0.46}px ${SYNE}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(skill[0], cx, cy + size * 0.03);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  };

  // ── Layout (draw=false measures, draw=true paints) ──
  const layout = (ctx: CanvasRenderingContext2D, draw: boolean): number => {
    let y = padX;

    // Eyebrow with leading dash
    ctx.font = `600 ${f.eyebrow}px ${SANS}`;
    y += f.eyebrow;
    if (draw) {
      ctx.fillStyle = a.glow;
      ctx.fillRect(padX, y - f.eyebrow * 0.34, f.eyebrow * 1.4, hair * 2);
      ctx.fillText('ABOUT ME', padX + f.eyebrow * 2, y);
    }
    y += f.title * 0.7;

    // Title — two lines, two-tone
    ctx.font = `800 ${f.title}px ${SYNE}`;
    if (draw) ctx.fillStyle = a.glow;
    y = wrap(ctx, 'Technical leader by role,', padX, y, maxW, f.titleLH, draw);
    if (draw) ctx.fillStyle = WHITE;
    y = wrap(ctx, 'architect by craft.', padX, y, maxW, f.titleLH, draw);
    y += f.body * 0.9;

    // Bio
    y = wrapRich(ctx, BIO1, padX, y, maxW, f.bodyLH, draw);
    y += f.body * 0.8;
    y = wrapRich(ctx, BIO2, padX, y, maxW, f.bodyLH, draw);
    y += f.head * 0.9;

    // Section label
    const sectionLabel = (t: string) => {
      ctx.font = `600 ${f.eyebrow}px ${SANS}`;
      if (draw) {
        ctx.fillStyle = a.glow;
        ctx.fillRect(padX, y - f.eyebrow * 0.34, f.eyebrow * 1.4, hair * 2);
        ctx.fillText(t, padX + f.eyebrow * 2, y);
      }
      y += f.eyebrow * 1.9;
    };
    sectionLabel('TOOLKIT & EXPERTISE');

    // Skill grid
    const cols = f.cols;
    const gap = f.label * 0.7;
    const cardW = (maxW - gap * (cols - 1)) / cols;
    const tile = f.label * 2.1;
    const cardH = tile + f.label * 0.9 + f.label * 2.4 * 2 * 0.62 + f.label * 0.6;
    SKILLS.forEach((skill, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = padX + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      if (draw) {
        roundRect(ctx, cx, cy, cardW, cardH, f.label * 0.7);
        ctx.fillStyle = 'rgba(255,255,255,0.028)'; ctx.fill();
        ctx.strokeStyle = rgba(0.12); ctx.lineWidth = hair; ctx.stroke();
        drawIconTile(ctx, skill, cx + cardW / 2, cy + tile / 2 + f.label * 0.7, tile);
        // label (centered, up to 2 lines)
        ctx.font = `500 ${f.label}px ${SANS}`;
        ctx.fillStyle = WHITE;
        ctx.textAlign = 'center';
        const words = skill.split(' ');
        const lines: string[] = [];
        let ln = '';
        for (const w of words) {
          const test = ln ? `${ln} ${w}` : w;
          if (ctx.measureText(test).width > cardW - f.label && ln) { lines.push(ln); ln = w; } else ln = test;
        }
        if (ln) lines.push(ln);
        const lblTop = cy + tile + f.label * 1.9;
        lines.slice(0, 2).forEach((l, li) => ctx.fillText(l, cx + cardW / 2, lblTop + li * f.label * 1.25));
        ctx.textAlign = 'left';
      }
    });
    const rows = Math.ceil(SKILLS.length / cols);
    y += rows * cardH + (rows - 1) * gap + f.head * 1.0;

    // Journey blocks — numbered cards with arrow bullets
    const cardPad = f.body * 0.95;
    const radius = f.body * 0.7;
    const stripeW = Math.max(3, cw * 0.0045);
    BLOCKS.forEach((block, bi) => {
      const innerX = padX + cardPad + stripeW;
      const innerW = maxW - cardPad * 2 - stripeW;
      // measure block content height first
      const contentH = (() => {
        let yy = cardPad + f.num + f.head * 1.35;
        ctx.font = `400 ${f.bullet}px ${SANS}`;
        for (const item of block.items) {
          yy = wrap(ctx, item, innerX + f.bullet * 1.5, yy, innerW - f.bullet * 1.5, f.bulletLH, false);
          yy += f.bullet * 0.6;
        }
        return yy + cardPad - f.bullet * 0.6;
      })();

      if (draw) {
        roundRect(ctx, padX, y, maxW, contentH, radius);
        ctx.fillStyle = 'rgba(255,255,255,0.026)'; ctx.fill();
        ctx.strokeStyle = rgba(0.1); ctx.lineWidth = hair; ctx.stroke();
        ctx.fillStyle = a.glow;
        ctx.fillRect(padX, y + radius, stripeW, contentH - radius * 2);

        let yy = y + cardPad + f.num;
        ctx.font = `700 ${f.num}px ${SYNE}`;
        ctx.fillStyle = rgba(0.55);
        ctx.fillText(`0${bi + 1}`, innerX, yy);
        yy += f.head * 0.95;
        ctx.font = `700 ${f.head}px ${SYNE}`;
        ctx.fillStyle = WHITE;
        ctx.fillText(block.h, innerX, yy);
        yy += f.head * 0.7;
        for (const item of block.items) {
          ctx.fillStyle = a.glow;
          ctx.font = `700 ${f.bullet}px ${SANS}`;
          ctx.fillText('→', innerX, yy);
          ctx.fillStyle = TEXT;
          ctx.font = `400 ${f.bullet}px ${SANS}`;
          yy = wrap(ctx, item, innerX + f.bullet * 1.5, yy, innerW - f.bullet * 1.5, f.bulletLH, true);
          yy += f.bullet * 0.6;
        }
      }
      y += contentH + f.body * 0.85;
    });

    return y + padX * 0.6;
  };

  // Measure → paint
  const measure = document.createElement('canvas');
  measure.width = cw; measure.height = 16;
  const ch = Math.min(4096, Math.ceil(layout(measure.getContext('2d')!, false)));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const paint = () => {
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, cw, ch);
    const wash = ctx.createRadialGradient(cw * 0.78, ch * 0.04, 0, cw * 0.78, ch * 0.04, cw * 1.3);
    wash.addColorStop(0, rgba(0.16));
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

  const windowH = cw / f.planeAspect;
  const repeatY = Math.min(1, windowH / ch);
  texture.repeat.set(1, repeatY);
  const topOffset = 1 - repeatY;
  texture.offset.set(0, topOffset);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }

  const render = (scroll01: number) => {
    const s = THREE.MathUtils.clamp(scroll01, 0, 1);
    texture.offset.y = topOffset * (1 - s);
  };

  return { texture, render };
}
