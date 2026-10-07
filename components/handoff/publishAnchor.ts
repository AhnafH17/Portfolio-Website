import * as THREE from 'three';
import { getAnchor } from '@/lib/handoff';

const p = new THREE.Vector3();
const c = new THREE.Vector3();
const s = new THREE.Vector3();

/**
 * Publish where a point of a 3D scene is on screen, for a section handoff
 * (lib/handoff.ts). Call from useFrame. `local` is in `obj`'s space and
 * `widthLocal` is the size of the thing there in the same units; both
 * follow the object's world transform, including animated scale.
 */
export function publishAnchor(
  id: string,
  obj: THREE.Object3D,
  local: [number, number, number],
  widthLocal: number,
  camera: THREE.Camera,
  canvas: HTMLElement,
  width: number,
  height: number,
) {
  const cam = camera as THREE.PerspectiveCamera;
  obj.updateWorldMatrix(true, false);
  p.set(local[0], local[1], local[2]);
  obj.localToWorld(p);
  obj.getWorldScale(s);
  const depth = -c.copy(p).applyMatrix4(cam.matrixWorldInverse).z;
  if (depth <= 0) return;
  p.project(cam);
  const a = getAnchor(id);
  a.canvas = canvas;
  a.x = ((p.x + 1) / 2) * width;
  a.y = ((1 - p.y) / 2) * height;
  a.size = (widthLocal * s.x * height) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * depth);
  a.at = performance.now();
}
