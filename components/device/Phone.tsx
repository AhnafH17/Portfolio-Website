'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { createScreenSurface } from './screenTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';
const P = POSE.phone;

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  const accent = useMemo(() => readAccent(), []);
  const surface = useMemo(() => createScreenSurface('phone'), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current) return;

    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    const open = easeInOut(phase(p, BEATS.open));
    const tiltX = THREE.MathUtils.lerp(0.45, 0, open);
    const scale = THREE.MathUtils.lerp(P.introScale, P.dockScale, open);

    const wake = easeOut(phase(p, BEATS.wake));
    const read = phase(p, BEATS.read);

    const k = 1 - Math.exp(-DAMP * dt);
    // No cursor parallax — phone stays constant, facing forward.
    root.current.rotation.y += (rotY - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - root.current.rotation.x) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);

    if (screenMat.current) {
      const target = 0.12 + wake * 1.15;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }
    surface.render(read, state.clock.elapsedTime);
  });

  return (
    <group ref={root} rotation={[0.45, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* Silver body slab — this is the BACK + sides */}
      <RoundedBox args={[1.5, 3.05, 0.16]} radius={0.16} smoothness={5}>
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.32} />
      </RoundedBox>

      {/* Display panel on the FRONT (+z) — scrollable content texture */}
      <mesh position={[0, 0, 0.082]}>
        <planeGeometry args={[1.42, 2.96]} />
        <meshStandardMaterial
          ref={screenMat}
          map={surface.texture}
          emissiveMap={surface.texture}
          emissive={'#ffffff'}
          emissiveIntensity={0.12}
          toneMapped={false}
          metalness={0}
          roughness={0.3}
        />
      </mesh>

      {/* Rear camera bump (the silver "back" you see at the start) */}
      <RoundedBox args={[0.62, 0.62, 0.07]} radius={0.1} smoothness={4} position={[-0.38, 1.05, -0.11]}>
        <meshStandardMaterial color="#15181d" metalness={0.7} roughness={0.4} />
      </RoundedBox>
      <mesh position={[-0.52, 1.18, -0.15]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.24, 0.92, -0.15]} rotation={[Math.PI, 0, 0]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>

      <pointLight position={[0, 0, 0.6]} intensity={0.5} distance={3} color={emissive} />
    </group>
  );
}
