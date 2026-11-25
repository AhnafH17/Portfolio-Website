import { Box3, MathUtils, Mesh, Object3D, Vector3 } from 'three';
import { CATEGORIES } from './screens';
import { above, framedRoom, FURNITURE, heroPose, isPortrait, panelTransform, type Box, type HeroPose } from './heroPose';
import { ABOUT_RISE, BEAT_SCREENS, ease, HOLDS } from './timeline';

// The timing lives in timeline.ts and the camera maths in heroPose.ts (no
// three.js there, for the page's first bundle and the preloader).
export {
  ABOUT_RISE,
  aboutOverlapStart,
  ease,
  FIRST_WORK,
  HOLDS,
  introAt,
  toBeat,
  toPin,
  tourScreens,
} from './timeline';
export { panelTransform };

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
const toBox = (b: Box3): Box => [b.min.toArray(), b.max.toArray()];
const toPose = (p: HeroPose): Pose => ({ ...p, eye: new Vector3(...p.eye), at: new Vector3(...p.at) });

export function fitTour(scene: Object3D, displays: Display[], aspect: number, phone: boolean) {
  const bounds = (name: string) => new Box3().setFromObject(scene.getObjectByName(name)!, true);
  const furniture = FURNITURE.map(bounds);
  const portrait = isPortrait(aspect);
  // The opening view: the same function the preloader's drawing uses.
  const hero = toPose(heroPose(furniture.map(toBox), aspect, phone));
  const outroBounds = above(furniture.map(toBox), portrait ? 0.28 : 0.53);
  const wide = toPose(framedRoom(outroBounds, aspect, [0.035, 0.33, 1], 0.94, 0.94));
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
