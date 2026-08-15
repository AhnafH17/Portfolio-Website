import * as THREE from 'three';

/**
 * A thin slab with a large corner radius on its FACE and a small bevel on its
 * edges — i.e. a phone body.
 *
 * drei's <RoundedBox> rounds every edge by a single radius, so it only works
 * while that radius stays under half the smallest dimension. A phone is ~0.17
 * deep with ~0.26 corners; feeding those to RoundedBox makes the rounding wrap
 * past itself and the geometry self-intersects, which renders as a second,
 * offset body beside the real one.
 *
 * Extruding a rounded-rectangle profile keeps the two radii independent: the
 * face corners come from the shape, the edge softness from the bevel.
 */
export function roundedSlab(w: number, h: number, d: number, r: number, bevel = 0.008) {
  const rad = Math.min(r, w / 2, h / 2);
  const b = Math.min(bevel, d / 2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;

  shape.moveTo(x + rad, y);
  shape.lineTo(x + w - rad, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rad);
  shape.lineTo(x + w, y + h - rad);
  shape.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  shape.lineTo(x + rad, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rad);
  shape.lineTo(x, y + rad);
  shape.quadraticCurveTo(x, y, x + rad, y);

  const core = Math.max(0.001, d - b * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: b > 0,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 3,
    curveSegments: 22,
  });
  geo.translate(0, 0, -core / 2);
  geo.computeVertexNormals();
  return geo;
}
