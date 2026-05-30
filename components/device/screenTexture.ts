import * as THREE from 'three';
import { readAccent } from '@/lib/accent';
import { createCollage } from './toolkitCollage';

/**
 * The device screen as a scrollable canvas texture.
 *
 * The full "About Me" page is drawn once onto a tall offscreen canvas; each
 * frame a viewport-sized slice (offset by scroll) is blitted onto the visible
 * canvas backing the texture. Because it IS the screen, it's perspective-correct
 * and scales with the model. `render(scroll01, time)` — `time` is reserved for
 * the animated toolkit collage.
 */
export interface ScreenSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number, time: number) => void;
  maxScroll: number;
}

interface Cfg {
  vw: number; vh: number; padX: number; contentH: number;
  eyebrow: number; name: number; role: number; head: number;
  body: number; bodyLH: number; bullet: number; bulletLH: number; tag: number;
}

const CFG: Record<'laptop' | 'phone', Cfg> = {
  laptop: { vw: 1112, vh: 690, padX: 74, contentH: 2800,
    eyebrow: 22, name: 104, role: 33, head: 52, body: 31, bodyLH: 46, bullet: 29, bulletLH: 44, tag: 27 },
  phone: { vw: 640, vh: 1320, padX: 52, contentH: 4400,
    eyebrow: 26, name: 92, role: 34, head: 56, body: 34, bodyLH: 52, bullet: 34, bulletLH: 52, tag: 31 },
};

const NAME = '#f3efe7';
const HEAD = '#f3efe7';
const BODY = 'rgba(214,208,196,0.94)';

function wrapText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, lh: number,
): number {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); line = w; y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

export function createScreenSurface(kind: 'laptop' | 'phone'): ScreenSurface {
  const a = readAccent();
  const f = CFG[kind];
  const { vw, vh, padX } = f;
  const accentRGBA = (o: number) => `rgba(${a.r},${a.g},${a.b},${o})`;
  const barH = Math.round(vw * 0.05);

  // ── Offscreen content (drawn once) ──
  const content = document.createElement('canvas');
  content.width = vw;
  content.height = f.contentH;
  const c = content.getContext('2d')!;

  c.fillStyle = '#0a0e14';
  c.fillRect(0, 0, vw, f.contentH);
  const wash = c.createRadialGradient(vw * 0.18, barH + 40, 0, vw * 0.18, barH + 40, vw * 1.1);
  wash.addColorStop(0, accentRGBA(0.26));
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  c.fillStyle = wash;
  c.fillRect(0, 0, vw, f.contentH);

  let y = barH + 70;

  // Eyebrow
  c.fillStyle = accentRGBA(0.9);
  c.font = `600 ${f.eyebrow}px system-ui, sans-serif`;
  c.fillText('W H O   I   A M', padX, y);
  y += f.name * 0.78;

  // Name (two lines)
  c.fillStyle = NAME;
  c.font = `800 ${f.name}px "Syne", system-ui, sans-serif`;
  c.fillText('Ahnaf', padX, y);
  y += f.name * 0.95;
  c.fillText('Hussain', padX, y);
  y += f.name * 0.34;

  // Underline
  c.fillStyle = a.glow;
  c.fillRect(padX, y, vw * 0.2, Math.max(4, vw * 0.006));
  y += f.role * 1.8;

  // Role
  c.fillStyle = accentRGBA(0.92);
  c.font = `600 ${f.role}px system-ui, sans-serif`;
  c.fillText('Head of Web Development · AurixLab', padX, y);
  y += f.head * 1.7;

  const heading = (t: string) => {
    c.fillStyle = a.glow;
    c.fillRect(padX, y - f.head * 0.78, Math.max(5, vw * 0.008), f.head);
    c.fillStyle = HEAD;
    c.font = `700 ${f.head}px "Syne", system-ui, sans-serif`;
    c.fillText(t, padX + vw * 0.03, y);
    y += f.head * 1.15;
  };
  const para = (t: string) => {
    c.fillStyle = BODY;
    c.font = `400 ${f.body}px system-ui, sans-serif`;
    y = wrapText(c, t, padX, y, vw - padX * 2, f.bodyLH);
    y += f.body * 0.6;
  };
  const bullet = (t: string) => {
    c.fillStyle = a.glow;
    c.beginPath();
    c.arc(padX + f.bullet * 0.35, y - f.bullet * 0.32, f.bullet * 0.28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = BODY;
    c.font = `400 ${f.bullet}px system-ui, sans-serif`;
    y = wrapText(c, t, padX + f.bullet * 1.1, y, vw - padX * 2 - f.bullet * 1.1, f.bulletLH);
    y += f.bullet * 0.45;
  };

  heading('My Journey');
  para('I started out obsessed with how interfaces feel — the weight of a transition, the rhythm of a layout. That obsession became a career building high-performance frontends and interactive experiences.');
  para('Today I lead the web team at AurixLab, shipping SaaS products and marketing sites that are fast, accessible, and a little bit unexpected.');
  y += f.head * 0.7;

  heading('How I Work');
  bullet('Performance first — every animation earns its frame budget.');
  bullet('Design and engineering are one loop, not two steps.');
  bullet('Ship, measure, refine. Real devices over assumptions.');
  bullet('The details are the product.');
  y += f.head * 0.7;

  heading('Toolkit');
  // Reserve a box for the animated logo collage (drawn live in render()).
  const collage = createCollage();
  const collageX = padX;
  const collageW = vw - padX * 2;
  const collageTop = y - f.head * 0.4;
  const collageH = kind === 'phone' ? 820 : 420;
  y = collageTop + collageH;

  const contentBottom = y + (kind === 'phone' ? 140 : 100);
  const maxScroll = Math.max(0, contentBottom - vh);

  // ── Visible screen canvas ──
  const screen = document.createElement('canvas');
  screen.width = vw;
  screen.height = vh;
  const s = screen.getContext('2d')!;

  const texture = new THREE.CanvasTexture(screen);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let lastY = -1;
  const render = (scroll01: number, time: number) => {
    const yOff = Math.round(THREE.MathUtils.clamp(scroll01, 0, 1) * maxScroll);

    // The collage animates, so while it's on-screen we must redraw every frame.
    const collageScreenY = collageTop - yOff;
    const collageVisible = collageScreenY < vh && collageScreenY + collageH > 0;
    if (yOff === lastY && !collageVisible) return;
    lastY = yOff;

    s.fillStyle = '#0a0e14';
    s.fillRect(0, 0, vw, vh);
    s.drawImage(content, 0, -yOff);

    if (collageVisible) {
      collage.draw(s, collageX, collageScreenY, collageW, collageH, time, a.glow);
    }

    // Top browser bar
    s.fillStyle = 'rgba(8,12,18,0.92)';
    s.fillRect(0, 0, vw, barH);
    const dotY = barH * 0.5;
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      s.beginPath();
      s.arc(padX * 0.5 + i * barH * 0.55, dotY, barH * 0.18, 0, Math.PI * 2);
      s.fillStyle = col; s.fill();
    });
    s.fillStyle = 'rgba(196,185,154,0.6)';
    s.font = `500 ${Math.round(barH * 0.34)}px system-ui, sans-serif`;
    s.textBaseline = 'middle';
    s.fillText('ahnafhussain.dev / about', padX * 0.5 + barH * 2.2, dotY + 1);
    s.textBaseline = 'alphabetic';

    texture.needsUpdate = true;
  };

  render(0, 0);
  return { texture, render, maxScroll };
}
