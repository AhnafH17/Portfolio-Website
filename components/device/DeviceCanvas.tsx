'use client';

import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, ContactShadows } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import Laptop from './Laptop';
import Phone from './Phone';
import { readAccent } from '@/lib/accent';

/**
 * R3F canvas for the device hero. A studio environment (built from Lightformers,
 * no external HDR fetch) gives the metal real reflections; ContactShadows grounds
 * the device. The `progress` ref is driven by ScrollTrigger in DeviceShowcase.
 */
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

  const camera = isPhone
    ? { position: [0, 0, 7.0] as [number, number, number], fov: 30 }
    : { position: [0, 0.25, 6.4] as [number, number, number], fov: 34 };

  const groundY = isPhone ? -2.25 : -1.35;

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
      <Environment resolution={isPhone ? 64 : 128} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.4} position={[-4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
        <Lightformer form="rect" intensity={1.4} position={[4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
        {/* faint accent glint only */}
        <Lightformer form="rect" intensity={0.35} position={[0, 0, -4]} scale={[6, 6, 1]} color={accent.glow} />
        <Lightformer form="rect" intensity={0.4} position={[0, -4, 1]} scale={[8, 4, 1]} color="#1a1f27" />
      </Environment>

      {/* Grounding shadow — DESKTOP ONLY. On mobile it's the biggest cost: a
          dynamic ContactShadows re-renders the scene a second time every frame.
          Dropping it on the phone path is the main mobile-smoothness win. */}
      {!isPhone && (
        <ContactShadows
          position={[0, groundY, 0]}
          opacity={0.55}
          scale={11}
          blur={2.6}
          far={5}
          resolution={256}
          color="#000000"
        />
      )}

      {kind === 'laptop' ? <Laptop progress={progress} /> : <Phone progress={progress} />}
    </Canvas>
  );
}
