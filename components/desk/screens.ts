import type { Accent } from '@/lib/accent';
import { projectData, stripMeta, type ProjectKey } from '@/lib/projects';
import { THUMBNAIL_ATLAS } from './thumbnailAtlas';

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
interface ScreenLayout {
  w: number;
  h: number;
  portrait: boolean;
  compact: boolean;
  pad: number;
  cards: Rect[];
}

/** Dimensions shared by the screen paint and its accessible link targets. */
export function screenLayout(index: number, narrow: boolean): ScreenLayout {
  const portrait = index === 0;
  const compact = narrow && !portrait;
  const w = portrait ? 430 : compact ? 360 : 960;
  const h = Math.round(w * [16 / 9, 9 / 21, 9 / 16][index]);
  const pad = compact ? 12 : portrait ? 27 : 38;
  const gap = compact ? 5 : portrait ? 10 : 12;
  const top = compact ? (index === 1 ? 51 : 63) : portrait ? 205 : index === 1 ? 153 : 188;
  const count = CATEGORIES[index].projects.length;
  const columns = portrait ? 1 : compact ? 2 : count;
  const rows = Math.ceil(count / columns);
  const cw = (w - pad * 2 - (columns - 1) * gap) / columns;
  const ch = (h - top - pad - (rows - 1) * gap) / rows;
  return {
    w,
    h,
    portrait,
    compact,
    pad,
    cards: Array.from({ length: count }, (_, i) => ({
      x: pad + (i % columns) * (cw + gap),
      y: top + Math.floor(i / columns) * (ch + gap),
      w: cw,
      h: ch,
    })),
  };
}

let thumbnails: Promise<HTMLImageElement | null> | undefined;
export function loadDeskThumbnails() {
  if (!thumbnails) {
    const image = new Image();
    image.src = '/images/hero/desk-projects.webp';
    thumbnails = image.decode().then(
      () => image,
      () => null
    );
  }
  return thumbnails;
}

const thumbnailIndex = new Map<string, number>(THUMBNAIL_ATLAS.names.map((name, index) => [name, index]));

function drawThumbnail(ctx: CanvasRenderingContext2D, img: HTMLImageElement, key: ProjectKey, box: Rect) {
  const index = thumbnailIndex.get(key);
  if (index === undefined) return;
  const { width, height, columns } = THUMBNAIL_ATLAS;
  const scale = Math.max(box.w / width, box.h / height);
  const sw = box.w / scale,
    sh = box.h / scale;
  const sx = (index % columns) * width + (width - sw) / 2;
  const sy = Math.floor(index / columns) * height + (height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
}

function writeWrapped(
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
      ctx.fillText(line, x, y, width);
      y += leading;
      line = word;
    } else line = next;
  }
  ctx.fillText(line, x, y, width);
}

export function drawScreen(
  canvas: HTMLCanvasElement,
  index: number,
  narrow: boolean,
  accent: Accent,
  thumbs: HTMLImageElement | null
) {
  const { w, h, compact, portrait, cards, pad } = screenLayout(index, narrow);
  const scale = Math.min(3, 1536 / Math.max(w, h));
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
  const backdrop = ctx.createLinearGradient(0, 0, w * 0.8, h);
  backdrop.addColorStop(0, '#292c33');
  backdrop.addColorStop(0.48, '#1c1e24');
  backdrop.addColorStop(1, '#15171c');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, w, h);

  if (compact) {
    rect(pad, 8, 13, 1.2, accent.light);
    type(11, 600);
    ctx.fillStyle = '#c6c8ce';
    ctx.fillText(cat.title, pad, 14);
    type(16, 400, true);
    ctx.fillStyle = '#f4f3f3';
    ctx.fillText(cat.titleBold, pad, 29, w - pad * 2);
  } else {
    type(portrait ? 14 : 13, 600);
    ctx.fillStyle = '#e0e1e6';
    ctx.fillText('Selected work', pad, 20);
    rect(pad, 42, w - pad * 2, 1, '#4a4e57');
    rect(pad, 42, portrait ? 24 : 34, 1.6, accent.light);
    const top = portrait ? 64 : 54;
    type(portrait ? 23 : 22, 500);
    ctx.fillStyle = '#d5d8df';
    ctx.fillText(cat.title, pad, top);
    type(portrait ? 30 : 42, 400, true);
    ctx.fillStyle = '#f5f4f4';
    ctx.fillText(cat.titleBold, pad, top + (portrait ? 34 : 29), w - pad * 2);
    type(portrait ? 16 : 16, 400);
    ctx.fillStyle = '#b9bec8';
    writeWrapped(ctx, cat.subtitle, pad, portrait ? 151 : 130, w - pad * 2, 20);
  }

  cards.forEach((card, i) => {
    const { x, y, w: cw, h: ch } = card;
    const key = cat.projects[i];
    const row = compact || portrait;
    const inset = compact ? 5 : 8;
    const imageW = row ? (compact ? 28 : cw * 0.33) : cw - 2 * inset;
    const imageH = row ? ch - 2 * inset : ch * 0.53;
    const img = { x: x + inset, y: y + inset, w: imageW, h: imageH };
    rect(x, y, cw, ch, '#252932');
    rect(x, y, cw, 1, '#434954');
    rect(img.x, img.y, img.w, img.h, '#17191f');
    if (thumbs) {
      drawThumbnail(ctx, thumbs, key, img);
      rect(img.x, img.y, img.w, img.h, 'rgba(13,16,23,.12)');
    }

    const tx = row ? img.x + imageW + (compact ? 6 : 13) : x + 13;
    const available = x + cw - tx - (compact ? 5 : 17);
    const ty = row ? y + (compact ? 3 : 16) : img.y + imageH + 8;
    type(compact ? 9 : 12, 600);
    ctx.fillStyle = accent.light;
    ctx.fillText(tags[key][0], tx, ty, available);
    type(compact ? 12 : portrait ? 20 : 18, 600);
    ctx.fillStyle = '#f0f1f4';
    writeWrapped(ctx, projectData[key].title, tx, ty + (compact ? 11 : 18), available, compact ? 13 : 22);
    if (!compact) {
      type(portrait ? 15 : 16, 500);
      ctx.fillStyle = '#c4c8d1';
      ctx.textAlign = 'right';
      ctx.fillText('↗', x + cw - 12, y + ch - 24);
      ctx.textAlign = 'left';
    }
  });
}
