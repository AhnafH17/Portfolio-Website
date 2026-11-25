import * as THREE from 'three';

// Runtime finish for the desk scene, applied by DeskCanvas over what
// DeskModel prepares. The room is lit like a product shot: the screens are
// the key light, a soft top fill and a thin cool rim separate the figure, a
// crimson underglow touches only what sits near the desk edge, and the
// room falls to black away from the desk.

/** Fog and background, as a fraction of the page's --black (linear). */
export const ROOM_DARKEN = 0.32;

/** Hemisphere fill kept from DeskModel: a little, so shadows stay shaped. */
export const HEMI_SCALE = 0.55;

/** The baked AO doubles as indirect light. Less of it keeps contrast. */
const BOUNCE_SCALE: Record<string, number> = {
  MAT_Wall: 0.42,
  MAT_Floor: 0.36,
  MAT_Hand: 1.15,
  MAT_PadCloth: 0.55,
};
const BOUNCE_DEFAULT = 0.62;

export const LIGHTS = {
  // Softbox above the desk, aimed down at the figure and keyboard.
  fill: { color: '#dfe4ec', intensity: 2.2, angle: 0.72 },
  // Thin cool rim from behind the monitors onto the hood and shoulders.
  rim: { color: '#cfd8e6', intensity: 22, angle: 0.4 },
  // Underglow from the desk-edge strip: lap, chair arms, drawer fronts.
  under: { intensity: 2.6 },
};

/** Environment: near-black studio whose only bright shapes are the
 *  screens and a dim top softbox, so glossy surfaces reflect the displays
 *  and nothing reads as a grey wash. */
export function deskEnvironment() {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const room = new THREE.BoxGeometry(12, 12, 12);
  const roomMat = new THREE.MeshBasicMaterial({ color: '#020203', side: THREE.BackSide });
  scene.add(new THREE.Mesh(room, roomMat));
  disposables.push(room, roomMat);
  const panel = (w: number, h: number, pos: THREE.Vector3Tuple, strength: number, tint = '#eef2f8') => {
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(strength) });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    disposables.push(geometry, material);
  };
  // Monitor wall ahead of the desk (three -Z), the portrait screen to the left.
  panel(4.2, 1.1, [0.2, 1.1, -4.5], 3.2);
  panel(1.0, 1.9, [-3.2, 1.4, -3.4], 2.4);
  panel(1.6, 0.9, [3.4, 0.9, -3.6], 2.2);
  // Soft top light and a faint floor bounce.
  panel(3.5, 3.5, [0, 5.5, 0], 0.7, '#f3f1ee');
  panel(5, 5, [0, -5.5, 0], 0.03);
  return {
    scene,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

type Tunable = THREE.MeshStandardMaterial & { userData: { bounce?: number } };

/** Scale DeskModel's baked bounce per material and sharpen every texture.
 *  Returns an undo so remounts (and React's dev double-effects) start clean. */
export function tuneDeskMaterials(scene: THREE.Object3D, anisotropy: number) {
  const undo: (() => void)[] = [];
  const seen = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of materials as Tunable[]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      for (const key of ['map', 'aoMap', 'lightMap', 'normalMap', 'roughnessMap', 'alphaMap'] as const) {
        const tex = (mat as Partial<Record<typeof key, THREE.Texture | null>>)[key];
        if (tex && !(tex instanceof THREE.CanvasTexture) && !(tex instanceof THREE.DataTexture)) textures.add(tex);
      }
      const bounce = mat.userData.bounce;
      if (typeof bounce === 'number') {
        const base = mat.name.replace(/\.\d+$/, '');
        mat.userData.bounce = bounce * (BOUNCE_SCALE[base] ?? BOUNCE_DEFAULT);
        undo.push(() => {
          mat.userData.bounce = bounce;
        });
      }
    }
  });
  textures.forEach((tex) => {
    const before = tex.anisotropy;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    undo.push(() => {
      tex.anisotropy = before;
    });
  });
  return () => undo.forEach((fn) => fn());
}

/** Halo texture for the fake bloom on emissive strips: a soft vertical
 *  falloff, brightest on the centre line. */
export function stripHalo() {
  const h = 64;
  const pixels = new Uint8Array(h * 4);
  for (let y = 0; y < h; y++) {
    const d = Math.abs((2 * y) / (h - 1) - 1);
    const a = Math.exp(-d * d * 9) * 0.85 + Math.exp(-d * d * 120) * 0.15;
    pixels.set([255, 255, 255, Math.round(255 * a)], y * 4);
  }
  const texture = new THREE.DataTexture(pixels, 1, h);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Halo texture for the fan ring: a soft annulus. */
export function ringHalo(inner: number) {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((2 * x) / (size - 1) - 1, (2 * y) / (size - 1) - 1);
      const d = (r - inner) / (1 - inner);
      const a = r > 1 ? 0 : Math.exp(-d * d * 10) * (1 - r * r);
      pixels.set([255, 255, 255, Math.round(255 * a)], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
