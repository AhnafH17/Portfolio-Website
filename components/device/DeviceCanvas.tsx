'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, useGLTF, useTexture } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import Laptop, { MODEL_URL as LAPTOP_URL, SHADOW_URL } from './Laptop';
import Phone, { MODEL_URL as PHONE_URL } from './Phone';
import { readAccent } from '@/lib/accent';

/* The render loop stays off until the section is on screen, which used to
   mean the very first frame — shader compiles, texture uploads, the
   environment bake — landed exactly as the user scrolled in (~0.9s on a
   desktop GPU). Instead: compile the shaders in parallel off the main
   thread (compileAsync), then render that first frame in idle time, long
   before the section is reached. Measured: 929ms blocking → ~136ms. */
function Prewarm({ ready }: { ready: boolean }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // Wait for the environment: the laptop's shader variants depend on it,
    // so compiling before it's set would just compile them twice.
    if (!ready) return;
    let cancelled = false;
    let idleId: number | undefined;
    gl.compileAsync(scene, camera).then(() => {
      if (cancelled) return;
      const run = () => { if (!cancelled) advance(performance.now()); };
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
  }, [ready, advance, gl, scene, camera]);
  return null;
}

/* The single most expensive thing in this scene is one shader: three's
   PMREM GGX filter, which pre-blurs the environment map for the metal's
   reflections. On Windows (ANGLE → D3D11) linking it takes ~400ms, and three
   links it synchronously the first time any material asks for the
   environment. So: build the identical PMREM materials here and compile them
   with compileAsync (parallel, off the main thread) BEFORE the Environment
   exists. When three's own PMREMGenerator needs the program it's already in
   the renderer's program cache, keyed by identical source + defines.
   Relies on PMREMGenerator internals (_setSize/_allocateTargets and the
   material fields) — if a three upgrade renames them this silently falls
   back to the old behaviour (onReady still fires). */
interface PmremInternals {
  _setSize(size: number): void;
  _allocateTargets(): THREE.WebGLRenderTarget;
  _lodMeshes?: THREE.Mesh[];
  _ggxMaterial?: THREE.Material | null;
  _blurMaterial?: THREE.Material | null;
  _cubemapMaterial?: THREE.Material | null;
  compileCubemapShader(): void;
}

function WarmPmrem({ cubeSize, onReady }: { cubeSize: number; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) onReady(); };
    try {
      // Deliberately never disposed: disposing these materials would release
      // the very programs we're warming before three's own generator uses them.
      const pmrem = new THREE.PMREMGenerator(gl) as unknown as PmremInternals;
      pmrem._setSize(cubeSize);
      const target = pmrem._allocateTargets();
      pmrem.compileCubemapShader();
      const geometry = pmrem._lodMeshes?.[0]?.geometry;
      const materials = [pmrem._ggxMaterial, pmrem._blurMaterial, pmrem._cubemapMaterial]
        .filter((m): m is THREE.Material => !!m);
      if (!geometry || materials.length === 0) { finish(); return; }

      const warmScene = new THREE.Scene();
      for (const m of materials) warmScene.add(new THREE.Mesh(geometry, m));
      // Program variants depend on the bound target (colour space, tone
      // mapping) — PMREM renders into a linear render target, so match it.
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      const compiling = gl.compileAsync(warmScene, new THREE.OrthographicCamera());
      gl.setRenderTarget(prev);
      compiling.then(finish, finish);
    } catch {
      finish();
    }
    return () => { cancelled = true; };
  }, [gl, cubeSize, onReady]);
  return null;
}

/**
 * R3F canvas for the device hero. A studio environment (built from Lightformers,
 * no external HDR fetch) gives the metal real reflections; ContactShadows grounds
 * the device. The `progress` ref is driven by ScrollTrigger in DeviceShowcase.
 */
/** Fetch and parse the device's model ahead of time (the page calls this in
    idle time while the hero is up), so the intro doesn't wait on it and the
    parse doesn't land mid-scroll. Only the device this visitor will see. */
export function preloadDeviceModel(kind: 'laptop' | 'phone') {
  if (kind === 'laptop') {
    useGLTF.preload(LAPTOP_URL);
    useTexture.preload(SHADOW_URL);
  } else {
    useGLTF.preload(PHONE_URL);
  }
}

export default function DeviceCanvas({
  kind,
  progress,
  active = true,
}: {
  kind: 'laptop' | 'phone';
  progress: { current: number };
  active?: boolean;
}) {
  const accent = useMemo(() => readAccent(), []);
  const isPhone = kind === 'phone'; // phone === the mobile path → optimise hard
  const envResolution = isPhone ? 64 : 128;
  const [envReady, setEnvReady] = useState(false);
  const markEnvReady = useMemo(() => () => setEnvReady(true), []);

  const camera = isPhone
    ? { position: [0, 0, 7.0] as [number, number, number], fov: 30 }
    : { position: [0, 0.25, 6.4] as [number, number, number], fov: 34 };

  return (
    <Canvas
      // Pause the entire render loop when the hero is off-screen (no GPU work).
      frameloop={active ? 'always' : 'never'}
      // Pixel ratio: 1x on mobile (retina 2–3x is the #1 mobile lag source),
      // up to 1.5x on desktop.
      dpr={isPhone ? 1 : [1, 1.5]}
      camera={camera}
      gl={{ antialias: !isPhone, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.55} />
      {/* Soft key (front-top so the open keyboard deck is lit) + cool fill */}
      <directionalLight position={[0, 5, 6]} intensity={1.4} />
      <directionalLight position={[-5, 2, -2]} intensity={0.4} color="#9fb4d0" />
      {/* Subtle palette-accent rim from behind (kept low so the metal stays silver) */}
      <pointLight position={[0, 1.6, -3]} intensity={0.5} distance={10} color={accent.glow} />

      {/* Neutral studio environment — silver reflections, no colour cast.
          Baked once (frames={1}) at low resolution — cheap. */}
      <WarmPmrem cubeSize={envResolution} onReady={markEnvReady} />
      {envReady && (
        <Environment resolution={envResolution} frames={1}>
          <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 4, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={1.4} position={[-4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
          <Lightformer form="rect" intensity={1.4} position={[4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
          {/* faint accent glint only */}
          <Lightformer form="rect" intensity={0.35} position={[0, 0, -4]} scale={[6, 6, 1]} color={accent.glow} />
          <Lightformer form="rect" intensity={0.4} position={[0, -4, 1]} scale={[8, 4, 1]} color="#1a1f27" />
        </Environment>
      )}

      {/* No real-time ContactShadows any more: it rendered the whole scene a
          second time every frame. The laptop model carries a baked contact
          shadow (its SHADOW plane); the phone path never drew one. */}
      {kind === 'laptop' ? <Laptop progress={progress} /> : <Phone progress={progress} />}
      <Prewarm ready={envReady} />
    </Canvas>
  );
}
