import type { Accent } from '@/lib/accent';
import { projectData, stripMeta, type ProjectKey } from '@/lib/projects';
import { PROJECT_BLUR } from '@/lib/projectBlur';

export const CATEGORIES = [
  {
    monitor: 'Left',
    title: 'Software &',
    titleBold: 'AI Engineering',
    subtitle: 'Building intelligent systems, tools and platforms that solve real problems.',
    projects: ['notion', 'dashboard', 'scripting', 'data'],
  },
  {
    monitor: 'Centre',
    title: 'Web Development &',
    titleBold: 'E-commerce',
    subtitle: 'Crafting high-performance websites and digital storefronts from scratch.',
    projects: ['urbandecant', 'bp', 'leadcraft', 'resizer'],
  },
  {
    monitor: 'Right',
    title: 'SEO, Security &',
    titleBold: 'Web Presence',
    subtitle: 'Securing, optimizing and scaling digital presence for real-world results.',
    projects: ['cpc', 'revive', 'aurix'],
  },
] as const satisfies ReadonlyArray<{
  monitor: string;
  title: string;
  titleBold: string;
  subtitle: string;
  projects: readonly ProjectKey[];
}>;

export const tags = Object.fromEntries(stripMeta.map((p) => [p.key, p.tags])) as Record<ProjectKey, string[]>;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ScreenLayout {
  w: number;
  h: number;
  compact: boolean;
  cards: Rect[];
}

/** Shared geometry for the painted cards and their real HTML links. */
export function screenLayout(index: number, narrow: boolean): ScreenLayout {
  const portrait = index === 0;
  const compact = narrow && !portrait;
  const w = portrait ? 448 : compact ? 360 : 1008;
  const h = Math.round(w * [16 / 9, 9 / 21, 9 / 16][index]);
  const margin = compact ? 8 : portrait ? 20 : 26;
  const gap = compact ? 4 : portrait ? 8 : 10;
  const top = compact ? (index === 1 ? 48 : 58) : portrait ? 194 : index === 1 ? 165 : 199;
  const count = CATEGORIES[index].projects.length;
  const cols = portrait ? 1 : compact ? 2 : count;
  const rows = Math.ceil(count / cols);
  const cw = (w - 2 * margin - (cols - 1) * gap) / cols;
  const ch = (h - top - margin - (rows - 1) * gap) / rows;
  return {
    w,
    h,
    compact,
    cards: Array.from({ length: count }, (_, i) => ({
      x: margin + (i % cols) * (cw + gap),
      y: top + Math.floor(i / cols) * (ch + gap),
      w: cw,
      h: ch,
    })),
  };
}

type Images = Partial<Record<ProjectKey, HTMLImageElement>>;
const loaded = new Map<string, Promise<HTMLImageElement | null>>();
function imageAt(url: string) {
  let wait = loaded.get(url);
  if (!wait) {
    const img = new Image();
    img.src = url;
    wait = img.decode().then(
      () => img,
      () => null
    );
    loaded.set(url, wait);
  }
  return wait;
}

export async function screenImages(preview: boolean): Promise<Images> {
  const entries = await Promise.all(
    stripMeta.map(async ({ key }) => {
      const url = preview ? PROJECT_BLUR[key] : '/' + projectData[key].image;
      return [key, await imageAt(url)] as const;
    })
  );
  return Object.fromEntries(entries.filter(([, img]) => img));
}

function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale,
    sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * 0.26, sw, sh, x, y, w, h);
}

function lines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  leading: number
) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, x, y);
      y += leading;
      line = word;
    } else line = next;
  }
  ctx.fillText(line, x, y);
}

export function drawScreen(
  canvas: HTMLCanvasElement,
  index: number,
  narrow: boolean,
  accent: Accent,
  images: Images
) {
  const { w, h, compact, cards } = screenLayout(index, narrow);
  const scale = Math.min(2.5, 1536 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(canvas.width / w, canvas.height / h);
  ctx.textBaseline = 'top';
  const rect = (x: number, y: number, width: number, height: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
  };
  const type = (size: number, weight = 400, display = false) => {
    ctx.font = weight + ' ' + size + 'px "' + (display ? 'Greater Theory' : 'DM Sans') + '", sans-serif';
  };
  const cat = CATEGORIES[index];
  const pad = cards[0].x;
  rect(0, 0, w, h, '#141417');
  if (compact) {
    rect(pad, 8, 2, 16, accent.glow);
    type(16, 600);
    ctx.fillStyle = '#f4f3f1';
    ctx.fillText(cat.title + ' ' + cat.titleBold, pad + 7, 7, w - pad * 2 - 7);
    type(10);
    ctx.fillStyle = '#c2c1c4';
    lines(ctx, cat.subtitle, pad, 27, w - pad * 2, 11);
  } else {
    const toolbar = index === 0 ? 32 : 34;
    rect(0, 0, w, toolbar, '#202023');
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 0 ? accent.glow : '#717176';
      ctx.beginPath();
      ctx.arc(pad + i * 10, toolbar / 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    type(12, 600);
    ctx.fillStyle = '#c9c8cc';
    ctx.textAlign = 'right';
    ctx.fillText('SELECTED WORK', w - pad, toolbar / 2 - 6);
    ctx.textAlign = 'left';
    const top = toolbar + (index === 0 ? 24 : 16);
    rect(pad, top + 2, 3, index === 0 ? 64 : 61, accent.glow);
    type(index === 0 ? 22 : 25, 600);
    ctx.fillStyle = '#c9c8cb';
    ctx.fillText(cat.title, pad + 13, top);
    type(index === 0 ? 32 : 46, 400, true);
    ctx.fillStyle = '#f8f7f5';
    ctx.fillText(cat.titleBold, pad + 12, top + 26, w - pad * 2 - 13);
    type(index === 0 ? 17 : 18);
    ctx.fillStyle = '#bfc0c3';
    lines(ctx, cat.subtitle, pad, index === 0 ? 135 : 132, w - pad * 2, 22);
  }

  cards.forEach(({ x, y, w: cw, h: ch }, i) => {
    const key = cat.projects[i];
    const project = projectData[key];
    const img = images[key];
    rect(x, y, cw, ch, '#252529');
    rect(x, y, cw, 1, '#454549');
    const row = compact || index === 0;
    const inset = compact ? 5 : 8;
    const iw = row ? (compact ? 27 : cw * 0.3) : cw - 2 * inset;
    const ih = row ? ch - 2 * inset : ch * 0.49;
    if (img) cover(ctx, img, x + inset, y + inset, iw, ih);
    const tx = row ? x + iw + 2 * inset : x + inset + 3;
    const available = x + cw - tx - inset;
    const ty = row ? y + (compact ? 4 : 23) : y + ih + inset + 10;
    type(compact ? 10 : 13, 600);
    ctx.fillStyle = accent.light;
    ctx.fillText(compact ? tags[key][0] : tags[key].slice(0, 2).join('  /  '), tx, ty, available);
    type(compact ? 13.3 : index === 0 ? 24 : 22, 600);
    ctx.fillStyle = '#f6f5f3';
    lines(ctx, project.title, tx, ty + (compact ? 13 : 22), available, compact ? 14 : 25);
    if (!compact) {
      type(13, 600);
      ctx.fillStyle = '#c6c5c8';
      ctx.fillText('View project  ↗', tx, y + ch - 24);
    }
  });
}

/** Large type and a contact sheet read across the room. As the visitor
 * approaches, the mesh dissolves to the full project panel. */
export function drawOverview(canvas: HTMLCanvasElement, index: number, accent: Accent, images: Images) {
  const cat = CATEGORIES[index];
  const w = index === 0 ? 400 : 896,
    h = Math.round(w * [16 / 9, 9 / 21, 9 / 16][index]);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const pad = w * 0.045;
  ctx.fillStyle = '#161619';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top';
  const header = index === 0 ? h * 0.35 : h * 0.57;
  const img = images[cat.projects[0]];
  if (img && index > 0) {
    cover(ctx, img, w * 0.5, 0, w * 0.5, header);
    const veil = ctx.createLinearGradient(w * 0.46, 0, w, 0);
    veil.addColorStop(0, '#161619');
    veil.addColorStop(1, 'rgba(22,22,25,.18)');
    ctx.fillStyle = veil;
    ctx.fillRect(w * 0.46, 0, w * 0.54, header);
  }
  ctx.fillStyle = accent.glow;
  ctx.fillRect(pad, header * 0.2, Math.max(3, w * 0.006), header * 0.58);
  const tx = pad + w * 0.027;
  ctx.fillStyle = '#d9d8da';
  ctx.font = '600 ' + (index === 0 ? 28 : 36) + 'px "DM Sans"';
  ctx.fillText(cat.title, tx, header * 0.19);
  ctx.fillStyle = '#faf9f7';
  ctx.font = '400 ' + (index === 0 ? 54 : 62) + 'px "Greater Theory"';
  if (index === 0) {
    ctx.fillText('AI', tx, header * 0.37);
    ctx.fillText('Engineering', tx, header * 0.58, w - tx - pad);
  } else ctx.fillText(cat.titleBold, tx, header * 0.43, w * 0.69);
  const gap = 9;
  cat.projects.forEach((key, i) => {
    const row = index === 0;
    const cw = row ? w - pad * 2 : (w - pad * 2 - gap * (cat.projects.length - 1)) / cat.projects.length;
    const ch = row ? (h - header - pad - gap * 3) / 4 : h - header - pad;
    const x = pad + (row ? 0 : i * (cw + gap)),
      y = header + (row ? i * (ch + gap) : 0);
    ctx.fillStyle = '#262629';
    ctx.fillRect(x, y, cw, ch);
    const thumb = images[key];
    if (thumb) cover(ctx, thumb, x + 4, y + 4, row ? cw * 0.28 : cw - 8, row ? ch - 8 : ch * 0.66);
    ctx.fillStyle = '#efeff0';
    ctx.font = '600 ' + (row ? 22 : 19) + 'px "DM Sans"';
    lines(
      ctx,
      projectData[key].title,
      row ? x + cw * 0.32 : x + 8,
      row ? y + 15 : y + ch * 0.67 + 4,
      row ? cw * 0.65 : cw - 14,
      row ? 24 : 20
    );
  });
}
