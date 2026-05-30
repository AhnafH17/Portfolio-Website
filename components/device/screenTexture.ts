import * as THREE from 'three';
import { readAccent } from '@/lib/accent';

/**
 * The device screen as a scrollable canvas texture.
 *
 * We draw the full "About Me" page once onto a tall offscreen canvas, then each
 * frame blit a viewport-sized slice (offset by scroll) onto the visible canvas
 * that backs the screen texture. Because it IS the screen, it's automatically
 * perspective-correct and scales with the 3D model — no Html-transform math.
 */
export interface ScreenSurface {
  texture: THREE.CanvasTexture;
  render: (scroll01: number) => void; // scroll01 in [0,1]
  maxScroll: number;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
): number {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

export function createScreenSurface(kind: 'laptop' | 'phone'): ScreenSurface {
  const a = readAccent();
  const phone = kind === 'phone';
  const vw = phone ? 620 : 1112;            // visible screen width  (px)
  const vh = phone ? 1300 : 688;            // visible screen height (px)
  const padX = phone ? 56 : 80;
  const contentH = phone ? 4200 : 2600;     // tall content buffer

  // ── Offscreen content (drawn once) ──
  const content = document.createElement('canvas');
  content.width = vw;
  content.height = contentH;
  const c = content.getContext('2d')!;

  // Background wash
  c.fillStyle = '#0a0e14';
  c.fillRect(0, 0, vw, contentH);
  const wash = c.createRadialGradient(vw * 0.18, 60, 0, vw * 0.18, 60, vw * 1.1);
  wash.addColorStop(0, `rgba(${a.r},${a.g},${a.b},0.30)`);
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  c.fillStyle = wash;
  c.fillRect(0, 0, vw, contentH);

  const sz = (n: number) => Math.round(vw * n);
  let y = phone ? 150 : 120;

  // Eyebrow
  c.fillStyle = `rgba(${a.r},${a.g},${a.b},0.9)`;
  c.font = `600 ${sz(0.022)}px system-ui, sans-serif`;
  c.fillText('W H O   I   A M', padX, y);
  y += sz(0.06);

  // Name
  c.fillStyle = a.silver || '#e6eaed';
  c.font = `800 ${sz(0.085)}px "Syne", system-ui, sans-serif`;
  c.fillText('Ahnaf', padX, y);
  y += sz(0.092);
  c.fillText('Hussain', padX, y);
  y += sz(0.03);

  // Underline
  c.fillStyle = a.glow;
  c.fillRect(padX, y, sz(0.18), Math.max(3, sz(0.006)));
  y += sz(0.05);

  // Role
  c.fillStyle = `rgba(${a.r},${a.g},${a.b},0.92)`;
  c.font = `600 ${sz(0.032)}px system-ui, sans-serif`;
  c.fillText('Head of Web Development · AurixLab', padX, y);
  y += sz(0.09);

  const heading = (t: string) => {
    c.fillStyle = a.glow;
    c.fillRect(padX, y - sz(0.034), Math.max(4, sz(0.007)), sz(0.045));
    c.fillStyle = a.silver || '#e6eaed';
    c.font = `700 ${sz(0.046)}px "Syne", system-ui, sans-serif`;
    c.fillText(t, padX + sz(0.03), y);
    y += sz(0.06);
  };
  const para = (t: string) => {
    c.fillStyle = 'rgba(196,185,154,0.92)';
    c.font = `400 ${sz(0.03)}px system-ui, sans-serif`;
    y = wrapText(c, t, padX, y, vw - padX * 2, sz(0.044));
    y += sz(0.02);
  };
  const bullet = (t: string) => {
    c.fillStyle = a.glow;
    c.beginPath();
    c.arc(padX + sz(0.01), y - sz(0.01), sz(0.008), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(196,185,154,0.92)';
    c.font = `400 ${sz(0.028)}px system-ui, sans-serif`;
    y = wrapText(c, t, padX + sz(0.04), y, vw - padX * 2 - sz(0.04), sz(0.042));
    y += sz(0.012);
  };

  heading('My Journey');
  para('I started out obsessed with how interfaces feel — the weight of a transition, the rhythm of a layout. That obsession became a career building high-performance frontends and interactive experiences.');
  para('Today I lead the web team at AurixLab, shipping SaaS products and marketing sites that are fast, accessible, and a little bit unexpected.');
  y += sz(0.04);

  heading('How I Work');
  bullet('Performance first — every animation earns its frame budget.');
  bullet('Design and engineering are one loop, not two steps.');
  bullet('Ship, measure, refine. Real devices over assumptions.');
  bullet('The details are the product.');
  y += sz(0.04);

  heading('Toolkit');
  c.fillStyle = `rgba(${a.r},${a.g},${a.b},0.9)`;
  c.font = `500 ${sz(0.028)}px system-ui, sans-serif`;
  y = wrapText(c, 'Next.js · React · TypeScript · GSAP · Three.js · WordPress · Shopify · Python · SEO', padX, y, vw - padX * 2, sz(0.044));

  const contentBottom = y + (phone ? 120 : 80);
  const maxScroll = Math.max(0, contentBottom - vh);

  // ── Visible screen canvas (backs the texture) ──
  const screen = document.createElement('canvas');
  screen.width = vw;
  screen.height = vh;
  const s = screen.getContext('2d')!;

  const texture = new THREE.CanvasTexture(screen);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let last = -1;
  const render = (scroll01: number) => {
    const yOff = Math.round(THREE.MathUtils.clamp(scroll01, 0, 1) * maxScroll);
    if (yOff === last) return;
    last = yOff;
    s.fillStyle = '#0a0e14';
    s.fillRect(0, 0, vw, vh);
    s.drawImage(content, 0, -yOff);

    // top browser bar
    s.fillStyle = 'rgba(8,12,18,0.92)';
    s.fillRect(0, 0, vw, sz(0.05));
    const dotY = sz(0.025);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      s.beginPath();
      s.arc(padX * 0.5 + i * sz(0.03), dotY, sz(0.01), 0, Math.PI * 2);
      s.fillStyle = col;
      s.fill();
    });
    s.fillStyle = 'rgba(196,185,154,0.6)';
    s.font = `500 ${sz(0.018)}px system-ui, sans-serif`;
    s.fillText('ahnafhussain.dev / about', padX * 0.5 + sz(0.12), dotY + sz(0.007));

    texture.needsUpdate = true;
  };

  render(0);
  return { texture, render, maxScroll };
}
