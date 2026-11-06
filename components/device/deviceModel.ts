import * as THREE from 'three';

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
