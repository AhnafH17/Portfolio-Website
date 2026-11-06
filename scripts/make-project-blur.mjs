import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'node:fs';
const dir = 'public/images/projects';
const out = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.webp')).sort()) {
  const buf = await sharp(`${dir}/${f}`).resize(24).webp({ quality: 45 }).toBuffer();
  out[f.replace('.webp', '')] = `data:image/webp;base64,${buf.toString('base64')}`;
}
const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: '${v}',`).join('\n');
writeFileSync('lib/projectBlur.ts', `/* Tiny blurred previews of the project thumbnails (24px WebP), shown by
   next/image while the real image loads so a card is never an empty box.
   Generated from public/images/projects/*.webp — regenerate if they change:
   node scripts/make-project-blur.mjs */
export const PROJECT_BLUR: Record<string, string> = {
${body}
};
`);
console.log(Object.keys(out).length, 'previews,', body.length, 'chars');
