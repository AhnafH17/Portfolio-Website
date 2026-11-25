// The preloader's line drawing of the desk, taken from the real model so it
// lines up with the 3D hero. Reads public/models/desk-hero.glb (run after
// scripts/optimize-models.mjs) and writes public/models/desk-outline.json:
//
// - `boxes`: the furniture bounds the hero camera is framed on, so the page
//   can compute the exact opening camera (heroPose in
//   components/desk/heroPose.ts) before the model has arrived;
// - `displays`, `led`, `sweep`, `fan`: the screen corners, the desk-edge LED
//   strip, the LED sweep's x range and the fan's plane with its blades;
// - `views.desk` / `views.phone`: for the two hero camera directions (wide
//   screens, and phones), the lines themselves in world space: hard edges of
//   the furniture, plus contour lines of the smooth parts (chair, figure)
//   as seen from that camera, with hidden lines removed. Grouped by part in
//   drawing order; each line is a polyline in 0.5 mm steps, delta-encoded.
//   With them, the visible stretches of the LED strip and a mask of the
//   visible part of each screen (the figure and tower hide some of them).
//
// Run: node scripts/make-desk-outline.mjs [--debug <dir>]
import { writeFileSync, mkdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { FURNITURE, heroPose, projector } from '../components/desk/heroPose.ts';

const SRC = 'public/models/desk-hero.glb';
const OUT = 'public/models/desk-outline.json';
const debugAt = process.argv.indexOf('--debug');
const DEBUG = debugAt > 0 ? process.argv[debugAt + 1] : null;
const Q = 2000; // stored units per metre (0.5 mm)

/* Parts, in drawing order. Each mesh is drawn as `edges` (creases sharper
   than `angle` degrees, and open borders) and/or `contour` (where the
   surface turns away from the camera). Meshes not listed only hide lines. */
const PARTS = [
  { id: 'desk', meshes: { Slab: { edges: 30 }, Leg: { edges: 30 }, Bearing: { edges: 40 }, Clamp: { edges: 40 }, 'Recess pull': { edges: 40 } } },
  { id: 'monL', meshes: { Bezel: { edges: 30 }, Shell: { edges: 30 }, SCREEN_Left: { edges: 30 } } },
  { id: 'monC', meshes: { 'Bezel.001': { edges: 30 }, 'Shell.001': { edges: 30 }, Foot: { edges: 30 }, SCREEN_Centre: { edges: 30 } } },
  { id: 'monR', meshes: { 'Bezel.002': { edges: 30 }, 'Shell.002': { edges: 30 }, 'Foot.001': { edges: 30 }, SCREEN_Right: { edges: 30 } } },
  { id: 'bar', meshes: { Diffuser: { edges: 30 }, Saddle: { edges: 30 }, Tube: { edges: 30 } } },
  { id: 'tower', meshes: { 'PSU shroud': { edges: 30 }, 'Cooling fins': { edges: 30 }, Mainboard: { edges: 30 }, 'Side window': { edges: 30 } } },
  { id: 'fan', meshes: { 'Fan halo': { edges: 50, contour: true } } },
  { id: 'kit', meshes: { 'Keyboard case': { edges: 30 }, 'Cloth pad': { edges: 30 }, 'Mouse body': { contour: true, edges: 70 }, Cover: { edges: 30 }, 'Page block': { edges: 40 }, Cable: { contour: true } } },
  { id: 'chair', meshes: { Spoke: { edges: 35, contour: true }, Caster: { contour: true }, 'Gas lift': { contour: true, edges: 60 }, 'Tensioned mesh': { contour: true, edges: 55 } } },
  { id: 'figure', meshes: { Sweatshirt: { contour: true, edges: 75 }, 'Hood seam': { contour: true }, Thigh: { contour: true }, 'Hand skin': { contour: true } } },
];
/* The two hero framings the lines are traced for (contours and hidden
   lines depend on where the camera is). */
const VIEWS = {
  desk: { width: 1920, height: 1200, phone: false },
  phone: { width: 1080, height: 2337, phone: true },
};

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(SRC);
const scene = doc.getRoot().listScenes()[0];

const mul = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
/** Every mesh node: name, ancestors' names, world-space vertices/triangles. */
const meshes = [];
const visit = (node, path) => {
  const name = node.getName();
  const mesh = node.getMesh();
  if (mesh) {
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const uv = prim.getAttribute('TEXCOORD_0');
      const idx = prim.getIndices();
      const local = [], verts = [], uvs = [];
      for (let i = 0; i < pos.getCount(); i++) {
        const p = pos.getElement(i, []);
        local.push(p);
        verts.push(mul(world, p));
        if (uv) uvs.push(uv.getElement(i, []));
      }
      const tris = [];
      const count = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i < count; i += 3)
        tris.push(idx ? [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)] : [i, i + 1, i + 2]);
      meshes.push({ name, path: [...path, name], node, local, verts, uvs, tris, material: prim.getMaterial()?.getName() ?? '' });
    }
  }
  node.listChildren().forEach((c) => visit(c, [...path, name]));
};
scene.listChildren().forEach((n) => visit(n, []));

const boxOf = (list) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of list) for (const v of m.verts) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], v[k]);
    hi[k] = Math.max(hi[k], v[k]);
  }
  return [lo, hi];
};
const under = (name) => meshes.filter((m) => m.path.includes(name));
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const boxes = Object.fromEntries(FURNITURE.map((n) => [n, boxOf(under(n)).flat().map(r5)]));
const furniture = FURNITURE.map((n) => [boxes[n].slice(0, 3), boxes[n].slice(3)]);

// Screen corners, read through the UVs like measureDisplays in beats.ts.
const displays = ['Left', 'Centre', 'Right'].map((side) => {
  const m = meshes.find((x) => x.name === 'SCREEN_' + side);
  const corner = (u, v) => {
    let best = Infinity, at = 0;
    m.uvs.forEach(([a, b], i) => {
      const d = Math.abs(a - u) + Math.abs(b - v);
      if (d < best) { best = d; at = i; }
    });
    return m.verts[at].map(r5);
  };
  return [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
});

// The LED strip: the front face's centre line of GLOW_DeskEdge.
const [edgeLo, edgeHi] = boxOf(meshes.filter((m) => m.name === 'GLOW_DeskEdge'));
const ledY = (edgeLo[1] + edgeHi[1]) / 2;
const led = [[edgeLo[0], ledY, edgeHi[2]].map(r5), [edgeHi[0], ledY, edgeHi[2]].map(r5)];
const [accentLo, accentHi] = boxOf(meshes.filter((m) => m.material === 'MAT_Accent_Emissive'));
const sweep = [r5(accentLo[0] - 0.1), r5(accentHi[0] + 0.1)];

// The fan: centre and in-plane axes of FAN_Blades (it spins about local z),
// and its blades as flat lines in that plane.
const bladesNode = meshes.find((m) => m.name === 'Impeller').node.getParentNode();
const fw = bladesNode.getWorldMatrix();
const fanCentre = mul(fw, [0, 0, 0]);
const axis = (k) => [fw[k * 4], fw[k * 4 + 1], fw[k * 4 + 2]];
const [fanLo, fanHi] = boxOf(meshes.filter((m) => m.name === 'Fan halo'));

/* ---------- edges and contours ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** Welded topology of one mesh: unique points, faces, and per edge its faces. */
function topology(m, verts = m.verts) {
  const key = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
  const ids = new Map(), points = [];
  const remap = verts.map((p) => {
    const k = key(p);
    if (!ids.has(k)) { ids.set(k, points.length); points.push(p); }
    return ids.get(k);
  });
  const faces = [], edges = new Map();
  for (const t of m.tris) {
    const [a, b, c] = t.map((i) => remap[i]);
    if (a === b || b === c || a === c) continue;
    const n = cross(sub(points[b], points[a]), sub(points[c], points[a]));
    const l = len(n);
    if (l < 1e-12) continue;
    const f = faces.push({ n: n.map((v) => v / l), p: points[a] }) - 1;
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = u < v ? u + ':' + v : v + ':' + u;
      if (!edges.has(k)) edges.set(k, { u: Math.min(u, v), v: Math.max(u, v), faces: [] });
      edges.get(k).faces.push(f);
    }
  }
  return { points, faces, edges: [...edges.values()] };
}

function lines(m, opts, eye) {
  const { points, faces, edges } = topology(m);
  const cos = opts.edges ? Math.cos((opts.edges * Math.PI) / 180) : 2;
  const out = [];
  for (const e of edges) {
    const fs = e.faces.map((f) => faces[f]);
    let keep = false;
    if (fs.length !== 2) keep = Boolean(opts.edges) || (opts.contour && fs.some((f) => dot(f.n, sub(eye, f.p)) > 0));
    else {
      if (opts.edges && dot(fs[0].n, fs[1].n) < cos) keep = true;
      if (opts.contour) {
        const a = dot(fs[0].n, sub(eye, points[e.u])) > 0;
        const b = dot(fs[1].n, sub(eye, points[e.u])) > 0;
        if (a !== b) keep = true;
      }
    }
    if (keep) out.push([points[e.u], points[e.v]]);
  }
  return out;
}

/* ---------- hidden lines: a depth buffer of the whole scene ---------- */
function depthBuffer(project, W, H) {
  const z = new Float32Array(W * H).fill(Infinity);
  for (const m of meshes) {
    const pv = m.verts.map((p) => project(...p));
    for (const [a, b, c] of m.tris) {
      const A = pv[a], B = pv[b], C = pv[c];
      if (A[2] <= 0.01 || B[2] <= 0.01 || C[2] <= 0.01) continue;
      const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
          const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          // Perspective-correct depth: 1/depth is linear on screen.
          const d = 1 / (w0 / A[2] + w1 / B[2] + w2 / C[2]);
          const i = y * W + x;
          if (d < z[i]) z[i] = d;
        }
    }
  }
  return z;
}

/** The visible pieces of a 3D segment. */
function visible([p, q], project, z, W, H) {
  const P = project(...p), R = project(...q);
  const n = Math.max(2, Math.ceil(Math.hypot(R[0] - P[0], R[1] - P[1]) / 0.7));
  const seen = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const [x, y, d] = project(...w);
    let far = -Infinity;
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const X = cx + ox, Y = cy + oy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) { far = Infinity; continue; }
        far = Math.max(far, z[Y * W + X]);
      }
    seen.push(d - far <= 0.003 + d * 0.002);
  }
  // Close pinholes (under ~7 px) where a thin edge grazes its own surface.
  for (let i = 1; i < seen.length; i++) {
    if (seen[i] || !seen[i - 1]) continue;
    let j = i;
    while (j < seen.length && !seen[j]) j++;
    if (j < seen.length && j - i <= 10) seen.fill(true, i, j);
    i = j;
  }
  const runs = [];
  let from = -1;
  for (let i = 0; i <= n; i++) {
    if (seen[i] && from < 0) from = i / n;
    if ((!seen[i] || i === n) && from >= 0) {
      const to = seen[i] ? i / n : (i - 1) / n;
      if (to > from) runs.push([from, to]);
      from = -1;
    }
  }
  return runs.map(([a, b]) => [
    [p[0] + (q[0] - p[0]) * a, p[1] + (q[1] - p[1]) * a, p[2] + (q[2] - p[2]) * a],
    [p[0] + (q[0] - p[0]) * b, p[1] + (q[1] - p[1]) * b, p[2] + (q[2] - p[2]) * b],
  ]);
}

/** Join segments that share ends into polylines, then drop points that sit
 *  on a straight run. */
function chain(segments) {
  const k = (p) => p.map((v) => Math.round(v * 4000)).join(',');
  const at = new Map();
  segments.forEach((s, i) => {
    for (const end of [0, 1]) {
      const key = k(s[end]);
      if (!at.has(key)) at.set(key, []);
      at.get(key).push([i, end]);
    }
  });
  const used = new Uint8Array(segments.length);
  const walk = (line, key) => {
    for (;;) {
      const next = (at.get(key) || []).find(([i]) => !used[i]);
      if (!next) return;
      const [i, end] = next;
      used[i] = 1;
      const p = segments[i][1 - end];
      line.push(p);
      key = k(p);
    }
  };
  const order = segments.map((_, i) => i).sort((a, b) => {
    const deg = (i) => Math.min(...[0, 1].map((e) => at.get(k(segments[i][e])).length));
    return (deg(a) === 2) - (deg(b) === 2);
  });
  const out = [];
  for (const i of order) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segments[i][0], segments[i][1]];
    walk(line, k(line[line.length - 1]));
    line.reverse();
    walk(line, k(line[line.length - 1]));
    out.push(simplify(line, 0.0006));
  }
  return out;
}
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  const ab = sub(b, a);
  const l = len(ab);
  let far = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const ap = sub(points[i], a);
    const d = l < 1e-9 ? len(ap) : len(cross(ab, ap)) / l;
    if (d > far) { far = d; at = i; }
  }
  if (far <= tolerance) return [a, b];
  return [...simplify(points.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(points.slice(at), tolerance)];
}

/** Order polylines so the pen travels short hops: start at the left, then
 *  always the nearest unused end. */
function penOrder(polylines, project) {
  const left = polylines.map((l) => l.map((p) => project(...p)));
  const rest = new Set(polylines.map((_, i) => i));
  const out = [];
  let pen = null;
  while (rest.size) {
    let best = -1, flip = false, bestD = Infinity;
    for (const i of rest) {
      const s = left[i][0], e = left[i][left[i].length - 1];
      const ds = pen ? Math.hypot(s[0] - pen[0], s[1] - pen[1]) : s[0];
      const de = pen ? Math.hypot(e[0] - pen[0], e[1] - pen[1]) : e[0];
      if (ds < bestD) { bestD = ds; best = i; flip = false; }
      if (de < bestD) { bestD = de; best = i; flip = true; }
    }
    rest.delete(best);
    const line = flip ? [...polylines[best]].reverse() : polylines[best];
    out.push(line);
    const end = project(...line[line.length - 1]);
    pen = end;
  }
  return out;
}

const plen = (line, project) => {
  let s = 0;
  for (let i = 1; i < line.length; i++) {
    const a = project(...line[i - 1]), b = project(...line[i]);
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
};
const encode = (line) => {
  const q = line.map((p) => p.map((v) => Math.round(v * Q)));
  const flat = [...q[0]];
  for (let i = 1; i < q.length; i++) {
    const d = [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]];
    if (d[0] || d[1] || d[2]) flat.push(...d);
  }
  return flat;
};

const views = {};
const debug = [];
for (const [viewName, view] of Object.entries(VIEWS)) {
  const pose = heroPose(furniture, view.width / view.height, view.phone);
  const project = projector(pose, view.width, view.height);
  const z = depthBuffer(project, view.width, view.height);
  const groups = [];
  for (const part of PARTS) {
    let segments = [];
    for (const m of meshes) {
      const opts = part.meshes[m.name];
      if (!opts) continue;
      for (const s of lines(m, opts, pose.eye)) segments.push(...visible(s, project, z, view.width, view.height));
    }
    const polylines = chain(segments).filter((l) => plen(l, project) >= 3);
    const ordered = penOrder(polylines, project);
    groups.push({ id: part.id, lines: ordered.map(encode) });
    debug.push({ view: viewName, id: part.id, lines: ordered.map((l) => l.map((p) => project(...p))) });
    console.log(viewName, part.id, 'lines', ordered.length, 'points', ordered.reduce((s, l) => s + l.length, 0));
  }
  // Where the LED strip shows (the figure and chair hide part of it), as
  // [from, to] fractions along it.
  const ledRuns = visible(led, project, z, view.width, view.height).map(([a, b]) =>
    [a, b].map((p) => Math.round(((p[0] - led[0][0]) / (led[1][0] - led[0][0])) * 1e4) / 1e4));
  // Which parts of each screen show, as a grid of cells (1 = seen), rows
  // top to bottom: the glow drawn on a screen is masked to it.
  const screens = displays.map(([tl, tr, , bl]) => {
    const w = len(sub(tr, tl)), h = len(sub(bl, tl));
    const cols = 40, rows = Math.max(8, Math.round((cols * h) / w));
    let bits = '';
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
        const p = [0, 1, 2].map((k) => tl[k] + (tr[k] - tl[k]) * u + (bl[k] - tl[k]) * v);
        const [x, y, d] = project(...p);
        const X = Math.floor(x), Y = Math.floor(y);
        const inside = X >= 0 && Y >= 0 && X < view.width && Y < view.height;
        bits += !inside || d - z[Y * view.width + X] <= 0.003 + d * 0.002 ? '1' : '0';
      }
    return { cols, rows, bits };
  });
  views[viewName] = { parts: groups, led: ledRuns, screens };
}

// Blades: the impeller's creases, flattened into the fan's plane (local x/y).
const bladeLines = [];
for (const name of ['Impeller', 'Hub']) {
  const m = meshes.find((x) => x.name === name);
  const relative = m.node === bladesNode ? null : m.node.getMatrix();
  const verts = m.local.map((p) => (relative ? mul(relative, p) : p));
  const { points, faces, edges } = topology(m, verts);
  const segs = [];
  for (const e of edges) {
    const fs = e.faces.map((f) => faces[f]);
    // Front-facing creases only (seen from +z, where the fan faces the room).
    const front = fs.some((f) => f.n[2] > 0.2);
    if (!front) continue;
    if (fs.length !== 2 || dot(fs[0].n, fs[1].n) < Math.cos((40 * Math.PI) / 180)) segs.push([points[e.u], points[e.v]]);
  }
  for (const l of chain(segs)) bladeLines.push(l.flatMap(([x, y]) => [Math.round(x * 1e4), Math.round(y * 1e4)]));
}

const data = {
  v: 1,
  q: Q,
  boxes,
  displays,
  led,
  sweep,
  fan: {
    centre: fanCentre.map(r5),
    x: axis(0).map(r5),
    y: axis(1).map(r5),
    radius: r5((fanHi[1] - fanLo[1]) / 2),
    // Blade lines in the fan plane, 0.1 mm units.
    blades: bladeLines.filter((l) => l.length >= 4),
  },
  views,
};
const json = JSON.stringify(data);
writeFileSync(OUT, json);
const { gzipSync } = await import('node:zlib');
console.log(`${OUT}: ${(json.length / 1024).toFixed(1)} KB, ${(gzipSync(json).length / 1024).toFixed(1)} KB gzipped`);

if (DEBUG) {
  mkdirSync(DEBUG, { recursive: true });
  for (const [viewName, view] of Object.entries(VIEWS)) {
    const paths = debug.filter((d) => d.view === viewName).map((d, i) =>
      `<path stroke="hsl(${i * 36},80%,60%)" d="${d.lines.map((l) => 'M' + l.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L')).join('')}"/>`);
    writeFileSync(`${DEBUG}/outline-${viewName}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.width} ${view.height}" width="${view.width}" height="${view.height}"><rect width="100%" height="100%" fill="#000"/><g fill="none" stroke-width="1.2">${paths.join('')}</g></svg>`);
  }
}
