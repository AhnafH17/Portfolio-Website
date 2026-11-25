'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { useAccent } from '@/lib/palette';
import { coreHandoff } from '@/lib/coreHandoff';
import { ABOUT_STOPS, type AboutStop } from './stops';

/* The About section's workspace scene (public/models/about-workspace.glb,
   built in Blender), which tells the whole section by itself: pinned and
   centred, the camera tours the island as you scroll (ABOUT_STOPS), framing
   each stop's subject beside its words (HTML over the canvas, AboutSection),
   which come up while it holds there. Around it, a dim field of towers on a
   glossy floor.
   The model's contract, which this file relies on:
   - every glowing part uses the single material `MAT_Accent_Emissive`, so it
     can be recoloured to the visitor's palette here;
   - each platform is a separate `PLT_*` node with its pivot at its bottom and
     its contents parented to it, so lifting the node lifts everything on it
     (the slow drift, and the core's rise into Impacts). */

const MODEL_URL = '/models/about-workspace.glb';
const LIFT_EASE = 7;        // higher = snappier rise/drop
// The platforms and the core cube: each drifts on its own.
const isLiftable = (name: string) => name.startsWith('PLT_') || name === 'CUBE_Core';
const BASE_YAW = -0.18;     // the island's angle
// Gentle up/down drift every platform does on its own.
const DRIFT = 0.07;
const DRIFT_SPEED = 0.9;
// How far the core cube rises off its platform before the Impacts section
// takes it over (see lib/coreHandoff.ts).
const CORE_RISE = 0.5;
const CORE_EDGE = 0.44;     // the cube's edge length in the model

const FOV = 30;
// Share of each stop's scroll spent holding still (the rest is moving on).
const HOLD = 0.55;
// The tour ends here; the rest of the scroll holds on the core, and its words
// clear before the cube flies up into Impacts.
const TOUR_END = 0.93;
// Of each move, the share the words take to go (at its start) and to come
// (at its end); none show mid-move. WORD_LAG spreads the words of one stop.
const WORDS_OUT = 0.42;
const WORD_LAG = 0.6;
const WORD_RISE = 26;       // px a word travels as it comes and goes
// Room kept clear on each edge of the screen and beside the words, in px.
// A subject fills 1 / stop.frame of what's left.
const EDGE = { top: 92, bottom: 40, side: 40, gap: 32 };

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

// How much the island's edges glow: enough to read the shapes, under bloom.
const EDGE_GLOW = 0.28;

/* Whether to draw. R3F's loop always runs (its `frameloop` prop is re-applied
   whenever the canvas re-renders, which it does on scroll, so switching the
   loop off from inside got undone and froze the scene); instead every frame
   is skipped while the section is off screen. `warm` forces one draw. */
const drawing = { onScreen: false, warm: 0 };

/* Resolves once the bloom pass's shaders are compiled (see Bloom). */
let bloomCompiled: Promise<unknown> = Promise.resolve();

/** One camera stop, resolved for this screen and model. */
interface Pose { focus: THREE.Vector3; dir: THREE.Vector3; dist: number }

/** Where a stop's subject may sit, in normalised device coords (-1..1). */
interface Region { x0: number; x1: number; y0: number; y1: number }

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/* Frames a box from `dir` so its on-screen outline fills `fill` of `region`
   and is centred in it. Measured, not estimated: the box's corners are
   projected and the camera moved until they land (a few rounds converge). */
function fitBox(box: THREE.Box3, dirIn: THREE.Vector3, region: Region, fill: number, aspect: number): Pose {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.05, 400);
  const dir = dirIn.clone().normalize();
  const focus = box.getCenter(new THREE.Vector3());
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => new THREE.Vector3(
    k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z));
  const vt = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  let dist = box.getSize(new THREE.Vector3()).length() / (2 * vt);
  const rw = (region.x1 - region.x0) * fill, rh = (region.y1 - region.y0) * fill;
  const rcx = (region.x0 + region.x1) / 2, rcy = (region.y0 + region.y1) / 2;
  const p = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  for (let round = 0; round < 16; round++) {
    cam.position.copy(focus).addScaledVector(dir, dist);
    cam.lookAt(focus);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) {
      p.copy(c).project(cam);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    right.setFromMatrixColumn(cam.matrixWorld, 0);
    up.setFromMatrixColumn(cam.matrixWorld, 1);
    const halfH = dist * vt, halfW = halfH * aspect;
    focus.addScaledVector(right, ((x0 + x1) / 2 - rcx) * halfW).addScaledVector(up, ((y0 + y1) / 2 - rcy) * halfH);
    dist *= Math.max((x1 - x0) / rw, (y1 - y0) / rh);
  }
  return { focus, dir, dist };
}

/** A stop's words, split into the spans that move. */
interface Say { el: HTMLElement; words: HTMLElement[]; hide: number; dir: number }

/** Scroll position in stops, with the camera holding at each one. */
function tourAt(p: number, n: number) {
  const s = p * (n - 1);
  const i = Math.min(n - 2, Math.floor(s));
  const f = s - i;
  const t = Math.min(1, Math.max(0, (f - HOLD / 2) / (1 - HOLD)));
  return { i, t: t * t * (3 - 2 * t) };
}

function Workspace({ sectionRef, veilRef, edgeRef, copyRef }: {
  sectionRef: RefObject<HTMLElement | null>;
  veilRef: RefObject<HTMLDivElement | null>;
  edgeRef: RefObject<HTMLDivElement | null>;
  copyRef: RefObject<HTMLDivElement | null>;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const accent = useAccent();
  const rootRef = useRef<THREE.Group>(null);

  // three.js objects are mutated every frame, so they live in a ref (set up
  // once the model is in) rather than in render-time values.
  const modelRef = useRef<{
    platforms: Map<string, { node: THREE.Object3D; baseY: number; phase: number }>;
    core: THREE.Object3D | null;
    glow: number;
    coreMat: THREE.MeshStandardMaterial | null;
  } | null>(null);

  useEffect(() => {
    // The core cube is the one thing that glows. Every glow in the model
    // shares MAT_Accent_Emissive, so the core gets its own copy and the
    // shared one drops to a faint edge that shows the shapes and no more.
    const coreNode = scene.getObjectByName('CUBE_Core');
    const under = new Set<THREE.Object3D>();
    coreNode?.traverse((o) => under.add(o));
    let coreMat: THREE.MeshStandardMaterial | null = null;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.name === 'MAT_Accent_Core') {
        mat.emissive.set(accent.glow);
        coreMat = mat;
      } else if (mat.name === 'MAT_Accent_Emissive') {
        mat.emissive.set(accent.glow);
        mat.toneMapped = false;
        if (under.has(mesh)) {
          // Bright enough to cross the bloom threshold; nothing else is.
          const own = (coreMat ??= mat.clone());
          own.name = 'MAT_Accent_Core';
          mesh.material = own;
        } else {
          mat.emissiveIntensity = EDGE_GLOW;
        }
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
      coreMat: coreMat as THREE.MeshStandardMaterial | null,
      glow: glowScale(accent.glow),
    };
  }, [scene, accent]);

  const coreLightRef = useRef<THREE.PointLight>(null);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const posesRef = useRef<Pose[]>([]);
  const saysRef = useRef<Say[]>([]);

  /* The words. Each stop's are fully up for its whole hold, go during the
     first part of the move away and come during the last part of the move in,
     word after word, rising; a pure function of the scroll, so scrolling back
     plays it in reverse. `hide`: 0 shown .. 1 gone; `dir`: 1 leaving (rises
     away), -1 arriving (rises in from below). */
  const showWords = (say: Say, hide: number, dir: number) => {
    hide = Math.round(hide * 1000) / 1000;
    if (say.hide === hide && (say.dir === dir || hide === 0)) return;
    say.hide = hide; say.dir = dir;
    say.el.style.opacity = hide >= 1 ? '0' : '1';
    say.el.style.setProperty('--show', String(1 - hide));
    const n = say.words.length;
    say.words.forEach((w, j) => {
      const e = smooth(clamp01(hide * (1 + WORD_LAG) - (WORD_LAG * j) / Math.max(1, n - 1)));
      w.style.opacity = String(1 - e);
      w.style.transform = e ? `translate3d(0,${(-dir * e * WORD_RISE).toFixed(1)}px,0)` : '';
    });
  };

  useFrame((state, dt) => {
    if (!drawing.onScreen) return;
    // Reduced motion: the island holds still (no sway, bob, drift or pulse).
    const t = reduceMotion ? 0 : state.clock.elapsedTime;
    // Scroll drives the camera; the section is sticky, so its top tells how
    // far through the tour we are.
    const section = sectionRef.current;
    const poses = posesRef.current;
    if (section && poses.length) {
      const r = section.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const vh = window.innerHeight;
      const raw = reduceMotion ? 0 : Math.min(1, Math.max(0, -r.top / span));
      const p = Math.min(1, raw / TOUR_END);
      if (veilRef.current) veilRef.current.style.opacity = String(Math.min(1, Math.max(0, r.top / (vh * 0.55))));
      // Leaving: the scene's bottom edge dissolves into Impacts.
      if (edgeRef.current) edgeRef.current.style.opacity = String(Math.min(1, Math.max(0, (vh - r.bottom) / (vh * 0.12))));
      const { i, t: u } = tourAt(p, poses.length);
      if (!reduceMotion) {
        // The core's words clear before the cube flies into Impacts; the
        // first stop's come in as the section arrives.
        const clear = clamp01((raw - 0.965) / 0.03);
        const arrive = clamp01(r.top / (vh * 0.55));
        const last = saysRef.current.length - 1;
        saysRef.current.forEach((say, k) => {
          let hide = 1, dir = k <= i ? 1 : -1;
          if (k === i) hide = clamp01(u / WORDS_OUT);
          else if (k === i + 1) hide = clamp01((1 - u) / WORDS_OUT);
          if (k === last && clear > 0) { dir = 1; hide = Math.max(hide, clear); }
          if (k === 0 && arrive > 0) { dir = -1; hide = Math.max(hide, arrive); }
          showWords(say, hide, dir);
        });
      }
      const a = poses[i], b = poses[i + 1];
      tmp.a.lerpVectors(a.focus, b.focus, u);
      tmp.b.lerpVectors(a.dir, b.dir, u).normalize();
      const dist = THREE.MathUtils.lerp(a.dist, b.dist, u);
      const cam = state.camera as THREE.PerspectiveCamera;
      cam.position.copy(tmp.a).addScaledVector(tmp.b, dist);
      cam.lookAt(tmp.a);
      const world = state.scene;
      if (world.fog instanceof THREE.Fog) { world.fog.near = dist - 1; world.fog.far = dist + 13; }
    }
    const model = modelRef.current;
    if (!model) return;
    const k = 1 - Math.exp(-LIFT_EASE * Math.min(dt, 0.05));
    model.platforms.forEach(({ node, baseY, phase }, name) => {
      // Staggered phases, so they rise and fall like a slow wave, not in unison.
      const drift = (Math.sin(t * DRIFT_SPEED + phase) * 0.5 + 0.5) * DRIFT;
      const rise = name === 'CUBE_Core' ? coreHandoff.lift * CORE_RISE : 0;
      const target = baseY + drift + rise;
      node.position.y += (target - node.position.y) * k;
    });
    if (model.coreMat) model.coreMat.emissiveIntensity = (2.2 + Math.sin(t * 1.6) * 0.35) * model.glow;

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
    coreHandoff.yaw = 0;
    coreHandoff.ready = true;
  });

  useEffect(() => () => {
    coreHandoff.ready = false;
    coreHandoff.canvas = null;
  }, []);

  /* The words' spans, and a refit whenever their layout changes (resize,
     fonts arriving). */
  const [wordsLaid, setWordsLaid] = useState(0);
  useEffect(() => {
    const copy = copyRef.current;
    if (!copy) return;
    const says = Array.from(copy.querySelectorAll<HTMLElement>('.ab3-say')).map((el) => ({
      el, words: Array.from(el.querySelectorAll<HTMLElement>('.ab3-w')), hide: -1, dir: 0,
    }));
    saysRef.current = says;
    let live = true;
    const bump = () => { if (live) setWordsLaid((n) => n + 1); };
    const ro = new ResizeObserver(bump);
    says.forEach((s) => ro.observe(s.el));
    document.fonts?.ready.then(bump);
    return () => {
      live = false;
      ro.disconnect();
      says.forEach((s) => { s.el.style.opacity = ''; s.el.style.removeProperty('--show'); s.words.forEach((w) => { w.style.opacity = ''; w.style.transform = ''; }); });
      saysRef.current = [];
    };
  }, [copyRef]);

  /* Where the camera goes: each stop frames its node, measured in the rest
     pose so a refit always gives the same answer, into the part of the screen
     its words leave free: beside them on a wide screen, below them on a tall
     one. Measured from the laid-out words, so the subject never sits under
     them at any size. */
  const width = useThree((st) => st.size.width);
  const height = useThree((st) => st.size.height);
  useEffect(() => {
    if (width < 10 || height < 10) return;
    const root = rootRef.current;
    if (root) { root.rotation.y = BASE_YAW; root.position.y = 0; }
    const moved = new Map<THREE.Object3D, number>();
    modelRef.current?.platforms.forEach(({ node, baseY }) => { moved.set(node, node.position.y); node.position.y = baseY; });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const copy = copyRef.current?.getBoundingClientRect();
    const tall = window.matchMedia('(max-aspect-ratio: 9/10)').matches;
    // px -> normalised device coords
    const nx = (x: number) => (x / width) * 2 - 1, ny = (y: number) => 1 - (y / height) * 2;
    posesRef.current = ABOUT_STOPS.map((stop: AboutStop, k) => {
      const node = stop.node ? scene.getObjectByName(stop.node) : null;
      box.setFromObject(node ?? scene);
      let x0 = EDGE.side, x1 = width - EDGE.side, y0 = EDGE.top;
      const y1 = height - EDGE.bottom;
      const say = saysRef.current[k]?.el.getBoundingClientRect();
      if (say && copy && !reduceMotion) {
        const l = say.left - copy.left, r = say.right - copy.left, b = say.bottom - copy.top;
        if (tall) y0 = Math.max(y0, b + EDGE.gap);
        else if (stop.side === 'left') x0 = Math.max(x0, r + EDGE.gap);
        else x1 = Math.min(x1, l - EDGE.gap);
      }
      const region = { x0: nx(x0), x1: nx(x1), y0: ny(y1), y1: ny(y0) };
      return fitBox(box, new THREE.Vector3(...stop.dir), region, 1 / stop.frame, width / height);
    });
    moved.forEach((y, node) => { node.position.y = y; });
    scene.updateMatrixWorld(true);
  }, [scene, width, height, wordsLaid, copyRef, reduceMotion]);

  // The one coloured light: the core's, in model space.
  const k = glowScale(accent.glow) * 0.75;
  return (
    <>
    <group ref={rootRef}>
      <primitive object={scene} />
      <pointLight ref={coreLightRef} position={[0.39, 1.25, 0.6]} intensity={7 * k} userData={{ base: 7 * k }} distance={3} decay={2} color={accent.glow} />
    </group>
    </>
  );
}

/* The world around the island: a glossy floor and a dim field of towers
   fading into fog, so the model sits in a place, not on an empty shelf.
   Static, so the island's sway reads against it. One instanced draw call. */
function Surroundings() {
  const towersRef = useRef<THREE.InstancedMesh>(null);
  const towers = useMemo(() => {
    const rand = seeded(0x51ab3);
    const towers: { x: number; z: number; w: number; d: number; h: number }[] = [];
    while (towers.length < 80) {
      const ang = rand() * Math.PI * 2;
      const r = 4.2 + Math.pow(rand(), 0.8) * 11;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      // Behind the island as the camera sees it, never in front of it.
      const towardCam = (x * 6 + z * 7) / 9.2;     // world → camera direction
      if (towardCam > -0.5) continue;
      const w = 0.35 + rand() * 0.9, d = 0.35 + rand() * 0.9;
      const h = 0.4 + rand() * (0.8 + r * 0.32);
      towers.push({ x, z, w, d, h });
    }
    return towers;
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
    if (towersRef.current) towersRef.current.instanceMatrix.needsUpdate = true;
  }, [towers]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060709" metalness={0.2} roughness={0.7} />
      </mesh>
      <instancedMesh ref={towersRef} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0e1013" metalness={0} roughness={0.95} />
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

/* Phones: the same scene drawn straight to the screen, without the bloom
   passes (the glow materials still glow, they just don't bleed). Same rule
   as Bloom: draw only while on screen. */
function PlainRender() {
  const get = useThree((s) => s.get);
  useEffect(() => { get().gl.setClearColor(0x000000, 0); }, [get]);
  useFrame(() => {
    if (!drawing.onScreen && drawing.warm <= 0) return;
    drawing.warm = Math.max(0, drawing.warm - 1);
    const { gl, scene, camera } = get();
    gl.render(scene, camera);
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

export default function WorkspaceCanvas({ sectionRef, veilRef, edgeRef, copyRef }: {
  sectionRef: RefObject<HTMLElement | null>;
  veilRef: RefObject<HTMLDivElement | null>;
  edgeRef: RefObject<HTMLDivElement | null>;
  copyRef: RefObject<HTMLDivElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Small screens get a lighter render: 1x pixels, no antialiasing, no bloom.
  const lite = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches, []);

  return (
    <div ref={wrapRef} className="ab3-canvas">
      <Canvas
        dpr={lite ? 1 : [1, 1.25]}
        camera={{ fov: FOV, position: [6, 5.2, 7], near: 0.1, far: 80 }}
        gl={{ antialias: !lite, alpha: true, powerPreference: 'high-performance' }}
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
        <directionalLight position={[-6, 6, 5]} intensity={0.35} />
        <directionalLight position={[-8, 2.2, -5]} intensity={0.9} color="#d5deea" />
        <Atmosphere />
        <Surroundings />
        <Workspace sectionRef={sectionRef} veilRef={veilRef} edgeRef={edgeRef} copyRef={copyRef} />
        {lite ? <PlainRender /> : <Bloom />}
        <Prewarm />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
