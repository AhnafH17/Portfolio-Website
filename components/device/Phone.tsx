'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import ScreenContent from './ScreenContent';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';
const P = POSE.phone;

// Portrait screen 1.36×2.9 world units.
const HTML_PX = { w: 544, h: 1160 };
const HTML_SCALE = 1.36 / HTML_PX.w;

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const { pointer } = useThree();

  const accent = useMemo(() => readAccent(), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((_, dtRaw) => {
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

    const parX = pointer.x * 0.14 * open;
    const parY = pointer.y * 0.08 * open;

    const k = 1 - Math.exp(-DAMP * dt);
    root.current.rotation.y += (rotY + parX - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - parY - root.current.rotation.x) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);

    if (frameEl.current) frameEl.current.style.opacity = String(wake);
    if (scrollEl.current) {
      const max = Math.max(0, scrollEl.current.scrollHeight - HTML_PX.h);
      scrollEl.current.style.transform = `translateY(${-read * max}px)`;
    }
  });

  return (
    <group ref={root} rotation={[0.45, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      <RoundedBox args={[1.5, 3.05, 0.16]} radius={0.16} smoothness={5}>
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.32} />
      </RoundedBox>

      {/* Rear camera bump (the "back" at the start) */}
      <RoundedBox args={[0.62, 0.62, 0.07]} radius={0.1} smoothness={4} position={[-0.38, 1.05, -0.1]}>
        <meshStandardMaterial color="#15181d" metalness={0.7} roughness={0.4} />
      </RoundedBox>
      <mesh position={[-0.52, 1.18, -0.14]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.24, 0.92, -0.14]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Real, scrollable content on the front display */}
      <Html
        transform
        center
        position={[0, 0, 0.082]}
        scale={HTML_SCALE}
        zIndexRange={[10, 0]}
        pointerEvents="none"
      >
        <ScreenContent frameRef={frameEl} scrollerRef={scrollEl} width={HTML_PX.w} height={HTML_PX.h} />
      </Html>

      <pointLight position={[0, 0, 0.6]} intensity={0.5} distance={3} color={emissive} />
    </group>
  );
}
