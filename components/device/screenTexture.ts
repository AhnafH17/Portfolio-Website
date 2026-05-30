import * as THREE from 'three';
import { readAccent } from '@/lib/accent';

/**
 * Draws a stylised "screen content" image on an offscreen canvas and returns it
 * as a texture for the device display. Tinted to the currently-active palette
 * (via readAccent) so the 3D screen matches the rest of the site.
 *
 * This is the *cinematic* screen used during the hero animation. Once the device
 * is docked, real HTML content takes over (hybrid approach) — see DeviceShowcase.
 */
export function makeScreenTexture(kind: 'laptop' | 'phone'): THREE.CanvasTexture {
  const a = readAccent();
  const w = kind === 'laptop' ? 1024 : 560;
  const h = kind === 'laptop' ? 640 : 1024;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // ── Base ──
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, w, h);

  // ── Accent wash (top-left glow) ──
  const wash = ctx.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, w * 0.9);
  wash.addColorStop(0, `rgba(${a.r},${a.g},${a.b},0.40)`);
  wash.addColorStop(0.6, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.08;

  // ── Window chrome dots ──
  const dotY = h * 0.08;
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(pad + i * w * 0.035, dotY, w * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  // ── Big name ──
  ctx.fillStyle = a.silver;
  ctx.font = `700 ${Math.round(w * (kind === 'laptop' ? 0.075 : 0.11))}px "Syne", system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Ahnaf', pad, h * 0.30);
  ctx.fillText('Hussain', pad, h * (kind === 'laptop' ? 0.42 : 0.40));

  // ── Accent underline ──
  ctx.fillStyle = a.glow;
  ctx.fillRect(pad, h * (kind === 'laptop' ? 0.46 : 0.44), w * 0.18, h * 0.012);

  // ── Subtitle ──
  ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},0.85)`;
  ctx.font = `500 ${Math.round(w * (kind === 'laptop' ? 0.03 : 0.05))}px system-ui, sans-serif`;
  ctx.fillText('Head of Web Development', pad, h * (kind === 'laptop' ? 0.53 : 0.52));

  // ── Faux content bars ──
  const barY0 = h * (kind === 'laptop' ? 0.64 : 0.62);
  const barH = h * 0.022;
  const widths = [0.72, 0.6, 0.66, 0.45];
  widths.forEach((wd, i) => {
    ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},${0.22 - i * 0.03})`;
    ctx.fillRect(pad, barY0 + i * barH * 2.4, w * (1 - pad / w * 2) * wd, barH);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
