// Compress the Blender exports for the web: meshopt geometry + WebP textures.
// Sources (exactly as Blender writes them) live in assets/models-src/; the
// compressed copies the site loads go to public/models/. drei's useGLTF
// decodes meshopt itself.
//
// Everything that merges or renames is switched off, because the site's code
// relies on node and material names (LID, SCREEN, SHADOW, PLT_*, CUBE_Core,
// MAT_Accent...) and on node pivots. Run: node scripts/optimize-models.mjs
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const MODELS = ['laptop', 'phone', 'about-workspace'];
const KEEP_STRUCTURE = [
  '--join', 'false', '--flatten', 'false', '--instance', 'false',
  '--palette', 'false', '--simplify', 'false', '--weld', 'false',
];

for (const name of MODELS) {
  const src = `assets/models-src/${name}.glb`;
  const out = `public/models/${name}.glb`;
  execFileSync('npx', ['gltf-transform', 'optimize', src, out,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024',
    ...KEEP_STRUCTURE], { stdio: 'inherit', shell: true });
  const kb = (f) => Math.round(statSync(f).size / 1024);
  console.log(`${name}: ${kb(src)}KB -> ${kb(out)}KB`);
}
