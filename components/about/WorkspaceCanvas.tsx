'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { readAccent } from '@/lib/accent';
import { coreHandoff } from '@/lib/coreHandoff';

/* The About section's workspace scene (public/models/about-workspace.glb,
   built in Blender), framed like the reference design: a close perspective
   view of the island filling the right of the section and running off its
   edges, inside a dim field of towers on a glossy floor.
   The model's contract, which this file relies on:
   - every glowing part uses the single material `MAT_Accent_Emissive`, so it
     can be recoloured to the visitor's palette here;
   - each platform is a separate `PLT_*` node with its pivot at its bottom and
     its contents parented to it, so lifting the node lifts everything on it. */

const MODEL_URL = '/models/about-workspace.glb';
const LIFT = 0.24;          // how far a hovered platform rises
const LIFT_EASE = 7;        // higher = snappier lift/drop
// Platforms, plus the glowing core cube people naturally point at.
const isLiftable = (name: string) => name.startsWith('PLT_') || name === 'CUBE_Core';
const BASE_YAW = -0.18;     // resting angle, a touch toward the viewer's right
const SWAY = 0.1;           // ± radians of the slow idle sway (small: the framing is close)
// Gentle up/down drift every platform does on its own (hover lifts on top).
const DRIFT = 0.07;
const DRIFT_SPEED = 0.9;
// How far the core cube rises off its platform before the Impacts section
// takes it over (see lib/coreHandoff.ts).
const CORE_RISE = 0.5;
const CORE_EDGE = 0.44;     // the cube's edge length in the model

// Viewing direction (the reference's three-quarter view from above-right).
const CAM_DIR = new THREE.Vector3(6, 5.2, 7).normalize();
const FOV = 30;

/* Red reads far darker to the eye than amber, teal or magenta, so a glow
   tuned on crimson blows the brighter palettes out. Scale glow + accent
   lights by the colour's luminance so every palette lands at crimson's level. */
function glowScale(hex: string) {
  const c = new THREE.Color(hex); // linear
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return Math.min(1, Math.max(0.3, 0.135 / Math.max(lum, 1e-3)));
}

// Seeded so the background field is identical on every visit.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Frame { x: number; y: number; w: number; h: number }

/* Whether to draw. R3F's loop always runs (its `frameloop` prop is re-applied
   whenever the canvas re-renders, which it does on scroll, so switching the
   loop off from inside got undone and froze the scene); instead every frame
   is skipped while the section is off screen. `warm` forces one draw. */
const drawing = { onScreen: false, warm: 0 };

/* Resolves once the bloom pass's shaders are compiled (see Bloom). */
let bloomCompiled: Promise<unknown> = Promise.resolve();

// Hovering anything that sits on a platform lifts that whole platform.
function platformOf(obj: THREE.Object3D | null) {
  for (let o = obj; o; o = o.parent) if (isLiftable(o.name)) return o.name;
  return null;
}

function Workspace({ frame, pointerInside }: { frame: Frame | null; pointerInside: RefObject<boolean> }) {
  const { scene } = useGLTF(MODEL_URL);
  const rootRef = useRef<THREE.Group>(null);
  const hovered = useRef<string | null>(null);

  // three.js objects are mutated every frame, so they live in a ref (set up
  // once the model is in) rather than in render-time values.
  const modelRef = useRef<{
    platforms: Map<string, { node: THREE.Object3D; baseY: number; phase: number }>;
    core: THREE.Object3D | null;
    glow: number;
    accentMat: THREE.MeshStandardMaterial | null;
  } | null>(null);

  useEffect(() => {
    const accent = readAccent();
    let accentMat: THREE.MeshStandardMaterial | null = null;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.name === 'MAT_Accent_Emissive') {
        mat.emissive.set(accent.glow);
        mat.toneMapped = false; // bright enough to cross the bloom threshold
        accentMat = mat;
      } else if (mat.name === 'MAT_Body') {
        // Near-black and glossy: the shape comes from the rim light catching
        // edges and the accent lights spilling onto faces, not flat grey.
        mat.color.set('#17191e');
        mat.metalness = 0.35;
        mat.roughness = 0.42;
      } else if (mat.name === 'MAT_Body_Recess') {
        mat.color.set('#0b0c0f');
        mat.roughness = 0.5;
      } else if (mat.name === 'MAT_Glass') {
        mat.depthWrite = false;
      } else if (mat.name === 'MAT_Screen') {
        mat.toneMapped = false;
      }
    });
    const platforms = new Map<string, { node: THREE.Object3D; baseY: number; phase: number }>();
    scene.traverse((obj) => {
      if (isLiftable(obj.name)) platforms.set(obj.name, { node: obj, baseY: obj.position.y, phase: platforms.size * 1.3 });
    });
    modelRef.current = {
      platforms,
      core: scene.getObjectByName('CUBE_Core') ?? null,
      accentMat: accentMat as THREE.MeshStandardMaterial | null,
      glow: glowScale(accent.glow),
    };
  }, [scene]);

  /* Hover. Checked by ray each frame (every other frame) rather than with
     pointer over/out events: the model is many small meshes, and moving
     between two pieces of the SAME platform can deliver "left the old piece"
     after "entered the new one", which dropped the platform mid-hover.
     The ray simply asks which platform owns whatever is under the pointer. */
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const hoverTick = useRef(0);
  const setHover = (name: string | null) => {
    if (hovered.current === name) return;
    hovered.current = name;
    document.body.style.cursor = name ? 'pointer' : '';
  };

  useFrame((state, dt) => {
    if (!drawing.onScreen) return;
    const t = state.clock.elapsedTime;
    if (!pointerInside.current) setHover(null);
    else if ((hoverTick.current = (hoverTick.current + 1) % 2) === 0) {
      raycaster.setFromCamera(state.pointer, state.camera);
      const hit = raycaster.intersectObject(scene, true)[0];
      setHover(hit ? platformOf(hit.object) : null);
    }
    if (rootRef.current) {
      rootRef.current.rotation.y = BASE_YAW + Math.sin(t * 0.22) * SWAY;
      rootRef.current.position.y = Math.sin(t * 0.7) * 0.04;
    }
    const model = modelRef.current;
    if (!model) return;
    const k = 1 - Math.exp(-LIFT_EASE * Math.min(dt, 0.05));
    model.platforms.forEach(({ node, baseY, phase }, name) => {
      // Staggered phases, so they rise and fall like a slow wave, not in unison.
      const drift = (Math.sin(t * DRIFT_SPEED + phase) * 0.5 + 0.5) * DRIFT;
      const rise = name === 'CUBE_Core' ? coreHandoff.lift * CORE_RISE : 0;
      const target = baseY + drift + rise + (hovered.current === name ? LIFT : 0);
      node.position.y += (target - node.position.y) * k;
    });
    if (model.accentMat) model.accentMat.emissiveIntensity = (2.2 + Math.sin(t * 1.6) * 0.35) * model.glow;

    // Hand-off: while the Impacts section has the cube, hide it here and let
    // its platform go dark; otherwise publish where it is on screen, so the
    // DOM copy can appear exactly on top of it.
    const core = model.core;
    if (!core) return;
    core.visible = !coreHandoff.detached;
    if (coreLightRef.current) coreLightRef.current.intensity = coreHandoff.detached ? 0 : coreLightRef.current.userData.base;
    core.updateWorldMatrix(true, false);
    const c = core.localToWorld(tmp.a.set(0, CORE_EDGE / 2, 0));
    const top = core.localToWorld(tmp.b.set(0, CORE_EDGE, 0));
    const worldEdge = c.distanceTo(top) * 2;
    const cam = state.camera as THREE.PerspectiveCamera;
    const depth = -tmp.b.copy(c).applyMatrix4(cam.matrixWorldInverse).z;
    c.project(cam);
    const { width: W, height: H } = state.size;
    coreHandoff.canvas = state.gl.domElement;
    coreHandoff.x = ((c.x + 1) / 2) * W;
    coreHandoff.y = ((1 - c.y) / 2) * H;
    coreHandoff.edge = (worldEdge * H) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * depth);
    coreHandoff.yaw = (rootRef.current?.rotation.y ?? BASE_YAW) - BASE_YAW;
    coreHandoff.ready = true;
  });

  useEffect(() => () => {
    document.body.style.cursor = '';
    coreHandoff.ready = false;
    coreHandoff.canvas = null;
  }, []);

  /* Framing. On desktop the model fills a target rect covering the right ~70%
     of the section and running past its top, right and bottom edges, like the
     reference. On phones it fits inside the layout's placeholder below the
     copy. The model's bounding box is measured in its REST pose (no sway,
     platforms at base height) so every refit gives the same answer, projected
     across the whole sway range; the camera distance is set so it fills the
     rect, then a view offset moves its centre onto the rect's centre. */
  const get = useThree((s) => s.get);
  // Width/height only: R3F's size also carries the canvas's page position,
  // which changes on every scroll — refitting on that made the model zoom.
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useEffect(() => {
    const W = width, H = height;
    if (W < 10 || H < 10) return;
    const desktop = window.innerWidth > 1024;
    let R: Frame;
    if (desktop) R = { x: W * 0.3, y: -H * 0.08, w: W * 0.74, h: H * 1.16 };
    else if (frame && frame.w > 10 && frame.h > 10) R = frame;
    else return;

    const { camera, scene: world } = get();
    const cam = camera as THREE.PerspectiveCamera;

    const root = rootRef.current;
    const saved = { rotY: root?.rotation.y ?? 0, posY: root?.position.y ?? 0 };
    const savedY = new Map<THREE.Object3D, number>();
    if (root) { root.rotation.y = 0; root.position.y = 0; }
    modelRef.current?.platforms.forEach(({ node, baseY }) => { savedY.set(node, node.position.y); node.position.y = baseY; });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    if (root) { root.rotation.y = saved.rotY; root.position.y = saved.posY; }
    savedY.forEach((y, node) => { node.position.y = y; });
    scene.updateMatrixWorld(true);
    box.max.y += LIFT + DRIFT + 0.06;
    box.min.y -= 0.06;
    const center = box.getCenter(new THREE.Vector3());

    // Probe distance, then scale: projected size goes ~1/distance.
    const D0 = 12;
    cam.clearViewOffset();
    cam.fov = FOV;
    cam.aspect = W / H;
    cam.near = 0.1;
    cam.far = 80;
    cam.position.copy(center).addScaledVector(CAM_DIR, D0);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();

    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    let hx = 0, hy = 0;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 12; i++) {
      const yaw = BASE_YAW + SWAY * (i / 6 - 1);
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      for (const v of corners) {
        p.set(v.x * cos + v.z * sin, v.y, -v.x * sin + v.z * cos).project(cam);
        hx = Math.max(hx, Math.abs(p.x));
        hy = Math.max(hy, Math.abs(p.y));
      }
    }
    // Box corners overestimate the silhouette, so a little slack still fits.
    // Phones fit the width only: the island spans the (wider than the screen)
    // stage and its towers are free to rise up behind the cards above.
    const d = desktop
      ? Math.max((D0 * hx * W) / R.w, (D0 * hy * H) / R.h) / 1.08
      : (D0 * hx * W) / R.w / 1.08;
    cam.position.copy(center).addScaledVector(CAM_DIR, d);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    cam.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H);
    cam.updateProjectionMatrix();

    // Fog starts just behind the model and swallows the far field.
    if (world.fog instanceof THREE.Fog) { world.fog.near = d - 1; world.fog.far = d + 13; }
  }, [scene, get, width, height, frame]);

  // Accent lights sit where the model glows (model space, so they sway with
  // it): this is what spills the glow onto the surrounding surfaces.
  const { glow, k } = useMemo(() => { const g = readAccent().glow; return { glow: g, k: glowScale(g) * 0.75 }; }, []);
  return (
    <group ref={rootRef}>
      <primitive object={scene} />
      <pointLight position={[0, 1.05, -0.15]} intensity={7 * k} distance={3.2} decay={2} color={glow} />
      <pointLight ref={coreLightRef} position={[0.39, 1.25, 0.6]} intensity={5 * k} userData={{ base: 5 * k }} distance={2.4} decay={2} color={glow} />
      <pointLight position={[0, 2.4, -1.0]} intensity={6 * k} distance={3.4} decay={2} color={glow} />
      <pointLight position={[-0.95, 0.85, 1.35]} intensity={3.5 * k} distance={2.6} decay={2} color={glow} />
      <pointLight position={[0.95, 0.85, 1.35]} intensity={3.5 * k} distance={2.6} decay={2} color={glow} />
      <Beams glow={glow} />
    </group>
  );
}

/* Thin vertical light beams rising out of the island, like the reference. */
const BEAMS: [number, number, number][] = [[-0.55, 2.2, -1.25], [0.75, 2.4, -1.35], [1.45, 1.8, -0.55]];
function Beams({ glow }: { glow: string }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.35 * glowScale(glow), depthWrite: false, blending: THREE.AdditiveBlending });
    m.toneMapped = false;
    return m;
  }, [glow]);
  return (
    <>
      {BEAMS.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y + 1.6 + i * 0.3, z]} material={mat}>
          <boxGeometry args={[0.01, 3 + i * 0.6, 0.01]} />
        </mesh>
      ))}
    </>
  );
}

/* The world around the island: a glossy floor that picks up the glow, and a
   dim field of towers (some with glowing beacons) fading into fog — so the
   model sits in a place, not on an empty shelf. Static, so the island's sway
   reads against it. One instanced draw call for towers, one for beacons. */
function Surroundings({ glow }: { glow: string }) {
  const towersRef = useRef<THREE.InstancedMesh>(null);
  const beaconsRef = useRef<THREE.InstancedMesh>(null);
  const { towers, beacons } = useMemo(() => {
    const rand = seeded(0x51ab3);
    const towers: { x: number; z: number; w: number; d: number; h: number }[] = [];
    while (towers.length < 80) {
      const ang = rand() * Math.PI * 2;
      const r = 4.2 + Math.pow(rand(), 0.8) * 11;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      // Only behind and to the right of the island (as seen by the camera):
      // the left of the section, behind the copy, stays clear and dark.
      const screenRight = x * 0.759 - z * 0.651;   // world → camera right axis
      const towardCam = (x * 6 + z * 7) / 9.2;     // world → camera direction
      if (screenRight < -0.5 || towardCam > -0.5) continue;
      const w = 0.35 + rand() * 0.9, d = 0.35 + rand() * 0.9;
      const h = 0.4 + rand() * (0.8 + r * 0.32);
      towers.push({ x, z, w, d, h });
    }
    const beacons = towers.filter((_, i) => i % 3 === 0);
    return { towers, beacons };
  }, []);

  useEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    towers.forEach((t, i) => {
      m.compose(p.set(t.x, t.h / 2, t.z), q, s.set(t.w, t.h, t.d));
      towersRef.current?.setMatrixAt(i, m);
    });
    beacons.forEach((t, i) => {
      m.compose(p.set(t.x, t.h + 0.03, t.z), q, s.set(Math.min(t.w, 0.3), 0.06, Math.min(t.d, 0.3)));
      beaconsRef.current?.setMatrixAt(i, m);
    });
    if (towersRef.current) towersRef.current.instanceMatrix.needsUpdate = true;
    if (beaconsRef.current) beaconsRef.current.instanceMatrix.needsUpdate = true;
  }, [towers, beacons]);

  const beaconMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#000000', emissive: glow, emissiveIntensity: 2.4 * glowScale(glow) });
    m.toneMapped = false;
    return m;
  }, [glow]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060709" metalness={0.2} roughness={0.7} />
      </mesh>
      <instancedMesh ref={towersRef} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0e1013" metalness={0.3} roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={beaconsRef} args={[undefined, undefined, beacons.length]} material={beaconMat}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

/* Real bloom (three's own UnrealBloomPass — no extra dependency), so the
   glow bleeds past its edges. The accent materials skip tone mapping and are
   the only things bright enough to cross the threshold. */
function Bloom() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const composerRef = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const { gl, scene, camera } = get();
    gl.setClearColor(0x000000, 0);
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.9));
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    // Compile every shader the composer will use in parallel, off the main
    // thread: the scene's materials as drawn INTO the composer's render
    // target (three keys programs on where they draw, so compiling them for
    // the screen, as Prewarm does, isn't the variant that's used), plus the
    // passes' own materials. Left to the first draw, three linked them
    // synchronously: a ~650ms freeze at page load.
    const mats = new Set<THREE.Material>();
    for (const pass of composer.passes) {
      for (const v of Object.values(pass)) {
        if (v instanceof THREE.Material) mats.add(v);
        else if (Array.isArray(v)) v.forEach((m) => { if (m instanceof THREE.Material) mats.add(m); });
      }
    }
    const quad = new THREE.PlaneGeometry(2, 2);
    const warm = new THREE.Scene();
    mats.forEach((m) => warm.add(new THREE.Mesh(quad, m)));
    const cam = new THREE.OrthographicCamera();
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    const intoTarget = Promise.all([gl.compileAsync(scene, camera), gl.compileAsync(warm, cam)]);
    gl.setRenderTarget(prev);
    bloomCompiled = Promise.all([intoTarget, gl.compileAsync(warm, cam)]).catch(() => {});

    return () => { composer.dispose(); composerRef.current = null; };
  }, [get]);
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(get().gl.getPixelRatio());
    composer.setSize(width, height);
  }, [get, width, height]);
  // Priority 1 takes over rendering from R3F's default render.
  useFrame(() => {
    if (!drawing.onScreen && drawing.warm <= 0) return;
    drawing.warm = Math.max(0, drawing.warm - 1);
    composerRef.current?.render();
  }, 1);
  return null;
}

/* The canvas stays transparent so the section's own background shows through
   untouched; fog in the page colour fades the far field into it. Distances are
   set by the framing (Workspace). */
function Atmosphere() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { scene } = get();
    const bg = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--black').trim() || '#151B24');
    scene.fog = new THREE.Fog(bg, 11, 24);
  }, [get]);
  return null;
}

/* Compile shaders in parallel and draw the first frame in idle time, so the
   first visible frame isn't a compile hitch as the section scrolls in. */
function Prewarm() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    Promise.all([gl.compileAsync(scene, camera), bloomCompiled]).then(() => {
      if (cancelled) return;
      const run = () => { if (!cancelled) drawing.warm = 1; };
      idleId = typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(run, { timeout: 2000 })
        : window.setTimeout(run, 200);
    });
    return () => {
      cancelled = true;
      if (idleId === undefined) return;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [gl, scene, camera]);
  return null;
}

/* Draws only while the section is (nearly) on screen — see `drawing`. A
   ref-free flag, so scrolling past never re-renders the React tree. */
function OnlyWhileVisible({ target }: { target: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { drawing.onScreen = entry.isIntersecting; }, { rootMargin: '150px 0px' });
    io.observe(el);
    return () => { io.disconnect(); drawing.onScreen = false; };
  }, [target]);
  return null;
}

/* Tracks where the layout's placeholder sits on the canvas (the model is
   fitted into it on phones). Inside the canvas for the same reason. */
function FramedWorkspace({ wrapRef, stageRef, pointerInside }: {
  wrapRef: RefObject<HTMLElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  pointerInside: RefObject<boolean>;
}) {
  const [frame, setFrame] = useState<Frame | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current, stage = stageRef.current;
    if (!wrap || !stage) return;
    const measure = () => {
      const a = wrap.getBoundingClientRect(), b = stage.getBoundingClientRect();
      const next = { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
      setFrame((f) => (f && f.x === next.x && f.y === next.y && f.w === next.w && f.h === next.h ? f : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [wrapRef, stageRef]);
  return <Workspace frame={frame} pointerInside={pointerInside} />;
}

export default function WorkspaceCanvas({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Whether the pointer is over the canvas itself (not the copy on top of it).
  const pointerInside = useRef(false);
  const glow = useMemo(() => readAccent().glow, []);

  return (
    <div
      ref={wrapRef}
      className="ab3-canvas"
      onPointerEnter={() => { pointerInside.current = true; }}
      onPointerLeave={() => { pointerInside.current = false; }}
    >
      <Canvas
        dpr={[1, 1.25]}
        camera={{ fov: FOV, position: [6, 5.2, 7], near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <OnlyWhileVisible target={wrapRef} />
        <ambientLight intensity={0.4} />
        <hemisphereLight args={['#9aa6b8', '#050608', 0.6]} />
        {/* soft key from the viewer's side, and a cool rim from behind that
            catches the top edges of every slab */}
        <directionalLight position={[7, 4, 6]} intensity={0.55} />
        <directionalLight position={[-8, 2.2, -5]} intensity={0.9} color="#d5deea" />
        <Atmosphere />
        <Surroundings glow={glow} />
        <FramedWorkspace wrapRef={wrapRef} stageRef={stageRef} pointerInside={pointerInside} />
        <Bloom />
        <Prewarm />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
