import * as THREE from 'three';
import { readAccent } from '@/lib/accent';

/**
 * Device screens, split into three surfaces so the expensive one never moves.
 *
 *   chrome   — window furniture (title bar, sidebar, tabs, status bar). Drawn
 *              once. Static, so it stays put while the editor scrolls under it.
 *   content  — the scrolling document. Drawn once onto a tall canvas and
 *              scrolled by shifting `texture.offset.y`, a cheap uniform. No
 *              per-frame redraw and no re-upload.
 *   live     — a small animated strip (the terminal). This one *does* re-upload,
 *              which is why it is deliberately tiny and throttled.
 *
 * Splitting them is what lets the chrome stay fixed: a single scrolling texture
 * would drag the title bar and sidebar off the top of the screen with it.
 */

/* ── Canvas geometry, and how canvas rects map onto 3D planes ─────────── */

export const SCREEN = {
  laptop: { cw: 1460, ch: 935, planeW: 2.92, planeH: 1.87 },
  phone:  { cw: 460,  ch: 998, planeW: 1.30, planeH: 2.82 },
} as const;

/** Canvas-space rects for each region, per device. [x, y, w, h] */
export const REGION = {
  laptop: {
    editor:   [310, 90, 1150, 700] as const,
    terminal: [310, 790, 1150, 115] as const,
  },
  phone: {
    editor:   [0, 120, 460, 820] as const,
    terminal: [0, 0, 0, 0] as const,   // phone has no terminal strip
  },
} as const;

export interface PlaneRect { w: number; h: number; x: number; y: number }

/** Canvas + plane dimensions for one device. */
interface Dims { cw: number; ch: number; planeW: number; planeH: number }

/** Convert a canvas rect into plane size + local position on the screen mesh. */
export function toPlane(kind: 'laptop' | 'phone', r: readonly [number, number, number, number]): PlaneRect {
  const s = SCREEN[kind];
  const [x, y, w, h] = r;
  return {
    w: (w / s.cw) * s.planeW,
    h: (h / s.ch) * s.planeH,
    x: ((x + w / 2) / s.cw - 0.5) * s.planeW,
    y: (0.5 - (y + h / 2) / s.ch) * s.planeH,
  };
}

/* ── Shared helpers ───────────────────────────────────────────────────── */

const MONO = '"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, sans-serif';
const SYNE = '"Syne", system-ui, sans-serif';

const BG        = '#0b0f16';
const BG_PANEL  = '#0e131c';
const BG_BAR    = '#11161f';
const LINE      = 'rgba(255,255,255,0.07)';
const DIM       = '#5b6470';
const TEXT      = '#c3cad6';
const WHITE     = '#f2f5f9';

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  return t;
}

/* ── The file "open" in the editor ────────────────────────────────────── */

const CODE = `/**
 * Ahnaf Hussain
 * Head of Web Development @ AurixLab
 */

export const about = {
  name:     'Ahnaf Hussain',
  role:     'Head of Web Development',
  company:  'AurixLab',
  studying: 'BRAC University',
} as const;

/* I lead a development team building high-
   performance websites, SaaS frontends and
   data-driven digital products for clients
   across North America — while finishing my
   degree full-time. */

export const focus = 'systems architecture';

export const delivers = [
  '90+ SEO scores',
  'GSAP-driven interactivity',
  'scalable frontend infrastructure',
];

export const stack = {
  frontend: ['Next.js', 'React', 'TypeScript'],
  cms:      ['WordPress', 'Elementor', 'Shopify'],
  motion:   ['GSAP', 'Lenis', 'Three.js', 'WebGL'],
  backend:  ['Supabase', 'Prisma', 'Fastify'],
  ai:       ['LangGraph', 'Claude API', 'MCP'],
  data:     ['Python', 'Pandas', 'Jupyter'],
  seo:      ['Yoast', 'Schema.org', 'Core Web Vitals'],
};

// ── My journey ──────────────────────────
const journey = [
  'Joined AurixLab Aug 2025 → led the dev function',
  'Architected Mission Control — 11 daily users',
  'Set frontend standards used on every project',
];

// ── What drives me ──────────────────────
const drivers = [
  'Systems that scale — tooling that outlasts projects',
  'Engineering rigour meets design quality',
];

// ── How I work ──────────────────────────
const principles = [
  'Architecture-first: design before code',
  'Lead by doing, not delegating',
  'Raise the floor, not just the ceiling',
];

export default about;
`;

const KEYWORDS = new Set(['export', 'const', 'default', 'as', 'let', 'return', 'function', 'type', 'interface']);

type TokKind = 'comment' | 'keyword' | 'string' | 'prop' | 'num' | 'punct' | 'text';

/** Small scanner, tuned for the fixed snippet above. */
function tokenize(line: string): { t: string; k: TokKind }[] {
  const out: { t: string; k: TokKind }[] = [];
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
    return [{ t: line, k: 'comment' }];
  }
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j++;
      out.push({ t: line.slice(i, j + 1), k: 'string' });
      i = j + 1;
    } else if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const after = line.slice(j).match(/^\s*:/);
      out.push({ t: word, k: KEYWORDS.has(word) ? 'keyword' : after ? 'prop' : 'text' });
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      out.push({ t: line.slice(i, j), k: 'num' });
      i = j;
    } else if (/[{}[\]()<>,;:=.]/.test(ch)) {
      out.push({ t: ch, k: 'punct' });
      i++;
    } else {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      out.push({ t: line.slice(i, j === i ? i + 1 : j), k: 'text' });
      i = j === i ? i + 1 : j;
    }
  }
  return out;
}

/* ── Chrome: title bar, activity bar, sidebar, tabs, status bar ───────── */

export function createChromeSurface(kind: 'laptop' | 'phone') {
  const a = readAccent();
  const s = SCREEN[kind];
  const canvas = document.createElement('canvas');
  canvas.width = s.cw;
  canvas.height = s.ch;
  const c = canvas.getContext('2d')!;

  const paint = kind === 'laptop' ? () => paintLaptopChrome(c, s, a) : () => paintPhoneChrome(c, s, a);
  paint();

  const texture = makeTexture(canvas);
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }
  return { texture };
}

function paintLaptopChrome(c: CanvasRenderingContext2D, s: Dims, a: ReturnType<typeof readAccent>) {
  const { cw, ch } = s;
  const accent = a.glow;

  c.fillStyle = BG;
  c.fillRect(0, 0, cw, ch);

  // Title bar
  c.fillStyle = BG_BAR;
  c.fillRect(0, 0, cw, 44);
  c.strokeStyle = LINE; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, 44.5); c.lineTo(cw, 44.5); c.stroke();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    c.beginPath(); c.arc(24 + i * 22, 22, 6.5, 0, Math.PI * 2);
    c.fillStyle = col; c.fill();
  });
  c.font = `500 20px ${SANS}`;
  c.fillStyle = DIM;
  c.textAlign = 'center';
  c.fillText('about.ts — ahnaf-hussain', cw / 2, 29);
  c.textAlign = 'left';

  // Activity bar (icon rail)
  c.fillStyle = '#0a0e15';
  c.fillRect(0, 44, 52, ch - 44 - 30);
  for (let i = 0; i < 4; i++) {
    const y = 84 + i * 52;
    const on = i === 0;
    c.strokeStyle = on ? accent : 'rgba(255,255,255,0.3)';
    c.fillStyle = on ? accent : 'rgba(255,255,255,0.3)';
    c.lineWidth = 2;
    if (i === 0) {            // files
      c.strokeRect(19, y - 10, 13, 17);
      c.beginPath(); c.moveTo(23, y - 13); c.lineTo(36, y - 13); c.lineTo(36, y + 4); c.stroke();
    } else if (i === 1) {     // search
      c.beginPath(); c.arc(25, y - 3, 7, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(30, y + 2); c.lineTo(36, y + 8); c.stroke();
    } else if (i === 2) {     // git branch
      c.beginPath(); c.arc(21, y - 8, 3.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(21, y + 8, 3.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(34, y - 1, 3.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(21, y - 4); c.lineTo(21, y + 4); c.stroke();
      c.beginPath(); c.moveTo(21, y + 2); c.lineTo(31, y - 1); c.stroke();
    } else {                  // run
      c.beginPath(); c.moveTo(20, y - 9); c.lineTo(35, y); c.lineTo(20, y + 9); c.closePath(); c.stroke();
    }
    if (on) { c.fillStyle = accent; c.fillRect(0, y - 16, 2.5, 32); }
  }

  // Sidebar — explorer
  c.fillStyle = BG_PANEL;
  c.fillRect(52, 44, 258, ch - 44 - 30);
  c.strokeStyle = LINE;
  c.beginPath(); c.moveTo(310.5, 44); c.lineTo(310.5, ch - 30); c.stroke();

  c.font = `600 17px ${SANS}`;
  c.fillStyle = DIM;
  c.fillText('EXPLORER', 72, 76);

  const tree: { label: string; depth: number; active?: boolean; folder?: boolean }[] = [
    { label: 'PORTFOLIO', depth: 0, folder: true },
    { label: 'app', depth: 1, folder: true },
    { label: 'components', depth: 1, folder: true },
    { label: 'device', depth: 2, folder: true },
    { label: 'lib', depth: 1, folder: true },
    { label: 'about.ts', depth: 2, active: true },
    { label: 'projects.ts', depth: 2 },
    { label: 'accent.ts', depth: 2 },
    { label: 'README.md', depth: 1 },
  ];
  tree.forEach((n, i) => {
    const y = 112 + i * 37;
    if (n.active) {
      c.fillStyle = 'rgba(255,255,255,0.055)';
      c.fillRect(52, y - 20, 258, 30);
      c.fillStyle = accent;
      c.fillRect(52, y - 20, 2.5, 30);
    }
    const x = 74 + n.depth * 18;
    if (n.folder) {
      c.fillStyle = 'rgba(255,255,255,0.34)';
      c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 7, y - 3); c.lineTo(x, y + 2); c.closePath(); c.fill();
      c.fillStyle = n.depth === 0 ? WHITE : TEXT;
    } else {
      c.fillStyle = n.active ? accent : 'rgba(255,255,255,0.4)';
      c.fillRect(x + 1, y - 9, 9, 12);
      c.fillStyle = n.active ? WHITE : TEXT;
    }
    c.font = `${n.depth === 0 ? 600 : 400} ${n.depth === 0 ? 16 : 19}px ${SANS}`;
    c.fillText(n.label, x + 18, y);
  });

  // Tab bar
  c.fillStyle = BG_BAR;
  c.fillRect(310, 44, cw - 310, 46);
  const tabs = ['about.ts', 'projects.ts', 'README.md'];
  let tx = 310;
  tabs.forEach((t, i) => {
    c.font = `400 19px ${SANS}`;
    const w = c.measureText(t).width + 58;
    if (i === 0) {
      c.fillStyle = BG;
      c.fillRect(tx, 44, w, 46);
      c.fillStyle = accent;
      c.fillRect(tx, 44, w, 2.5);
    }
    c.fillStyle = i === 0 ? WHITE : DIM;
    c.fillText(t, tx + 23, 75);
    c.strokeStyle = LINE;
    c.beginPath(); c.moveTo(tx + w + 0.5, 50); c.lineTo(tx + w + 0.5, 84); c.stroke();
    tx += w;
  });
  c.strokeStyle = LINE;
  c.beginPath(); c.moveTo(310, 90.5); c.lineTo(cw, 90.5); c.stroke();

  // Status bar
  c.fillStyle = '#0d1219';
  c.fillRect(0, ch - 34, cw, 34);
  c.fillStyle = accent;
  c.globalAlpha = 0.5;
  c.fillRect(0, ch - 34, cw, 1.5);
  c.globalAlpha = 1;
  c.font = `500 17px ${SANS}`;
  c.fillStyle = accent;
  c.beginPath(); c.arc(26, ch - 17, 5.5, 0, Math.PI * 2); c.fill();
  c.fillText('main', 42, ch - 11);
  c.fillStyle = 'rgba(255,255,255,0.42)';
  c.fillText('No problems', 118, ch - 11);
  c.textAlign = 'right';
  c.fillText('TypeScript    UTF-8', cw - 26, ch - 11);
  c.textAlign = 'left';
}

function paintPhoneChrome(c: CanvasRenderingContext2D, s: Dims, a: ReturnType<typeof readAccent>) {
  const { cw, ch } = s;
  c.fillStyle = BG;
  c.fillRect(0, 0, cw, ch);

  // Rounded screen corners are baked in: paint outside the radius black so the
  // rectangular plane reads as a rounded display without extra geometry.
  c.save();
  c.globalCompositeOperation = 'destination-in';
  roundRect(c, 0, 0, cw, ch, 62);
  c.fillStyle = '#fff';
  c.fill();
  c.restore();

  // Status bar
  c.font = `600 21px ${SANS}`;
  c.fillStyle = WHITE;
  c.fillText('9:41', 38, 56);
  // signal / wifi / battery
  const bx = cw - 118;
  for (let i = 0; i < 4; i++) {
    const h = 6 + i * 3.5;
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(bx + i * 8, 52 - h, 5, h);
  }
  c.beginPath();
  c.arc(bx + 46, 52, 11, Math.PI * 1.15, Math.PI * 1.85);
  c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 3.5; c.stroke();
  c.beginPath();
  c.arc(bx + 46, 52, 4.5, Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();
  roundRect(c, bx + 66, 40, 30, 15, 4);
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.fillRect(bx + 69, 43, 20, 9);

  // Dynamic Island — drawn into the screen, which is where it actually lives.
  roundRect(c, cw / 2 - 62, 22, 124, 36, 18);
  c.fillStyle = '#000';
  c.fill();
  c.beginPath();
  c.arc(cw / 2 + 42, 40, 6, 0, Math.PI * 2);
  c.fillStyle = '#0b0e13';
  c.fill();

  // Home indicator
  roundRect(c, cw / 2 - 68, ch - 26, 136, 6, 3);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fill();
}

/* ── Content: the scrolling document ──────────────────────────────────── */

export interface ContentSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number) => void;
}

export function createContentSurface(kind: 'laptop' | 'phone'): ContentSurface {
  return kind === 'laptop' ? laptopContent() : phoneContent();
}

function laptopContent(): ContentSurface {
  const a = readAccent();
  const [, , rw, rh] = REGION.laptop.editor;
  const cw = rw;

  const COLORS: Record<TokKind, string> = {
    comment: '#5b6470',
    keyword: '#c678dd',
    string:  a.glow,
    prop:    '#61afef',
    num:     '#d19a66',
    punct:   '#8b93a1',
    text:    TEXT,
  };

  const lines = CODE.split('\n');
  const GUTTER = 78;
  const PAD_L = 26;

  // Auto-fit: measure the widest line and shrink the type until it fits the
  // editor column. Without this, editing CODE silently clips at the edge.
  const fit = document.createElement('canvas').getContext('2d')!;
  let FS = 31;
  const avail = cw - GUTTER - PAD_L - 16;
  for (; FS > 12; FS -= 1) {
    fit.font = `400 ${FS}px ${MONO}`;
    const widest = lines.reduce((m, l) => Math.max(m, fit.measureText(l).width), 0);
    if (widest <= avail) break;
  }
  const LH = Math.round(FS * 1.6);
  const padTop = 26;
  const ch = Math.max(rh + 8, padTop * 2 + lines.length * LH);

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const c = canvas.getContext('2d')!;

  const paint = () => {
    c.fillStyle = BG;
    c.fillRect(0, 0, cw, ch);
    // gutter
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, 0, GUTTER, ch);

    c.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      const y = padTop + (i + 1) * LH - 12;

      c.font = `400 ${FS - 3}px ${MONO}`;
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.textAlign = 'right';
      c.fillText(String(i + 1), GUTTER - 20, y);
      c.textAlign = 'left';

      let x = GUTTER + PAD_L;
      c.font = `400 ${FS}px ${MONO}`;
      for (const tok of tokenize(line)) {
        c.fillStyle = COLORS[tok.k];
        c.fillText(tok.t, x, y);
        x += c.measureText(tok.t).width;
      }
    });
  };
  paint();

  const texture = makeTexture(canvas);
  const repeatY = Math.min(1, rh / ch);
  texture.repeat.set(1, repeatY);
  const topOffset = 1 - repeatY;
  texture.offset.set(0, topOffset);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }

  return {
    texture,
    render: (s: number) => { texture.offset.y = topOffset * (1 - THREE.MathUtils.clamp(s, 0, 1)); },
  };
}

const PHONE_CARDS: { h: string; items: string[] }[] = [
  { h: 'My Journey', items: [
    'Joined AurixLab Aug 2025 — specialist to leading the dev function',
    'Architected Mission Control — full-stack PM system, 11 daily users',
    'Established frontend standards used on every client project',
  ] },
  { h: 'What Drives Me', items: [
    'Systems that scale — tooling and architectures that outlast projects',
    'Engineering rigour meets design quality',
  ] },
  { h: 'How I Work', items: [
    'Architecture-first: define the system before writing code',
    'Lead by doing',
    'Raise the floor, not just the ceiling',
  ] },
];

function phoneContent(): ContentSurface {
  const a = readAccent();
  const [, , rw, rh] = REGION.phone.editor;
  const cw = rw;
  const pad = 30;
  const maxW = cw - pad * 2;

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = cw; measureCanvas.height = 8;
  const mc = measureCanvas.getContext('2d')!;

  const wrap = (c: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number, draw: boolean) => {
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > w && line) {
        if (draw) c.fillText(line, x, y);
        line = word; y += lh;
      } else line = test;
    }
    if (draw && line) c.fillText(line, x, y);
    return y + lh;
  };

  const layout = (c: CanvasRenderingContext2D, draw: boolean) => {
    let y = pad + 16;

    c.font = `600 15px ${SANS}`;
    if (draw) { c.fillStyle = a.glow; c.fillText('ABOUT ME', pad, y); }
    y += 46;

    c.font = `800 46px ${SYNE}`;
    if (draw) c.fillStyle = WHITE;
    y = wrap(c, 'Technical leader,', pad, y, maxW, 54, draw);
    if (draw) c.fillStyle = a.glow;
    y = wrap(c, 'architect by craft.', pad, y, maxW, 54, draw);
    y += 14;

    c.font = `400 21px ${SANS}`;
    if (draw) c.fillStyle = TEXT;
    y = wrap(c, "I'm Ahnaf Hussain — Head of Web Development at AurixLab. I lead a team building high-performance websites, SaaS frontends and data-driven products.", pad, y, maxW, 32, draw);
    y += 26;

    for (const card of PHONE_CARDS) {
      const startY = y;
      let inner = y + 34;
      c.font = `400 19px ${SANS}`;
      for (const it of card.items) inner = wrap(c, it, pad + 40, inner, maxW - 58, 28, false) + 6;
      const cardH = inner - startY + 12;

      if (draw) {
        roundRect(c, pad - 8, startY - 14, maxW + 16, cardH, 20);
        c.fillStyle = 'rgba(255,255,255,0.04)'; c.fill();
        c.strokeStyle = `rgba(${a.r},${a.g},${a.b},0.16)`; c.lineWidth = 1.5; c.stroke();
        c.font = `700 23px ${SYNE}`;
        c.fillStyle = WHITE;
        c.fillText(card.h, pad + 6, startY + 12);
        let iy = startY + 48;
        c.font = `400 19px ${SANS}`;
        for (const it of card.items) {
          c.fillStyle = a.glow;
          c.beginPath(); c.arc(pad + 18, iy - 6, 3.5, 0, Math.PI * 2); c.fill();
          c.fillStyle = TEXT;
          iy = wrap(c, it, pad + 40, iy, maxW - 58, 28, true) + 6;
        }
      }
      y = startY + cardH + 20;
    }
    return y + pad;
  };

  const ch = Math.max(rh + 8, Math.ceil(layout(mc, false)));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const c = canvas.getContext('2d')!;

  const paint = () => {
    c.fillStyle = BG;
    c.fillRect(0, 0, cw, ch);
    const wash = c.createRadialGradient(cw * 0.7, 0, 0, cw * 0.7, 0, cw * 1.6);
    wash.addColorStop(0, `rgba(${a.r},${a.g},${a.b},0.14)`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = wash;
    c.fillRect(0, 0, cw, ch);
    layout(c, true);
  };
  paint();

  const texture = makeTexture(canvas);
  const repeatY = Math.min(1, rh / ch);
  texture.repeat.set(1, repeatY);
  const topOffset = 1 - repeatY;
  texture.offset.set(0, topOffset);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => { paint(); texture.needsUpdate = true; }).catch(() => {});
  }

  return {
    texture,
    render: (s: number) => { texture.offset.y = topOffset * (1 - THREE.MathUtils.clamp(s, 0, 1)); },
  };
}

/* ── Live terminal strip ──────────────────────────────────────────────── */

export interface LiveSurface {
  texture: THREE.CanvasTexture;
  update: (elapsed: number) => void;
}

const TERM_SCRIPT = [
  { cmd: 'npm run build', out: '▲ Next.js 16.2.6  ·  compiled successfully in 2.7s' },
  { cmd: 'npm run lint',  out: '✔ No ESLint warnings or errors' },
  { cmd: 'git push',      out: '✔ main → origin/main  ·  deployed to production' },
];

/**
 * A small animated terminal. Only ~1150x93px and throttled to 12fps, so the
 * per-frame re-upload the big content texture deliberately avoids costs
 * almost nothing here.
 */
export function createLiveSurface(): LiveSurface {
  const a = readAccent();
  const [, , rw, rh] = REGION.laptop.terminal;
  const canvas = document.createElement('canvas');
  canvas.width = rw;
  canvas.height = rh;
  const c = canvas.getContext('2d')!;
  const texture = makeTexture(canvas);

  const CYCLE = 5.2;                // seconds per command
  const FPS = 12;
  let lastFrame = -1;

  const draw = (elapsed: number) => {
    const step = Math.floor(elapsed / CYCLE) % TERM_SCRIPT.length;
    const t = (elapsed % CYCLE) / CYCLE;
    const { cmd, out } = TERM_SCRIPT[step];

    c.fillStyle = '#080b11';
    c.fillRect(0, 0, rw, rh);
    c.strokeStyle = LINE; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 0.5); c.lineTo(rw, 0.5); c.stroke();

    c.font = `600 15px ${SANS}`;
    c.fillStyle = 'rgba(255,255,255,0.34)';
    c.fillText('TERMINAL', 24, 26);

    const typed = Math.min(cmd.length, Math.floor((t / 0.34) * cmd.length));
    c.font = `400 23px ${MONO}`;
    c.fillStyle = a.glow;
    c.fillText('$', 24, 66);
    c.fillStyle = TEXT;
    c.fillText(cmd.slice(0, typed), 46, 66);

    // caret blinks while typing, then sits after the command
    const caretX = 46 + c.measureText(cmd.slice(0, typed)).width + 3;
    if (Math.floor(elapsed * 2) % 2 === 0 || typed < cmd.length) {
      c.fillStyle = a.glow;
      c.fillRect(caretX, 50, 11, 20);
    }

    if (t > 0.42) {
      c.font = `400 21px ${MONO}`;
      c.fillStyle = t > 0.5 ? '#7fd18a' : DIM;
      const reveal = Math.min(out.length, Math.floor(((t - 0.42) / 0.2) * out.length));
      c.fillText(out.slice(0, reveal), 46, 100);
    } else {
      // spinner while "building"
      const ang = elapsed * 6;
      c.strokeStyle = a.glow; c.lineWidth = 2.5;
      c.beginPath();
      c.arc(52, 94, 8, ang, ang + Math.PI * 1.3);
      c.stroke();
      c.font = `400 21px ${MONO}`;
      c.fillStyle = DIM;
      c.fillText('building…', 72, 100);
    }
  };

  return {
    texture,
    update: (elapsed: number) => {
      const frame = Math.floor(elapsed * FPS);
      if (frame === lastFrame) return;      // throttle — nothing changed
      lastFrame = frame;
      draw(elapsed);
      texture.needsUpdate = true;
    },
  };
}
