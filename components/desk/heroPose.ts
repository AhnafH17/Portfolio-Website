/* The desk camera's maths without three.js, so the preloader can place its
   line drawing exactly where the 3D desk will render before the model (and
   three.js) has arrived. beats.ts builds the tour on these same functions,
   and scripts/make-desk-outline.mjs uses them to pick the view its contour
   lines are traced for. Keep this file free of imports: Node loads it
   directly in that script. */

export type Vec3 = [number, number, number];
/** An axis-aligned box: [min, max]. */
export type Box = [Vec3, Vec3];
export interface HeroPose {
  eye: Vec3;
  at: Vec3;
  fov: number;
  shiftX: number;
  shiftY: number;
}

/** The boxes the framing reads, in this order (see fitTour in beats.ts). */
export const FURNITURE = ['DESK', 'CHAIR', 'PERSON', 'MON_Left', 'MON_Centre', 'MON_Right', 'PC_Tower'] as const;
export const HERO_FOV = 38;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const UP: Vec3 = [0, 1, 0];

/** The camera that frames `boxes` from `direction`, filling `fillX` x
 *  `fillY` of the view. The tightest horizontal/vertical half-extent sets the
 *  distance, with each corner's depth counted, so a chair close to the lens
 *  still clears the edge. */
export function framedRoom(
  boxes: Box[],
  aspect: number,
  direction: Vec3,
  fillX: number,
  fillY: number,
  shiftX = 0,
  shiftY = 0
): HeroPose {
  const dir = unit(direction);
  const right = unit(cross(UP, dir));
  const up = cross(dir, right);
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const [lo, hi] of boxes)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], lo[k]);
      max[k] = Math.max(max[k], hi[k]);
    }
  const at: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const v = Math.tan(((HERO_FOV / 2) * Math.PI) / 180),
    h = v * aspect;
  let distance = 0;
  for (const [lo, hi] of boxes)
    for (const x of [lo[0], hi[0]])
      for (const y of [lo[1], hi[1]])
        for (const z of [lo[2], hi[2]]) {
          const p = sub([x, y, z], at);
          distance = Math.max(
            distance,
            dot(p, dir) + Math.max(Math.abs(dot(p, right)) / (h * fillX), Math.abs(dot(p, up)) / (v * fillY))
          );
        }
  return {
    eye: [at[0] + dir[0] * distance, at[1] + dir[1] * distance, at[2] + dir[2] * distance],
    at,
    fov: HERO_FOV,
    shiftX,
    shiftY,
  };
}

/** The parts of each box above `height` (boxes wholly below it are dropped). */
export const above = (boxes: Box[], height: number): Box[] =>
  boxes
    .filter(([, hi]) => hi[1] > height)
    .map(([lo, hi]): Box => [[lo[0], Math.max(height, lo[1]), lo[2]], hi]);

/** Desk tours read the narrow framing below this aspect. */
export const isPortrait = (aspect: number) => aspect < 0.9;
/** The phone camera direction is used at or below this width (CSS px). */
export const PHONE_MAX_WIDTH = 768;

/** The opening view of the desk. `furniture` holds the boxes named in
 *  FURNITURE, in that order. Wide displays compose around the desk surface
 *  and upper chair (the chair base can run below the frame, like the
 *  foreground of a photograph); on tall screens the three monitors span the
 *  width under the name, and the desk and figure follow below. */
export function heroPose(furniture: Box[], aspect: number, phone: boolean): HeroPose {
  const portrait = isPortrait(aspect);
  return framedRoom(
    portrait ? furniture.slice(3, 6) : above(furniture, 0.27),
    aspect,
    [phone ? 0.055 : 0.3, phone ? 0.47 : 0.32, 1],
    portrait ? 0.95 : 0.7,
    portrait ? 4 : 0.98,
    portrait ? 0 : 0.29,
    portrait ? -0.14 : -0.03
  );
}

/** Project world points to CSS pixels of a `width` x `height` view, exactly
 *  as the desk's PerspectiveCamera does (lookAt with +Y up, the pose's fov,
 *  and its view offset). Returns [x, y, depth]; depth <= 0 is behind. */
export function projector(pose: HeroPose, width: number, height: number) {
  const z = unit(sub(pose.eye, pose.at));
  const x = unit(cross(UP, z));
  const y = cross(z, x);
  const t = Math.tan(((pose.fov / 2) * Math.PI) / 180);
  const aspect = width / height;
  const [ex, ey, ez] = pose.eye;
  return (px: number, py: number, pz: number): Vec3 => {
    const dx = px - ex,
      dy = py - ey,
      dz = pz - ez;
    const depth = -(dx * z[0] + dy * z[1] + dz * z[2]);
    const ndcX = (dx * x[0] + dy * x[1] + dz * x[2]) / (depth * t * aspect) + pose.shiftX;
    const ndcY = (dx * y[0] + dy * y[1] + dz * y[2]) / (depth * t) + pose.shiftY;
    return [((ndcX + 1) / 2) * width, ((1 - ndcY) / 2) * height, depth];
  };
}

/** A CSS matrix3d that maps a w x h box onto four corners given in NDC
 *  (top-left, top-right, bottom-right, bottom-left) of a width x height view:
 *  the links over each monitor and the preloader's screen glow. */
export function panelTransform(
  corners: { x: number; y: number }[],
  width: number,
  height: number,
  w: number,
  h: number
) {
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
