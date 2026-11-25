import { Box3, MathUtils, Mesh, Object3D, Vector3 } from 'three';
import { CATEGORIES } from './screens';

export const HOLDS = [
  [0.2, 0.3],
  [0.38, 0.48],
  [0.56, 0.69],
] as const;
export const FIRST_WORK = (HOLDS[0][0] + HOLDS[0][1]) / 2;
/** The beats above are timed against this much scroll, in screens. */
const BEAT_SCREENS = (phone: boolean) => (phone ? 4.4 : 4.8);
/** About starts rising as the camera leaves the last monitor, so the
 *  pull-back and its entrance happen together (beat units). */
export const ABOUT_RISE = HOLDS[2][1] + 0.012;
/** The pin ends one screen after About starts rising: About then fills it. */
export const tourScreens = (phone: boolean) => ABOUT_RISE * BEAT_SCREENS(phone) + 1;
/** Pin progress (0-1) to beat progress, and back. */
export const toBeat = (pin: number, phone: boolean) => (pin * tourScreens(phone)) / BEAT_SCREENS(phone);
export const toPin = (beat: number, phone: boolean) => (beat * BEAT_SCREENS(phone)) / tourScreens(phone);
/** Where About starts rising, in pin progress. */
export const aboutOverlapStart = (phone: boolean) => toPin(ABOUT_RISE, phone);
export const ease = (v: number) => {
  const t = MathUtils.clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

/** The scene powering on as the preloader opens, `seconds` after the reveal
 *  (null: not revealed yet, so the room is dark). The desk LED sweeps on,
 *  the screens follow left to right, the room lights come up, and the
 *  camera eases out of a closer, higher pose. */
export function introAt(seconds: number | null) {
  const s = seconds ?? 0;
  const ramp = (start: number, length: number) => MathUtils.clamp((s - start) / length, 0, 1);
  const screens = [0, 1, 2].map((i) => {
    const r = ramp(0.62 + i * 0.15, 0.24);
    // A short stutter as each panel catches, then a clean ramp.
    const flicker = r > 0.06 && r < 0.42 && Math.sin(s * 96 + i * 2.3) < -0.15 ? 0.3 : 1;
    return ease(r) * flicker;
  });
  const settle = ramp(0, 1.85);
  return {
    sweep: seconds === null ? 0 : ease(ramp(0.12, 0.62)),
    screens,
    room: 0.05 + 0.95 * ease(ramp(0.55, 0.95)),
    camera: 1 - (1 - settle) ** 3,
    done: s >= 1.9,
  };
}
const UP = new Vector3(0, 1, 0);
export interface Display {
  mesh: Mesh;
  centre: Vector3;
  normal: Vector3;
  tl: Vector3;
  tr: Vector3;
  br: Vector3;
  bl: Vector3;
  width: number;
  height: number;
}

export function measureDisplays(scene: Object3D): Display[] {
  scene.updateWorldMatrix(true, true);
  return CATEGORIES.map(({ monitor }) => {
    const mesh = scene.getObjectByName('SCREEN_' + monitor) as Mesh;
    const { position, uv } = mesh.geometry.attributes;
    // glTF UV origin is top-left. Read the actual corners, including meshopt's
    // decode transform, so neither fit nor hit targets depend on model scale.
    const corner = (u: number, v: number) => {
      let nearest = 0,
        best = Infinity;
      for (let i = 0; i < uv.count; i++) {
        const d = Math.abs(uv.getX(i) - u) + Math.abs(uv.getY(i) - v);
        if (d < best) {
          nearest = i;
          best = d;
        }
      }
      return mesh.localToWorld(new Vector3().fromBufferAttribute(position, nearest));
    };
    const tl = corner(0, 0),
      tr = corner(1, 0),
      br = corner(1, 1),
      bl = corner(0, 1);
    const right = tr.clone().sub(tl),
      up = tr.clone().sub(br);
    return {
      mesh,
      tl,
      tr,
      br,
      bl,
      centre: new Box3().setFromPoints([tl, tr, br, bl]).getCenter(new Vector3()),
      normal: new Vector3().crossVectors(right, up).normalize(),
      width: right.length(),
      height: up.length(),
    };
  });
}

interface Pose {
  eye: Vector3;
  at: Vector3;
  fov: number;
  shiftX: number;
  shiftY: number;
}
export function pose(): Pose {
  return { eye: new Vector3(), at: new Vector3(), fov: 38, shiftX: 0, shiftY: 0 };
}
function framedRoom(
  boxes: Box3[],
  aspect: number,
  direction: Vector3,
  fillX: number,
  fillY: number,
  shiftX = 0,
  shiftY = 0
): Pose {
  const dir = direction.normalize();
  const right = new Vector3().crossVectors(UP, dir).normalize();
  const up = new Vector3().crossVectors(dir, right);
  const box = new Box3();
  boxes.forEach((b) => box.union(b));
  const at = box.getCenter(new Vector3());
  const v = Math.tan(MathUtils.degToRad(38 / 2)),
    h = v * aspect;
  let distance = 0;
  // The tightest horizontal/vertical half-extent sets the distance. Account
  // for corner depth so a chair close to the lens still clears the edge.
  for (const b of boxes)
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y])
        for (const z of [b.min.z, b.max.z]) {
          const p = new Vector3(x, y, z).sub(at);
          distance = Math.max(
            distance,
            p.dot(dir) + Math.max(Math.abs(p.dot(right)) / (h * fillX), Math.abs(p.dot(up)) / (v * fillY))
          );
        }
  return { eye: at.clone().addScaledVector(dir, distance), at, fov: 38, shiftX, shiftY };
}

export function fitTour(scene: Object3D, displays: Display[], aspect: number, phone: boolean) {
  const bounds = (name: string) => new Box3().setFromObject(scene.getObjectByName(name)!, true);
  const furniture = ['DESK', 'CHAIR', 'PERSON', 'MON_Left', 'MON_Centre', 'MON_Right', 'PC_Tower'].map(
    bounds
  );
  const portrait = aspect < 0.9;
  // Compose around the desk surface and upper chair on wide displays. The
  // chair base can run below the frame, like the foreground of a photograph.
  const above = (height: number) =>
    furniture
      .filter((box) => box.max.y > height)
      .map((box) => new Box3(box.min.clone().setY(Math.max(height, box.min.y)), box.max));
  // On tall screens the three monitors span the width under the name; the
  // desk and figure follow below and the chair base leaves the frame.
  const hero = framedRoom(
    portrait ? furniture.slice(3, 6) : above(0.27),
    aspect,
    new Vector3(phone ? 0.055 : 0.3, phone ? 0.47 : 0.32, 1),
    portrait ? 0.95 : 0.7,
    portrait ? 4 : 0.98,
    portrait ? 0 : 0.29,
    portrait ? -0.14 : -0.03
  );
  const outroBounds = above(portrait ? 0.28 : 0.53);
  const wide = framedRoom(outroBounds, aspect, new Vector3(0.035, 0.33, 1), 0.94, 0.94);
  const screens = displays.map((d) => {
    // Keep the housing and some of the desk in frame at each stop. Limit
    // distance on narrow viewports so the visitor never lands in the chair.
    const occupancy = portrait ? 0.86 : d.width > d.height ? 0.67 : 0.72;
    const radius = Math.max(d.width / (2 * aspect), d.height / 2) / occupancy;
    const clearance = portrait ? 0.54 + d.height * 0.35 : d.height + 0.45;
    const fov = Math.max(48, MathUtils.radToDeg(2 * Math.atan(radius / clearance)));
    const dist = radius / Math.tan(MathUtils.degToRad(fov / 2));
    const direction = d.normal.clone().addScaledVector(UP, 0.085);
    direction.addScaledVector(d.tr.clone().sub(d.tl).normalize(), -0.06).normalize();
    return {
      eye: d.centre.clone().addScaledVector(direction, dist),
      at: d.centre,
      fov,
      shiftX: 0,
      shiftY: 0.05,
    };
  });
  const chair = furniture[1],
    hood = bounds('Shoulders');
  const shoulder = new Vector3(
    chair.min.x - (chair.max.x - chair.min.x) * 0.33,
    hood.max.y + displays[0].height * 0.5,
    chair.max.z
  );
  // The pull-back ends with About three quarters up: its heading is already
  // on screen while the camera settles.
  const rise = 1 / BEAT_SCREENS(phone);
  return { hero, screens, wide, shoulder, pullEnd: ABOUT_RISE + rise * 0.72, riseEnd: ABOUT_RISE + rise, arc: displays[1].width * 0.31 };
}

function blend(out: Pose, a: Pose, b: Pose, t: number) {
  out.eye.lerpVectors(a.eye, b.eye, t);
  out.at.lerpVectors(a.at, b.at, t);
  out.fov = MathUtils.lerp(a.fov, b.fov, t);
  out.shiftX = MathUtils.lerp(a.shiftX, b.shiftX, t);
  out.shiftY = MathUtils.lerp(a.shiftY, b.shiftY, t);
}
export function sampleTour(tour: ReturnType<typeof fitTour>, p: number, out: Pose) {
  const { hero, screens, wide, pullEnd, riseEnd, arc, shoulder } = tour;
  let light = 1;
  let panel = -1;
  if (p < HOLDS[0][0]) {
    const t = ease((p - 0.08) / (HOLDS[0][0] - 0.08));
    blend(out, hero, screens[0], t);
    // Quadratic Bezier carries the eye above and outside the left shoulder.
    out.eye
      .copy(hero.eye)
      .multiplyScalar((1 - t) * (1 - t))
      .addScaledVector(shoulder, 2 * t * (1 - t))
      .addScaledVector(screens[0].eye, t * t);
    light = 1 - 0.37 * ease((t - 0.68) / 0.32);
  } else if (p <= HOLDS[2][1]) {
    const index = HOLDS.findIndex(([, end]) => p <= end);
    const [start] = HOLDS[index];
    if (p >= start) {
      blend(out, screens[index], screens[index], 0);
      panel = index;
      light = 0.63;
    } else {
      const t = ease((p - HOLDS[index - 1][1]) / (start - HOLDS[index - 1][1]));
      blend(out, screens[index - 1], screens[index], t);
      const arcAmount = Math.sin(Math.PI * t);
      out.eye.z += arc * arcAmount;
      out.eye.y += arc * 0.22 * arcAmount;
      light = 0.63 + 0.23 * arcAmount;
    }
  } else {
    const t = ease((p - HOLDS[2][1]) / (pullEnd - HOLDS[2][1]));
    blend(out, screens[2], wide, t);
    // The room brightens on the way out, then dims back under About.
    light = (0.63 + 0.37 * t) * (1 - 0.35 * ease((p - ABOUT_RISE) / (riseEnd - ABOUT_RISE)));
  }
  // Pointer targets track the screen during arrival and departure. Only
  // settled monitors are added to the normal keyboard tab order.
  const nearPanel =
    panel >= 0 ? panel : HOLDS.findIndex(([start, end]) => p >= start - 0.021 && p <= end + 0.021);
  return { light, panel: nearPanel, settled: nearPanel >= 0 && panel === nearPanel };
}

/** Project a flat link layer through the same four corners as the display. */
export function panelTransform(corners: Vector3[], width: number, height: number, w: number, h: number) {
  const [tl, tr, br, bl] = corners;
  const x0 = ((1 + tl.x) * width) / 2,
    y0 = ((1 - tl.y) * height) / 2;
  const x1 = ((1 + tr.x) * width) / 2,
    y1 = ((1 - tr.y) * height) / 2;
  const x2 = ((1 + br.x) * width) / 2,
    y2 = ((1 - br.y) * height) / 2;
  const x3 = ((1 + bl.x) * width) / 2,
    y3 = ((1 - bl.y) * height) / 2;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const j = (dx1 * dy3 - dx3 * dy1) / det;
  const a = (x1 - x0 + g * x1) / w,
    b = (x3 - x0 + j * x3) / h;
  const d = (y1 - y0 + g * y1) / w,
    e = (y3 - y0 + j * y3) / h;
  return 'matrix3d(' + [a, d, 0, g / w, b, e, 0, j / h, 0, 0, 1, 0, x0, y0, 0, 1].join(',') + ')';
}
