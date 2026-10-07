import * as THREE from 'three';
import { deviceScreen } from '@/lib/deviceScreen';

/* Shared set-up for the Blender-built device models (public/models/laptop.glb
   and phone.glb, made by scripts/build-laptop.py / build-phone.py). Their
   contract: one `SCREEN` mesh (a plain placeholder the live screen replaces),
   `MAT_Accent` for anything that should take the visitor's palette colour,
   and every other material already final, with baked AO in the occlusion
   slot. */

/** The emissive look every screen surface shares; only intensity varies. */
export const SCREEN_PANEL = {
  emissive: new THREE.Color('#ffffff'),
  toneMapped: false,
  roughness: 0.25,
  metalness: 0,
} as const;

/** The live screen's base layer: the chrome canvas, on the model's own mesh. */
export function makeScreenMaterial(texture: THREE.Texture) {
  // Canvas textures default to three's flipY; the model's UVs follow glTF's
  // (origin top-left), so this one texture is uploaded unflipped.
  texture.flipY = false;
  texture.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    ...SCREEN_PANEL,
    map: texture,
    emissiveMap: texture,
    emissiveIntensity: 0.15,
  });
}

/**
 * Swap in the live screen material, recolour the accent, and tame the
 * reflections: the scene's studio environment is tuned for these values, and
 * glTF materials otherwise default to full-strength reflections.
 */
export function prepareModel(
  scene: THREE.Object3D,
  { screen, accent, envIntensity }: { screen: THREE.Material; accent: THREE.Color; envIntensity: Record<string, number> },
) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name === 'SCREEN' || mesh.parent?.name === 'SCREEN') { mesh.material = screen; return; }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats as THREE.MeshStandardMaterial[]) {
      if (!m) continue;
      if (m.name === 'MAT_Accent') {
        m.color.set('#000000');
        m.emissive.copy(accent);
        m.emissiveIntensity = 1.6;
        m.toneMapped = false;
      } else if (m.name in envIntensity) {
        m.envMapIntensity = envIntensity[m.name];
      }
    }
  });
}

/** The laptop's Return key centre, in model space, and the key pitch
    (scripts/build-laptop.py: KB_ROWS row 3's last key, U = 0.165; Blender's
    (x, y, z) is three's (x, z, -y)). */
export const RETURN_KEY = new THREE.Vector3(1.052, 0.0435, -0.3025);
const KEY_PITCH = 0.165;

/**
 * Follows the model's SCREEN on the page: returns a per-frame function that
 * projects the screen's four corners and publishes them (lib/deviceScreen.ts).
 * After compression SCREEN may be a node holding an unnamed mesh, so the
 * mesh is found either way.
 */
export function screenTracker(scene: THREE.Object3D, keyPoint?: THREE.Vector3) {
  const node = scene.getObjectByName('SCREEN');
  let mesh: THREE.Mesh | null = null;
  node?.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  const m = mesh as THREE.Mesh | null;
  if (!m) return null;
  m.geometry.computeBoundingBox();
  const { min, max } = m.geometry.boundingBox!;
  const size = new THREE.Vector3().subVectors(max, min);
  // The plane's flat axis is its thinnest; the corners span the other two.
  const flat = size.x < size.y && size.x < size.z ? 'x' : size.y < size.z ? 'y' : 'z';
  const [a, b] = (['x', 'y', 'z'] as const).filter((k) => k !== flat);
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([i, j]) => {
    const v = new THREE.Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    v[a] = i ? max[a] : min[a];
    v[b] = j ? max[b] : min[b];
    return v;
  });
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const pts: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]];
  return (camera: THREE.Camera, width: number, height: number, canvas: HTMLCanvasElement) => {
    m.updateWorldMatrix(true, false);
    corners.forEach((c, i) => {
      v.copy(c).applyMatrix4(m.matrixWorld).project(camera);
      pts[i][0] = ((v.x + 1) / 2) * width;
      pts[i][1] = ((1 - v.y) / 2) * height;
    });
    // Top pair, then bottom pair, each left to right.
    pts.sort((p, q) => p[1] - q[1]);
    const top = pts[0][0] < pts[1][0] ? [pts[0], pts[1]] : [pts[1], pts[0]];
    const bot = pts[2][0] < pts[3][0] ? [pts[2], pts[3]] : [pts[3], pts[2]];
    const q = deviceScreen.quad;
    q[0] = top[0][0]; q[1] = top[0][1]; q[2] = top[1][0]; q[3] = top[1][1];
    q[4] = bot[1][0]; q[5] = bot[1][1]; q[6] = bot[0][0]; q[7] = bot[0][1];
    if (keyPoint) {
      // One key pitch across, to size the popped key from.
      scene.updateWorldMatrix(true, false);
      v.copy(keyPoint).applyMatrix4(scene.matrixWorld).project(camera);
      v2.copy(keyPoint).setX(keyPoint.x + KEY_PITCH).applyMatrix4(scene.matrixWorld).project(camera);
      deviceScreen.key[0] = ((v.x + 1) / 2) * width;
      deviceScreen.key[1] = ((1 - v.y) / 2) * height;
      deviceScreen.key[2] = Math.abs(v2.x - v.x) / 2 * width;
    }
    deviceScreen.canvas = canvas;
    deviceScreen.at = performance.now();
  };
}
