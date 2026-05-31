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
}: {
  kind: 'laptop' | 'phone';
  progress: { current: number };
}) {
  const accent = useMemo(() => readAccent(), []);

  const camera =
    kind === 'phone'
      ? { position: [0, 0, 7.0] as [number, number, number], fov: 30 }
      : { position: [0, 0.25, 6.4] as [number, number, number], fov: 34 };

  const groundY = kind === 'phone' ? -2.25 : -1.35;

  return (
    <Canvas
      dpr={[1, 2]}
      camera={camera}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
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

      {/* Neutral studio environment — silver reflections, no colour cast */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[8, 4, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.4} position={[-4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
        <Lightformer form="rect" intensity={1.4} position={[4, 1, 2]} scale={[1, 5, 1]} color="#eef2f6" />
        {/* faint accent glint only */}
        <Lightformer form="rect" intensity={0.35} position={[0, 0, -4]} scale={[6, 6, 1]} color={accent.glow} />
        <Lightformer form="rect" intensity={0.4} position={[0, -4, 1]} scale={[8, 4, 1]} color="#1a1f27" />
      </Environment>

      {/* Grounding shadow */}
      <ContactShadows
        position={[0, groundY, 0]}
        opacity={0.55}
        scale={kind === 'phone' ? 9 : 11}
        blur={2.6}
        far={5}
        resolution={512}
        color="#000000"
      />

      {kind === 'laptop' ? <Laptop progress={progress} /> : <Phone progress={progress} />}
    </Canvas>
  );
}
