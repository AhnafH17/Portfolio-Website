import { LAND_DOTS } from './landDots';

/* The testimonials' particle globe (components/ParticleGlobe.tsx), shared
   with the Impacts -> Testimonials handoff, which flies the Impacts stars'
   light into exactly the dots the globe is about to draw. */

const D2R = Math.PI / 180;
export const DOT_COUNT = LAND_DOTS.length / 2;
/** Per dot: cos(lat), sin(lat), lng (radians). */
export const DOT_GEO = (() => {
  const g = new Float32Array(DOT_COUNT * 3);
  for (let i = 0; i < DOT_COUNT; i++) {
    const lat = (LAND_DOTS[i * 2] / 10) * D2R, lng = (LAND_DOTS[i * 2 + 1] / 10) * D2R;
    g[i * 3] = Math.cos(lat);
    g[i * 3 + 1] = Math.sin(lat);
    g[i * 3 + 2] = lng;
  }
  return g;
})();

export const HOME = { lat: 23.68, lng: 90.36, label: 'Bangladesh' };

/** Live view of the globe, written by ParticleGlobe every frame it draws. */
export const globeState = {
  canvas: null as HTMLCanvasElement | null,
  /** Centre and radius in canvas CSS px. */
  cx: 0, cy: 0, r: 0,
  /** Longitude facing the viewer, and the view's tilt (radians). */
  lng0: HOME.lng * D2R,
  tilt: 22 * D2R,
  /** 0..1, set by the handoff while the globe is being assembled. */
  reveal: 1,
};

/** Orthographic projection of dot i: [x, y, depth] in canvas px; depth > 0 faces the viewer. */
export function projectDot(i: number, out: Float32Array, o = 0) {
  const { cx, cy, r, lng0, tilt } = globeState;
  const cl = DOT_GEO[i * 3], sl = DOT_GEO[i * 3 + 1], d = DOT_GEO[i * 3 + 2] - lng0;
  const x = cl * Math.sin(d), y0 = sl, z0 = cl * Math.cos(d);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  out[o] = cx + r * x;
  out[o + 1] = cy - r * (y0 * ct - z0 * st);
  out[o + 2] = y0 * st + z0 * ct;
}

/** The same projection for any lat/lng (degrees), lifted by `lift` (0 = surface). */
export function projectLatLng(lat: number, lng: number, lift = 0): [number, number, number] {
  const { cx, cy, r, lng0, tilt } = globeState;
  const la = lat * D2R, d = lng * D2R - lng0;
  const cl = Math.cos(la), sl = Math.sin(la);
  const x = cl * Math.sin(d), y0 = sl, z0 = cl * Math.cos(d);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const k = r * (1 + lift);
  return [cx + k * x, cy - k * (y0 * ct - z0 * st), y0 * st + z0 * ct];
}
