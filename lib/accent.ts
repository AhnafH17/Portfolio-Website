// Reads the currently-active palette's accent colors from CSS variables.
// Used by canvas / WebGL components that can't consume CSS vars directly.
export interface Accent {
  r: number; g: number; b: number;
  rgb: [number, number, number];
  glow: string;    // bright accent hex
  light: string;   // light accent hex
  deep: string;    // deep accent hex
  silver: string;  // light text/silver hex
}

export function readAccent(): Accent {
  if (typeof window === 'undefined') {
    return { r: 204, g: 24, b: 44, rgb: [204, 24, 44], glow: '#CC182C', light: '#ff6b7d', deep: '#A41326', silver: '#C2CAD0' };
  }
  const s = getComputedStyle(document.documentElement);
  const triplet = (s.getPropertyValue('--accent-rgb').trim() || '204,24,44')
    .split(',').map((n) => parseInt(n.trim(), 10));
  const [r, g, b] = [triplet[0] || 204, triplet[1] || 24, triplet[2] || 44];
  return {
    r, g, b,
    rgb: [r, g, b],
    glow: s.getPropertyValue('--accent-glow').trim() || '#CC182C',
    light: s.getPropertyValue('--accent-light').trim() || '#ff6b7d',
    deep: s.getPropertyValue('--accent').trim() || '#A41326',
    silver: s.getPropertyValue('--silver').trim() || '#C2CAD0',
  };
}
