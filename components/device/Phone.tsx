'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { makeScreenTexture } from './screenTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, phase, easeInOut, easeOut, DAMP } from './beats';

const BODY = '#1c2129';

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const { pointer } = useThree();

  const accent = useMemo(() => readAccent(), []);
  const tex = useMemo(() => makeScreenTexture('phone'), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current) return;

    // Beat A — spin 180° (back w/ camera bump → front)
    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    // Beat B — stand upright (tilt from slightly reclined to straight-on)
    const open = easeInOut(phase(p, BEATS.open));
    const tiltX = THREE.MathUtils.lerp(0.5, 0, open);

    // Beat C — screen wakes + dolly in
    const wake = easeOut(phase(p, BEATS.wake));
    const dollyZ = THREE.MathUtils.lerp(0, 1.6, wake);

    const parX = pointer.x * 0.18 * open;
    const parY = pointer.y * 0.1 * open;

    const k = 1 - Math.exp(-DAMP * dt);
    root.current.rotation.y += (rotY + parX - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - parY - root.current.rotation.x) * k;
    root.current.position.z += (dollyZ - root.current.position.z) * k;

    if (screenMat.current) {
      const target = 0.15 + wake * 1.25;
      screenMat.current.emissiveIntensity +=
        (target - screenMat.current.emissiveIntensity) * k;
    }
  });

  return (
    <group ref={root} rotation={[0.5, Math.PI, 0]} position={[0, 0, 0]} scale={1.15}>
      {/* Body slab */}
      <RoundedBox args={[1.5, 3.05, 0.16]} radius={0.16} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} metalness={0.88} roughness={0.3} />
      </RoundedBox>

      {/* Rear camera bump (visible as the "back" at the start) */}
      <RoundedBox args={[0.62, 0.62, 0.07]} radius={0.1} smoothness={4} position={[-0.38, 1.05, -0.1]}>
        <meshStandardMaterial color="#0c0f14" metalness={0.6} roughness={0.4} />
      </RoundedBox>
      <mesh position={[-0.52, 1.18, -0.14]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.24, 0.92, -0.14]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Screen (front face) */}
      <mesh position={[0, 0, 0.082]}>
        <planeGeometry args={[1.36, 2.9]} />
        <meshStandardMaterial
          ref={screenMat}
          map={tex}
          emissiveMap={tex}
          emissive={'#ffffff'}
          emissiveIntensity={0.15}
          toneMapped={false}
          roughness={0.25}
          metalness={0}
        />
      </mesh>

      <pointLight position={[0, 0, 0.6]} intensity={0.5} distance={3} color={accent.glow} />
    </group>
  );
}
