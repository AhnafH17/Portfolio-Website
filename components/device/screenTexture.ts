import * as THREE from 'three';
import { siNextdotjs, siWordpress, siShopify, siPython, siGreensock } from 'simple-icons';
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
  phone:  { cw: 460,  ch: 998, planeW: 1.42, planeH: 3.00 },
} as const;

/** Canvas-space rects for each region, per device. [x, y, w, h] */
export const REGION = {
  laptop: {
    editor:   [310, 90, 1150, 700] as const,
    terminal: [310, 790, 1150, 115] as const,
  },
  phone: {
    editor:   [12, 96, 436, 762] as const,
    // The Dynamic Island is the phone's live region — a Live Activity is
    // exactly what sits there on a real device.
    terminal: [110, 16, 240, 56] as const,
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
  roundRect(c, 0, 0, cw, ch, 84);
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

  // Tab bar — gives the screen the same structural anchor the IDE chrome has
  const tabTop = ch - 118;
  c.fillStyle = 'rgba(10,14,20,0.92)';
  c.fillRect(0, tabTop, cw, 118);
  c.strokeStyle = LINE; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, tabTop + 0.5); c.lineTo(cw, tabTop + 0.5); c.stroke();

  const tabs = ['About', 'Work', 'Stack', 'Say hi'];
  tabs.forEach((label, i) => {
    const x = (cw / 4) * (i + 0.5);
    const y = tabTop + 40;
    const on = i === 0;
    c.strokeStyle = on ? a.glow : 'rgba(255,255,255,0.34)';
    c.fillStyle = on ? a.glow : 'rgba(255,255,255,0.34)';
    c.lineWidth = 2.2;
    if (i === 0) {                       // person
      c.beginPath(); c.arc(x, y - 5, 7, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(x, y + 16, 12, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    } else if (i === 1) {                // grid
      [[-8, -8], [2, -8], [-8, 2], [2, 2]].forEach(([dx, dy]) => c.strokeRect(x + dx, y + dy - 2, 6, 6));
    } else if (i === 2) {                // layers
      c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 11, y - 5); c.lineTo(x, y + 2); c.lineTo(x - 11, y - 5); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(x - 11, y + 2); c.lineTo(x, y + 9); c.lineTo(x + 11, y + 2); c.stroke();
    } else {                             // message
      roundRect(c, x - 11, y - 11, 22, 16, 4); c.stroke();
      c.beginPath(); c.moveTo(x - 4, y + 5); c.lineTo(x - 1, y + 11); c.lineTo(x + 3, y + 5); c.stroke();
    }
    c.font = `500 15px ${SANS}`;
    c.textAlign = 'center';
    c.fillText(label, x, tabTop + 76);
    c.textAlign = 'left';
  });

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

const PHONE_STATS = [
  { v: '11', l: 'team served' },
  { v: '9', l: 'shipped' },
  { v: '90+', l: 'SEO score' },
];

const PHONE_CHIPS: { label: string; icon?: { path: string } }[] = [
  { label: 'WordPress', icon: siWordpress },
  { label: 'Next.js', icon: siNextdotjs },
  { label: 'Shopify', icon: siShopify },
  { label: 'GSAP', icon: siGreensock },
  { label: 'Python', icon: siPython },
  { label: 'TypeScript' },
  { label: 'Supabase' },
  { label: 'LangGraph' },
];

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
  const pad = 28;
  const maxW = cw - pad * 2;
  const rgba = (o: number) => `rgba(${a.r},${a.g},${a.b},${o})`;

  const mc = (() => { const m = document.createElement('canvas'); m.width = cw; m.height = 8; return m.getContext('2d')!; })();

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
    let y = pad + 20;

    // iOS large title
    c.font = `700 44px ${SANS}`;
    if (draw) { c.fillStyle = WHITE; c.fillText('About', pad, y + 12); }
    y += 62;

    // Profile row — monogram, name, role
    if (draw) {
      const r = 30;
      const cx = pad + r, cy = y + r - 6;
      const g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, a.glow); g.addColorStop(1, a.deep);
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      c.font = `700 26px ${SYNE}`;
      c.fillStyle = '#0b0f16'; c.textAlign = 'center';
      c.fillText('AH', cx, cy + 9);
      c.textAlign = 'left';
      c.font = `600 23px ${SANS}`;
      c.fillStyle = WHITE;
      c.fillText('Ahnaf Hussain', pad + r * 2 + 16, cy - 2);
      c.font = `400 18px ${SANS}`;
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillText('Head of Web Dev · AurixLab', pad + r * 2 + 16, cy + 22);
    }
    y += 84;

    // Stat tiles
    const gap = 12;
    const tw = (maxW - gap * 2) / 3;
    if (draw) {
      PHONE_STATS.forEach((st, i) => {
        const x = pad + i * (tw + gap);
        roundRect(c, x, y, tw, 76, 16);
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill();
        c.strokeStyle = rgba(0.16); c.lineWidth = 1.4; c.stroke();
        c.textAlign = 'center';
        c.font = `700 27px ${SYNE}`; c.fillStyle = a.glow;
        c.fillText(st.v, x + tw / 2, y + 34);
        c.font = `400 14px ${SANS}`; c.fillStyle = 'rgba(255,255,255,0.45)';
        c.fillText(st.l, x + tw / 2, y + 58);
        c.textAlign = 'left';
      });
    }
    y += 76 + 30;

    // Stack chips
    c.font = `600 15px ${SANS}`;
    if (draw) { c.fillStyle = rgba(0.9); c.fillText('STACK', pad, y); }
    y += 26;

    let cx2 = pad;
    let rowY = y;
    c.font = `500 18px ${SANS}`;
    for (const chip of PHONE_CHIPS) {
      const iconW = chip.icon ? 24 : 0;
      const w = c.measureText(chip.label).width + 28 + iconW;
      if (cx2 + w > pad + maxW) { cx2 = pad; rowY += 46; }
      if (draw) {
        roundRect(c, cx2, rowY, w, 36, 18);
        c.fillStyle = 'rgba(255,255,255,0.055)'; c.fill();
        c.strokeStyle = rgba(0.18); c.lineWidth = 1.3; c.stroke();
        if (chip.icon) {
          c.save();
          c.translate(cx2 + 13, rowY + 10);
          c.scale(16 / 24, 16 / 24);
          c.fillStyle = a.glow;
          c.fill(new Path2D(chip.icon.path));
          c.restore();
        }
        c.font = `500 18px ${SANS}`;
        c.fillStyle = 'rgba(255,255,255,0.86)';
        c.fillText(chip.label, cx2 + 14 + iconW, rowY + 24);
      }
      cx2 += w + 10;
    }
    y = rowY + 36 + 34;

    // Cards
    for (const card of PHONE_CARDS) {
      const startY = y;
      let inner = y + 40;
      c.font = `400 18px ${SANS}`;
      for (const it of card.items) inner = wrap(c, it, pad + 40, inner, maxW - 58, 27, false) + 6;
      const cardH = inner - startY + 10;

      if (draw) {
        roundRect(c, pad - 10, startY - 16, maxW + 20, cardH, 20);
        c.fillStyle = 'rgba(255,255,255,0.045)'; c.fill();
        c.strokeStyle = rgba(0.14); c.lineWidth = 1.4; c.stroke();
        c.font = `700 22px ${SYNE}`;
        c.fillStyle = WHITE;
        c.fillText(card.h, pad + 2, startY + 10);
        let iy = startY + 48;
        c.font = `400 18px ${SANS}`;
        for (const it of card.items) {
          c.fillStyle = a.glow;
          c.beginPath(); c.arc(pad + 16, iy - 6, 3.5, 0, Math.PI * 2); c.fill();
          c.fillStyle = TEXT;
          iy = wrap(c, it, pad + 40, iy, maxW - 58, 27, true) + 6;
        }
      }
      y = startY + cardH + 22;
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
    wash.addColorStop(0, rgba(0.13));
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
export function createLiveSurface(kind: 'laptop' | 'phone' = 'laptop'): LiveSurface {
  if (kind === 'phone') return islandSurface();
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

const ISLAND_SCRIPT = [
  { label: 'Deploying',  done: 'Live'      },
  { label: 'Building',   done: 'Passed'    },
  { label: 'Publishing', done: 'Shipped'   },
];

/**
 * The Dynamic Island running a Live Activity — the phone's answer to the
 * laptop's terminal. 240x56 and throttled to 12fps, so it is a rounding error
 * next to the static content texture.
 */
function islandSurface(): LiveSurface {
  const a = readAccent();
  const [, , rw, rh] = REGION.phone.terminal;
  const canvas = document.createElement('canvas');
  canvas.width = rw;
  canvas.height = rh;
  const c = canvas.getContext('2d')!;
  const texture = makeTexture(canvas);

  const CYCLE = 4.6;
  const FPS = 12;
  let lastFrame = -1;

  const draw = (elapsed: number) => {
    const step = Math.floor(elapsed / CYCLE) % ISLAND_SCRIPT.length;
    const t = (elapsed % CYCLE) / CYCLE;
    const { label, done } = ISLAND_SCRIPT[step];
    const finished = t > 0.62;

    c.clearRect(0, 0, rw, rh);
    c.fillStyle = BG;
    c.fillRect(0, 0, rw, rh);

    // The pill widens while the activity runs, then settles back — the same
    // move the real island makes.
    const grow = finished ? 1 - Math.min(1, (t - 0.62) / 0.22) : Math.min(1, t / 0.12);
    const pw = 124 + 96 * grow;
    const x = (rw - pw) / 2;
    const y = (rh - 36) / 2;
    roundRect(c, x, y, pw, 36, 18);
    c.fillStyle = '#000';
    c.fill();

    // front camera
    c.beginPath();
    c.arc(x + pw - 22, y + 18, 6, 0, Math.PI * 2);
    c.fillStyle = '#0b0e13';
    c.fill();

    if (grow > 0.25) {
      c.save();
      c.beginPath(); roundRect(c, x, y, pw, 36, 18); c.clip();
      if (finished) {
        c.strokeStyle = '#7fd18a'; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x + 17, y + 18); c.lineTo(x + 22, y + 23); c.lineTo(x + 31, y + 12); c.stroke();
        c.font = `600 16px ${SANS}`; c.fillStyle = '#e8f3ea';
        c.fillText(done, x + 40, y + 24);
      } else {
        const ang = elapsed * 7;
        c.strokeStyle = a.glow; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath(); c.arc(x + 24, y + 18, 8, ang, ang + Math.PI * 1.35); c.stroke();
        c.font = `600 16px ${SANS}`; c.fillStyle = 'rgba(255,255,255,0.9)';
        c.fillText(label, x + 40, y + 24);
      }
      c.restore();
    }
  };

  return {
    texture,
    update: (elapsed: number) => {
      const frame = Math.floor(elapsed * FPS);
      if (frame === lastFrame) return;
      lastFrame = frame;
      draw(elapsed);
      texture.needsUpdate = true;
    },
  };
}
