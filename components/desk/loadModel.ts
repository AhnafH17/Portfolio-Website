import { GLTFLoader, MeshoptDecoder, type GLTF } from 'three-stdlib';

let request: Promise<GLTF> | undefined;

export function loadDeskModel(onProgress: (event: ProgressEvent) => void) {
  if (!request) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder);
    request = new Promise<GLTF>((resolve, reject) => {
      loader.load('/models/desk-hero.glb', resolve, onProgress, reject);
    }).catch((error) => {
      request = undefined;
      throw error;
    });
  }
  return request;
}
