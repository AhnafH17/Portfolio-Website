import {
  siNextdotjs, siReact, siTypescript, siGreensock,
  siThreedotjs, siWordpress, siShopify, siPython,
} from 'simple-icons';

// Tech logos drawn as WHITE glyphs (brand colours would vanish on the dark
// screen) with a palette-accent glow, floating in an animated collage.
const ICONS = [siNextdotjs, siReact, siTypescript, siGreensock, siThreedotjs, siWordpress, siShopify, siPython];

// Scatter layout: x/y are fractions of the collage box, s is size factor,
// ph is the animation phase offset.
const LAYOUT = [
  { x: 0.16, y: 0.26, s: 1.15, ph: 0.0 },
  { x: 0.5,  y: 0.16, s: 1.0,  ph: 1.1 },
  { x: 0.84, y: 0.28, s: 1.1,  ph: 2.2 },
  { x: 0.3,  y: 0.56, s: 0.95, ph: 0.7 },
  { x: 0.68, y: 0.54, s: 1.05, ph: 1.8 },
  { x: 0.12, y: 0.78, s: 0.9,  ph: 2.6 },
  { x: 0.5,  y: 0.84, s: 1.0,  ph: 0.4 },
  { x: 0.86, y: 0.78, s: 0.92, ph: 1.5 },
];

export interface Collage {
  draw: (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    time: number, glow: string,
  ) => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createCollage(): Collage {
  const imgs = ICONS.map((ic) => {
    const img = new Image();
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ic.path}" fill="white"/></svg>`,
      );
    return img;
  });

  // Cached radial-glow sprite (built once per glow colour). Drawing this is
  // far cheaper than canvas `shadowBlur` every frame for every icon.
  let glowSprite: HTMLCanvasElement | null = null;
  let glowKey = '';
  const buildGlow = (glow: string) => {
    const s = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d')!;
    const [r, gg, b] = hexToRgb(glow);
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${r},${gg},${b},0.5)`);
    grad.addColorStop(0.5, `rgba(${r},${gg},${b},0.16)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    glowSprite = cv;
    glowKey = glow;
  };

  const draw: Collage['draw'] = (ctx, x, y, w, h, time, glow) => {
    if (glowKey !== glow) buildGlow(glow);
    const base = Math.min(w, h * 0.5);
    imgs.forEach((im, i) => {
      if (!im.complete || im.naturalWidth === 0) return;
      const L = LAYOUT[i];
      const size = base * 0.26 * L.s;
      const cx = x + L.x * w;
      const cy = y + L.y * h + Math.sin(time * 1.1 + L.ph) * size * 0.18;
      const rot = Math.sin(time * 0.6 + L.ph) * 0.14;
      const pulse = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.4 + L.ph));
      ctx.save();
      ctx.translate(cx, cy);
      // Cheap cached glow behind the icon
      if (glowSprite) {
        const gs = size * 2.2 * pulse;
        ctx.drawImage(glowSprite, -gs / 2, -gs / 2, gs, gs);
      }
      ctx.rotate(rot);
      ctx.globalAlpha = 0.96;
      ctx.drawImage(im, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  };

  return { draw };
}
