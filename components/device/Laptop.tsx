'use client';

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import { makeScreenTexture } from './screenTexture';
import ScreenContent from './ScreenContent';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';   // aluminium body
const SILVER_DK = '#9aa1a9'; // shaded aluminium
const DECK = '#1a1d22';     // keyboard deck
const P = POSE.laptop;

// HTML screen is 1112×688 px mapped onto the 2.78×1.72 screen plane.
const HTML_PX = { w: 1112, h: 688 };
const HTML_SCALE = 2.78 / HTML_PX.w;

export default function Laptop({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const { pointer } = useThree();

  const accent = useMemo(() => readAccent(), []);
  const tex = useMemo(() => makeScreenTexture('laptop'), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current || !lid.current) return;

    // Beat A — spin 180°: π (back) → 0 (front)
    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    // Beat B — lid opens + rig settles into docked pose (then HOLDS)
    const open = easeInOut(phase(p, BEATS.open));
    const lidAngle = THREE.MathUtils.lerp(P.lidClosed, P.lidOpen, open);
    const tiltX = THREE.MathUtils.lerp(0, P.dockTilt, open);
    const scale = THREE.MathUtils.lerp(P.introScale, P.dockScale, open);

    // Beat C — screen wakes (texture brightens, then HTML content fades in)
    const wake = easeOut(phase(p, BEATS.wake));

    // Beat D — read: content scrolls INSIDE the screen. Device does not move.
    const read = phase(p, BEATS.read);

    // Cursor parallax, only once it's facing us
    const parX = pointer.x * 0.1 * open;
    const parY = pointer.y * 0.05 * open;

    const k = 1 - Math.exp(-DAMP * dt);
    root.current.rotation.y += (rotY + parX - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - parY - root.current.rotation.x) * k;
    root.current.position.y += (P.posY - root.current.position.y) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);
    lid.current.rotation.x += (lidAngle - lid.current.rotation.x) * k;

    if (screenMat.current) {
      const target = 0.12 + wake * 1.15;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }

    // Fade the real HTML screen in as it wakes; slide content during "read"
    if (frameEl.current) frameEl.current.style.opacity = String(wake);
    if (scrollEl.current) {
      const max = Math.max(0, scrollEl.current.scrollHeight - HTML_PX.h);
      scrollEl.current.style.transform = `translateY(${-read * max}px)`;
    }
  });

  return (
    <group ref={root} rotation={[0, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* ── Base / keyboard deck ── */}
      <RoundedBox args={[3, 0.13, 2.05]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color={SILVER} metalness={0.92} roughness={0.34} />
      </RoundedBox>
      <mesh position={[0, 0.071, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.7, 1.5]} />
        <meshStandardMaterial color={DECK} metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.072, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.95, 0.6]} />
        <meshStandardMaterial color={SILVER_DK} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* ── Lid (hinged at back edge, z = -1.0) ── */}
      <group ref={lid} position={[0, 0.065, -1.0]} rotation={[P.lidClosed, 0, 0]}>
        <RoundedBox args={[3, 1.9, 0.08]} radius={0.05} smoothness={4} position={[0, 0.95, 0]}>
          <meshStandardMaterial color={SILVER} metalness={0.92} roughness={0.32} />
        </RoundedBox>
        {/* Outer-lid logo (the "back" you see at the start) */}
        <mesh position={[0, 0.95, -0.045]}>
          <circleGeometry args={[0.26, 48]} />
          <meshStandardMaterial color={accent.glow} emissive={emissive} emissiveIntensity={0.5} metalness={0.3} roughness={0.4} />
        </mesh>
        {/* Boot/glow texture behind the HTML */}
        <mesh position={[0, 0.95, 0.045]}>
          <planeGeometry args={[2.78, 1.72]} />
          <meshStandardMaterial
            ref={screenMat}
            map={tex}
            emissiveMap={tex}
            emissive={'#ffffff'}
            emissiveIntensity={0.12}
            toneMapped={false}
            roughness={0.25}
            metalness={0}
          />
        </mesh>
        {/* Real, scrollable About-Me content sitting on the display */}
        <Html
          transform
          center
          position={[0, 0.95, 0.05]}
          scale={HTML_SCALE}
          zIndexRange={[10, 0]}
          pointerEvents="none"
        >
          <ScreenContent frameRef={frameEl} scrollerRef={scrollEl} width={HTML_PX.w} height={HTML_PX.h} />
        </Html>
      </group>

      <pointLight position={[0, 0.6, -0.2]} intensity={0.5} distance={4} color={accent.glow} />
    </group>
  );
}
