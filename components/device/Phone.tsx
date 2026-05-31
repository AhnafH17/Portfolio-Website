'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import ScreenContent from './ScreenContent';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';
const P = POSE.phone;

// Phone bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 1.62;
const DEVICE_H = 3.25;
const FIT = 0.92;

// Real-HTML screen (portrait), nearly filling the 1.36-wide screen plane.
const SCR_PX = { w: 600, h: 1270 };
const SCR_SCALE = 1.36 / (SCR_PX.w * 0.025);
const SCR_POS: [number, number, number] = [0.0, 0, 0.088]; // x nudged left to centre

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);

  const accent = useMemo(() => readAccent(), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current) return;

    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    const open = easeInOut(phase(p, BEATS.open));
    const tiltX = THREE.MathUtils.lerp(0.45, 0, open);

    // Responsive: fit the phone to the visible area (adapts to resize).
    const vp = state.viewport;
    const dockScale = Math.min(vp.width / DEVICE_W, vp.height / DEVICE_H) * FIT;
    const scale = THREE.MathUtils.lerp(dockScale * 0.85, dockScale, open);

    const wake = easeOut(phase(p, BEATS.wake));
    const read = phase(p, BEATS.read);

    const k = 1 - Math.exp(-DAMP * dt);
    // No cursor parallax — phone stays constant, facing forward.
    root.current.rotation.y += (rotY - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - root.current.rotation.x) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);

    if (screenMat.current) {
      const target = 0.02 + wake * 0.12;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }

    if (frameEl.current) frameEl.current.style.opacity = String(wake);
    if (scrollEl.current) {
      const max = Math.max(0, scrollEl.current.scrollHeight - SCR_PX.h);
      scrollEl.current.style.transform = `translateY(${-read * max}px)`;
    }
  });

  return (
    <group ref={root} rotation={[0.45, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* Silver body slab — this is the BACK + sides */}
      <RoundedBox args={[1.5, 3.05, 0.16]} radius={0.18} smoothness={6}>
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.45} envMapIntensity={0.55} />
      </RoundedBox>

      {/* Black bezel on the FRONT */}
      <mesh position={[0, 0, 0.081]}>
        <planeGeometry args={[1.46, 3.0]} />
        <meshStandardMaterial color="#070a0e" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
      </mesh>
      {/* Dark glass screen (real content is HTML on top) */}
      <mesh position={[0, 0, 0.083]}>
        <planeGeometry args={[1.36, 2.88]} />
        <meshStandardMaterial
          ref={screenMat}
          color="#04060a"
          emissive={emissive}
          emissiveIntensity={0.02}
          metalness={0}
          roughness={0.2}
          envMapIntensity={1.2}
        />
      </mesh>
      {/* Punch-hole front camera */}
      <mesh position={[0, 1.32, 0.085]}>
        <circleGeometry args={[0.05, 24]} />
        <meshStandardMaterial color="#02040a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Real HTML content on the display */}
      <Html
        transform
        center
        position={SCR_POS}
        scale={SCR_SCALE}
        pointerEvents="none"
        zIndexRange={[20, 0]}
      >
        <ScreenContent frameRef={frameEl} scrollerRef={scrollEl} width={SCR_PX.w} height={SCR_PX.h} />
      </Html>

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
