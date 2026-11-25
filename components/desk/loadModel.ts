import { GLTFLoader, MeshoptDecoder, type GLTF } from 'three-stdlib';

let request: Promise<GLTF> | undefined;

/** The byte size of public/models/desk-hero.glb. Servers that compress the
 *  file or stream it in chunks send no usable length, and the preloader's
 *  drawing then had nothing to follow; this keeps its progress real.
 *  Update it whenever the model is re-exported (`wc -c public/models/desk-hero.glb`);
 *  in development a warning says when it has drifted. */
export const DESK_MODEL_BYTES = 496_936;

export function loadDeskModel(onProgress: (event: ProgressEvent) => void) {
  if (!request) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder);
    let received = 0;
    request = new Promise<GLTF>((resolve, reject) => {
      loader.load('/models/desk-hero.glb', resolve, (event) => {
        received = event.loaded;
        // No length from the server, or a compressed one (smaller than what
        // arrives): report against the known size.
        const sent = event.lengthComputable ? event.total : 0;
        onProgress(new ProgressEvent('progress', { lengthComputable: true, loaded: event.loaded, total: Math.max(sent, DESK_MODEL_BYTES) }));
      }, reject);
    }).then((gltf) => {
      if (process.env.NODE_ENV !== 'production' && received && Math.abs(received / DESK_MODEL_BYTES - 1) > 0.05)
        console.warn(`DESK_MODEL_BYTES is ${DESK_MODEL_BYTES} but desk-hero.glb is ${received} bytes: update it in loadModel.ts.`);
      return gltf;
    }).catch((error) => {
      request = undefined;
      throw error;
    });
  }
  return request;
}
