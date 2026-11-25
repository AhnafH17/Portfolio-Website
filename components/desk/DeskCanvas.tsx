'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { useAccent } from '@/lib/palette';
import DeskModel, { type DeskBindings } from './DeskModel';
import { loadDeskThumbnails } from './screens';
import { DESK_BUDGETS, type DeskQuality } from './quality';
import { loadDeskModel } from './loadModel';
import type { ReportDeskLoad } from './loading';
import { INTRO_END } from './timeline';
import {
  deskEnvironment,
  HEMI_SCALE,
  LIGHTS,
  ringHalo,
  ROOM_DARKEN,
  stripHalo,
  tuneDeskMaterials,
} from './look';

function ContextGuard({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onFailure);
    return () => canvas.removeEventListener('webglcontextlost', onFailure);
  }, [canvas, onFailure]);
  return null;
}

function Room({ resolution }: { resolution: number }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const environment = deskEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment.scene, 0.02, 0.1, 100, { size: resolution });
    scene.environment = target.texture;
    scene.environmentIntensity = 0.15;
    environment.dispose();
    generator.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [get, resolution]);
  return null;
}

interface Anchors {
  edge: THREE.Box3;
  bar: THREE.Box3;
  fan: { position: THREE.Vector3; quaternion: THREE.Quaternion; radius: number };
  hood: THREE.Vector3;
  desk: THREE.Vector3;
}

function measure(scene: THREE.Object3D): Anchors | null {
  const edge = scene.getObjectByName('GLOW_DeskEdge');
  const bar = scene.getObjectByName('LIGHTBAR');
  const fan = scene.getObjectByName('FAN_Ring');
  const person = scene.getObjectByName('PERSON');
  const desk = scene.getObjectByName('DESK');
  if (!edge || !bar || !fan || !person || !desk) return null;
  scene.updateMatrixWorld(true);
  const figure = new THREE.Box3().setFromObject(person);
  return {
    edge: new THREE.Box3().setFromObject(edge),
    bar: new THREE.Box3().setFromObject(bar),
    fan: {
      position: fan.getWorldPosition(new THREE.Vector3()),
      quaternion: fan.getWorldQuaternion(new THREE.Quaternion()),
      radius: new THREE.Box3().setFromObject(fan).getSize(new THREE.Vector3()).y / 2,
    },
    // The hood and shoulders: the top of the figure, a little below the crown.
    hood: new THREE.Vector3(
      (figure.min.x + figure.max.x) / 2,
      figure.max.y - 0.16,
      (figure.min.z + figure.max.z) / 2
    ),
    desk: new THREE.Box3().setFromObject(desk).getCenter(new THREE.Vector3()),
  };
}

/** Product-shot finish over DeskModel (see look.ts). It mounts after
 *  DeskModel, so its frame callback runs after DeskModel's and can scale
 *  what DeskModel set. */
function DeskLook({ quality }: { quality: DeskQuality }) {
  const get = useThree((state) => state.get);
  const accent = useAccent();
  const full = quality === 'full';
  const [anchors, setAnchors] = useState<Anchors | null>(null);
  const fill = useRef<THREE.SpotLight>(null);
  const rim = useRef<THREE.SpotLight>(null);
  const under = useRef<THREE.RectAreaLight>(null);
  const halos = useRef<THREE.MeshBasicMaterial[]>([]);
  const hemi = useRef<THREE.HemisphereLight | null>(null);
  const darkened = useRef(new WeakSet<THREE.Fog>());
  const textures = useMemo(() => ({ strip: stripHalo(), ring: ringHalo(0.72) }), []);
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);

  useEffect(() => {
    const { scene, gl } = get();
    setAnchors(measure(scene));
    scene.traverse((o) => {
      if (o instanceof THREE.HemisphereLight) hemi.current = o;
    });
    return tuneDeskMaterials(scene, gl.capabilities.getMaxAnisotropy());
  }, [get]);

  useEffect(() => {
    if (!anchors) return;
    fill.current?.target.position.set(anchors.desk.x - 0.12, anchors.desk.y, anchors.desk.z + 0.32);
    fill.current?.target.updateMatrixWorld();
    rim.current?.target.position.copy(anchors.hood);
    rim.current?.target.updateMatrixWorld();
    if (under.current) {
      const c = anchors.edge.getCenter(new THREE.Vector3());
      under.current.lookAt(c.x, c.y - 0.55, c.z + 0.8);
    }
  }, [anchors, full]);

  useFrame(({ scene }) => {
    // DeskModel sets environmentIntensity to 0.25 x its tour and intro light.
    const light = THREE.MathUtils.clamp(scene.environmentIntensity / 0.25, 0, 1);
    const fog = scene.fog as THREE.Fog | null;
    if (fog && !darkened.current.has(fog)) {
      fog.color.multiplyScalar(ROOM_DARKEN);
      if (scene.background instanceof THREE.Color) scene.background.copy(fog.color);
      darkened.current.add(fog);
    }
    if (hemi.current) hemi.current.intensity *= HEMI_SCALE;
    if (fill.current) fill.current.intensity = LIGHTS.fill.intensity * light;
    if (rim.current) rim.current.intensity = LIGHTS.rim.intensity * light;
    if (under.current) under.current.intensity = LIGHTS.under.intensity * light;
    halos.current.forEach((m) => (m.opacity = m.userData.opacity * light));
  });

  if (!anchors) return null;
  const edge = anchors.edge.getCenter(new THREE.Vector3());
  const edgeSize = anchors.edge.getSize(new THREE.Vector3());
  const bar = anchors.bar.getCenter(new THREE.Vector3());
  const barSize = anchors.bar.getSize(new THREE.Vector3());
  const halo = (i: number, map: THREE.Texture, opacity: number) => (
    <meshBasicMaterial
      ref={(m) => {
        if (!m) return;
        m.userData.opacity = opacity;
        halos.current[i] = m;
      }}
      map={map}
      color={accent.glow}
      transparent
      opacity={opacity}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      toneMapped={false}
      fog={false}
    />
  );
  return (
    <>
      <spotLight
        ref={fill}
        position={[anchors.desk.x - 0.15, anchors.desk.y + 1.9, anchors.desk.z + 0.55]}
        color={LIGHTS.fill.color}
        angle={LIGHTS.fill.angle}
        penumbra={1}
        decay={2}
      />
      <spotLight
        ref={rim}
        position={[anchors.hood.x + 0.1, anchors.hood.y + 0.35, anchors.hood.z - 0.9]}
        color={LIGHTS.rim.color}
        angle={LIGHTS.rim.angle}
        penumbra={0.8}
        decay={2}
      />
      {full && (
        <>
          <rectAreaLight
            ref={under}
            position={[edge.x, edge.y - 0.004, edge.z + 0.006]}
            width={edgeSize.x}
            height={0.012}
            color={accent.glow}
          />
          {/* Fake bloom: additive halos on the emissive strips only. */}
          <mesh position={[edge.x, edge.y, anchors.edge.max.z + 0.002]}>
            <planeGeometry args={[edgeSize.x + 0.04, 0.05]} />
            {halo(0, textures.strip, 0.42)}
          </mesh>
          <mesh position={[bar.x, anchors.bar.min.y + 0.004, anchors.bar.max.z + 0.004]}>
            <planeGeometry args={[barSize.x + 0.05, 0.05]} />
            {halo(1, textures.strip, 0.36)}
          </mesh>
          <group position={anchors.fan.position} quaternion={anchors.fan.quaternion}>
            <mesh position={[0, 0, 0.004]}>
              <planeGeometry args={[anchors.fan.radius * 2.9, anchors.fan.radius * 2.9]} />
              {halo(2, textures.ring, 0.5)}
            </mesh>
          </group>
        </>
      )}
    </>
  );
}

function RenderBudget({
  active,
  ready,
  quality,
  introStart,
  onSlow,
}: {
  active: boolean;
  ready: boolean;
  quality: DeskQuality;
  introStart: DeskBindings['introStart'];
  onSlow: () => void;
}) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    if (!active) return;
    const interval = 1000 / DESK_BUDGETS[quality].fps;
    let frame = 0;
    let next = 0;
    let previous = performance.now();
    let clock = get().clock.elapsedTime;
    let observed = 0;
    let frames = 0;
    let cpu = 0;
    let slowWindows = 0;
    const step = (time: number) => {
      if (time >= next - 0.55) {
        const elapsed = Math.max(0, time - previous);
        clock += Math.min(elapsed, 50) / 1000;
        const start = performance.now();
        get().advance(clock, false);
        next = next ? Math.max(next + interval, time + interval * 0.5) : time + interval;
        previous = time;
        // Ignore model/shader warmup, the power-on (a switch now would
        // rebuild every shader mid-handover) and isolated long frames. Drop
        // quality after two sustained windows of expensive or infrequent draws.
        const began = introStart.current;
        if (ready && quality === 'full' && began !== null && time - began > INTRO_END * 1000) {
          observed += elapsed;
          frames++;
          cpu += performance.now() - start;
          if (observed >= 1000) {
            slowWindows = frames / observed < 0.045 || cpu / frames > 13 ? slowWindows + 1 : 0;
            observed = frames = cpu = 0;
            if (slowWindows >= 2) onSlow();
          }
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, ready, get, quality, introStart, onSlow]);
  return null;
}

export default function DeskCanvas({
  active,
  ready,
  quality,
  onFailure,
  onSlow,
  reportLoad,
  ...bindings
}: DeskBindings & {
  active: boolean;
  ready: boolean;
  quality: DeskQuality;
  onFailure: () => void;
  onSlow: () => void;
  reportLoad: ReportDeskLoad;
}) {
  const [source, setSource] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadDeskThumbnails();
    loadDeskModel((event) => {
      if (!mounted) return;
      reportLoad({
        phase: 'downloading',
        fraction: event.lengthComputable && event.total ? Math.min(1, event.loaded / event.total) : null,
      });
    }).then(
      ({ scene }) => {
        if (!mounted) return;
        reportLoad({ phase: 'rendering' });
        setSource(scene);
      },
      () => {
        if (mounted) onFailure();
      }
    );
    return () => {
      mounted = false;
    };
  }, [onFailure, reportLoad]);
  if (!source) return null;
  const full = quality === 'full';
  return (
    <>
      <Canvas
        aria-hidden="true"
        frameloop="never"
        dpr={[1, DESK_BUDGETS[quality].dpr]}
        camera={{ fov: 38, near: 0.012, far: 48 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
        onCreated={({ gl }) => {
          RectAreaLightUniformsLib.init();
          gl.toneMapping = THREE.NeutralToneMapping;
        }}
      >
        <ContextGuard onFailure={onFailure} />
        <Room resolution={DESK_BUDGETS[quality].environment} />
        <DeskModel source={source} {...bindings} />
        <DeskLook quality={quality} />
        <RenderBudget active={active} ready={ready} quality={quality} introStart={bindings.introStart} onSlow={onSlow} />
      </Canvas>
      {full && (
        // A very light vignette holds the eye on the lit desk.
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(120% 95% at 58% 52%, transparent 58%, rgba(0,0,0,.32) 100%)',
          }}
        />
      )}
    </>
  );
}
