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

  const draw: Collage['draw'] = (ctx, x, y, w, h, time, glow) => {
    const base = Math.min(w, h * 0.5);
    imgs.forEach((im, i) => {
      if (!im.complete || im.naturalWidth === 0) return;
      const L = LAYOUT[i];
      const size = base * 0.26 * L.s;
      const cx = x + L.x * w;
      const cy = y + L.y * h + Math.sin(time * 1.1 + L.ph) * size * 0.18;
      const rot = Math.sin(time * 0.6 + L.ph) * 0.14;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.shadowColor = glow;
      ctx.shadowBlur = size * (0.45 + 0.2 * (0.5 + 0.5 * Math.sin(time * 1.4 + L.ph)));
      ctx.globalAlpha = 0.95;
      ctx.drawImage(im, -size / 2, -size / 2, size, size);
      ctx.restore();
    });
  };

  return { draw };
}
