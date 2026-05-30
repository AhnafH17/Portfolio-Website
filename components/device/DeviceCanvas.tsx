'use client';

import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import Laptop from './Laptop';
import Phone from './Phone';
import { readAccent } from '@/lib/accent';

/**
 * R3F canvas for the device hero. Self-contained lighting (no external HDR),
 * so it works offline and adds no extra network requests. The `progress` ref is
 * driven by ScrollTrigger in DeviceShowcase and read inside useFrame.
 */
export default function DeviceCanvas({
  kind,
  progress,
}: {
  kind: 'laptop' | 'phone';
  progress: { current: number };
}) {
  const accent = useMemo(() => readAccent(), []);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 5.4], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Key + fill + rim */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} castShadow />
      <directionalLight position={[-5, 2, -2]} intensity={0.5} color="#9fb4d0" />
      {/* Accent rim light from behind, palette-matched */}
      <pointLight position={[0, 1.5, -3]} intensity={1.4} distance={9} color={accent.glow} />
      <pointLight position={[-3, -1, 2]} intensity={0.4} distance={8} color={accent.deep} />

      {kind === 'laptop' ? <Laptop progress={progress} /> : <Phone progress={progress} />}
    </Canvas>
  );
}
