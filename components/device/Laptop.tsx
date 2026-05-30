'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { makeScreenTexture } from './screenTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, phase, easeInOut, easeOut, DAMP } from './beats';

const BODY = '#1c2129';   // brushed dark metal
const DECK = '#11151b';   // keyboard deck

export default function Laptop({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const { pointer } = useThree();

  const accent = useMemo(() => readAccent(), []);
  const tex = useMemo(() => makeScreenTexture('laptop'), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30); // clamp on slow frames
    const p = progress.current;
    if (!root.current || !lid.current) return;

    // Beat A — spin 180°: start showing the back (π), end facing front (0)
    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    // Beat B — lid opens (0 closed → ~115° open) + whole unit tilts back a touch
    const open = easeInOut(phase(p, BEATS.open));
    const lidAngle = THREE.MathUtils.lerp(0.02, -Math.PI * 0.64, open);
    const tiltX = THREE.MathUtils.lerp(0, -0.16, open);

    // Beat C — wake: screen powers on + camera dollies in (push group toward cam)
    const wake = easeOut(phase(p, BEATS.wake));
    const dollyZ = THREE.MathUtils.lerp(0, 1.35, wake);
    const liftY = THREE.MathUtils.lerp(0, 0.15, wake);

    // Subtle cursor parallax once it's facing us (scaled by how open it is)
    const parX = pointer.x * 0.12 * open;
    const parY = pointer.y * 0.06 * open;

    const k = 1 - Math.exp(-DAMP * dt); // frame-rate-independent damping factor
    root.current.rotation.y += (rotY + parX - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - parY - root.current.rotation.x) * k;
    root.current.position.z += (dollyZ - root.current.position.z) * k;
    root.current.position.y += (liftY - root.current.position.y) * k;
    lid.current.rotation.x += (lidAngle - lid.current.rotation.x) * k;

    if (screenMat.current) {
      const target = 0.15 + wake * 1.25;
      screenMat.current.emissiveIntensity +=
        (target - screenMat.current.emissiveIntensity) * k;
    }
  });

  return (
    <group ref={root} rotation={[0, Math.PI, 0]} position={[0, -0.3, 0]} scale={1}>
      {/* ── Base / keyboard deck ── */}
      <RoundedBox args={[3, 0.13, 2.05]} radius={0.05} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} metalness={0.85} roughness={0.32} />
      </RoundedBox>
      {/* Deck inset (keyboard area) */}
      <mesh position={[0, 0.071, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.7, 1.5]} />
        <meshStandardMaterial color={DECK} metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Trackpad */}
      <mesh position={[0, 0.072, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.95, 0.6]} />
        <meshStandardMaterial color="#0c0f14" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* ── Lid (hinged at back edge, z = -1.0) ── */}
      <group ref={lid} position={[0, 0.065, -1.0]} rotation={[0.02, 0, 0]}>
        {/* lid shell, pivots up from the hinge → centre offset +1.0 in z */}
        <RoundedBox args={[3, 1.9, 0.08]} radius={0.05} smoothness={4} position={[0, 0.95, 0]} castShadow>
          <meshStandardMaterial color={BODY} metalness={0.88} roughness={0.3} />
        </RoundedBox>
        {/* Outer-lid logo (visible as the "back" at the start) */}
        <mesh position={[0, 0.95, -0.045]}>
          <circleGeometry args={[0.26, 48]} />
          <meshStandardMaterial
            color={accent.glow}
            emissive={emissive}
            emissiveIntensity={0.4}
            metalness={0.2}
            roughness={0.4}
          />
        </mesh>
        {/* Screen (inner face) */}
        <mesh position={[0, 0.95, 0.045]}>
          <planeGeometry args={[2.78, 1.72]} />
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
      </group>

      {/* Accent fill light that brightens the deck as the screen wakes */}
      <pointLight position={[0, 0.6, -0.2]} intensity={0.6} distance={4} color={accent.glow} />
    </group>
  );
}
