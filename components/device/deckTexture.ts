import * as THREE from 'three';

// MacBook-style deck: silver surround, recessed black keyboard well with a grid
// of keycaps + a wide spacebar, and a silver trackpad below.
function roundRect(
  x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, r: number,
) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

export function makeDeckTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 478;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;

  // Silver surround
  x.fillStyle = '#bcc1c7';
  x.fillRect(0, 0, w, h);

  // Keyboard well (recessed black) — near the top (hinge side)
  const kw = w * 0.84;
  const kh = h * 0.52;
  const kx = (w - kw) / 2;
  const ky = h * 0.05;
  roundRect(x, kx, ky, kw, kh, 14);
  x.fillStyle = '#0b0d11';
  x.fill();

  // Keycaps
  const cols = 14;
  const rows = 5;
  const pad = kw * 0.011;
  const cw = (kw - pad * (cols + 1)) / cols;
  const ch = (kh - pad * (rows + 1)) / rows;
  x.fillStyle = '#1b1e25';
  for (let r = 0; r < rows - 1; r++) {
    for (let col = 0; col < cols; col++) {
      roundRect(x, kx + pad + col * (cw + pad), ky + pad + r * (ch + pad), cw, ch, 4);
      x.fill();
    }
  }
  // Bottom row: small keys + wide spacebar
  const by = ky + pad + (rows - 1) * (ch + pad);
  const side = 3; // small keys each side
  for (let col = 0; col < side; col++) {
    roundRect(x, kx + pad + col * (cw + pad), by, cw, ch, 4);
    x.fill();
  }
  const spX = kx + pad + side * (cw + pad);
  const spW = kw - pad * 2 - side * (cw + pad) * 2;
  roundRect(x, spX, by, spW, ch, 4);
  x.fill();
  for (let col = cols - side; col < cols; col++) {
    roundRect(x, kx + pad + col * (cw + pad), by, cw, ch, 4);
    x.fill();
  }

  // Trackpad (silver, subtle border) — front edge
  const tw = w * 0.34;
  const th = h * 0.33;
  const tx = (w - tw) / 2;
  const ty = ky + kh + h * 0.07;
  roundRect(x, tx, ty, tw, th, 12);
  x.fillStyle = '#b0b5bc';
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.20)';
  x.lineWidth = 2;
  x.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
