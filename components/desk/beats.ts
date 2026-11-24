import { Box3, MathUtils, Mesh, Object3D, Vector3 } from 'three';
import { CATEGORIES } from './screens';

export const HOLDS = [
  [0.224, 0.3],
  [0.393, 0.474],
  [0.553, 0.635],
] as const;
export const FIRST_WORK = (HOLDS[0][0] + HOLDS[0][1]) / 2;
export const ease = (v: number) => {
  const t = MathUtils.clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const UP = new Vector3(0, 1, 0);
export interface Display {
  mesh: Mesh;
  centre: Vector3;
  normal: Vector3;
  tl: Vector3;
  br: Vector3;
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
      br = corner(1, 1);
    const right = tr.clone().sub(tl),
      up = tr.clone().sub(br);
    return {
      mesh,
      tl,
      br,
      centre: new Box3().setFromPoints([tl, tr, br, corner(0, 1)]).getCenter(new Vector3()),
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
  const hero = framedRoom(
    furniture,
    aspect,
    new Vector3(phone ? 0.055 : 0.42, phone ? 0.47 : 0.28, 1),
    portrait ? 0.97 : 0.66,
    portrait ? 0.64 : 0.9,
    portrait ? 0 : 0.3,
    portrait ? -0.23 : -0.03
  );
  const wide = framedRoom(furniture, aspect, new Vector3(0.025, 0.16, 1), 0.92, 0.87);
  const exit = framedRoom(furniture, aspect, new Vector3(0.08, 1.5, 1), 0.75, 0.53, 0, -0.32);
  const screens = displays.map((d) => {
    // Change lens during the approach on narrow viewports. A long-lens
    // width fit would put the visitor behind the hood even at a screen hold.
    const radius = Math.max(d.width / (2 * aspect), d.height / 2) / 0.92;
    const clearance = portrait ? 0.5 + d.height * 0.35 : d.height + 0.41;
    const fov = Math.max(49, MathUtils.radToDeg(2 * Math.atan(radius / clearance)));
    const dist = radius / Math.tan(MathUtils.degToRad(fov / 2));
    return { eye: d.centre.clone().addScaledVector(d.normal, dist), at: d.centre, fov, shiftX: 0, shiftY: 0 };
  });
  const chair = furniture[1],
    hood = bounds('Shoulders');
  const shoulder = new Vector3(
    chair.min.x - (chair.max.x - chair.min.x) * 0.33,
    hood.max.y + displays[0].height * 0.5,
    chair.max.z
  );
  return { hero, screens, wide, exit, shoulder, arc: displays[1].width * 0.31 };
}

function blend(out: Pose, a: Pose, b: Pose, t: number) {
  out.eye.lerpVectors(a.eye, b.eye, t);
  out.at.lerpVectors(a.at, b.at, t);
  out.fov = MathUtils.lerp(a.fov, b.fov, t);
  out.shiftX = MathUtils.lerp(a.shiftX, b.shiftX, t);
  out.shiftY = MathUtils.lerp(a.shiftY, b.shiftY, t);
}
export function sampleTour(tour: ReturnType<typeof fitTour>, p: number, out: Pose) {
  const { hero, screens, wide, exit, arc, shoulder } = tour;
  let light = 1,
    panel = -1,
    opacity = 0;
  if (p < HOLDS[0][0]) {
    const t = ease((p - 0.08) / (HOLDS[0][0] - 0.08));
    blend(out, hero, screens[0], t);
    // Quadratic Bezier carries the eye above and outside the left shoulder.
    out.eye
      .copy(hero.eye)
      .multiplyScalar((1 - t) * (1 - t))
      .addScaledVector(shoulder, 2 * t * (1 - t))
      .addScaledVector(screens[0].eye, t * t);
    light = 1 - 0.75 * ease((t - 0.85) / 0.15);
  } else if (p <= HOLDS[2][1]) {
    const index = HOLDS.findIndex(([, end]) => p <= end);
    const [start, end] = HOLDS[index];
    if (p >= start) {
      blend(out, screens[index], screens[index], 0);
      panel = index;
      opacity = ease(Math.min(p - start, end - p) / 0.009);
      light = 0.25;
    } else {
      const t = ease((p - HOLDS[index - 1][1]) / (start - HOLDS[index - 1][1]));
      blend(out, screens[index - 1], screens[index], t);
      const arcAmount = Math.sin(Math.PI * t);
      out.eye.z += arc * arcAmount;
      out.eye.y += arc * 0.22 * arcAmount;
      light = 0.25 + 0.35 * arcAmount;
    }
  } else if (p < 0.8) {
    const t = ease((p - HOLDS[2][1]) / (0.8 - HOLDS[2][1]));
    blend(out, screens[2], wide, t);
    light = 0.25 + 0.75 * t;
  } else blend(out, wide, exit, ease((p - 0.8) / 0.2));
  return { light, panel, opacity };
}
