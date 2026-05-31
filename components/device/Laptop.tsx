'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { createScreenSurface } from './screenTexture';
import { makeDeckTexture } from './deckTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';   // aluminium body
const P = POSE.laptop;

const HINGE_Z = -0.95;
const BASE_TOP = 0.04; // half of base thickness (0.08)

// Open-laptop bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 3.35;
const DEVICE_H = 2.3;
const FIT = 0.94;       // leave a small margin around the device
const Y_FACTOR = -0.82; // vertical centring as a fraction of scale

export default function Laptop({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  const accent = useMemo(() => readAccent(), []);
  const surface = useMemo(() => createScreenSurface('laptop'), []);
  const deckTex = useMemo(() => makeDeckTexture(), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current || !lid.current) return;

    // Beat A — spin 180°: π (back) → 0 (front). Ends dead-on, facing forward.
    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    // Beat B — lid opens + rig settles into docked pose (then HOLDS)
    const open = easeInOut(phase(p, BEATS.open));
    const lidAngle = THREE.MathUtils.lerp(P.lidClosed, P.lidOpen, open);
    const tiltX = THREE.MathUtils.lerp(0, P.dockTilt, open);

    // Responsive: fit the device to the actual visible area (adapts to resize).
    const vp = state.viewport;
    const dockScale = Math.min(vp.width / DEVICE_W, vp.height / DEVICE_H) * FIT;
    const scale = THREE.MathUtils.lerp(dockScale * 0.82, dockScale, open);
    const targetPosY = scale * Y_FACTOR;

    // Beat C — screen wakes
    const wake = easeOut(phase(p, BEATS.wake));

    // Beat D — read: content scrolls INSIDE the screen. Device does not move.
    const read = phase(p, BEATS.read);

    const k = 1 - Math.exp(-DAMP * dt);
    // No cursor parallax — the laptop stays constant, facing forward.
    root.current.rotation.y += (rotY - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - root.current.rotation.x) * k;
    root.current.position.y += (targetPosY - root.current.position.y) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);
    lid.current.rotation.x += (lidAngle - lid.current.rotation.x) * k;

    if (screenMat.current) {
      const target = 0.12 + wake * 1.15;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }

    // Scroll the About-Me content inside the screen during the "read" beat
    surface.render(read, state.clock.elapsedTime);
  });

  return (
    <group ref={root} rotation={[0, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* ── Base: thin + deep (modern laptop), with keyboard deck ── */}
      <RoundedBox args={[3, 0.08, 1.9]} radius={0.035} smoothness={6}>
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.45} envMapIntensity={0.55} />
      </RoundedBox>
      {/* Keyboard + trackpad deck — matte so the keys read clearly */}
      <mesh position={[0, BASE_TOP + 0.002, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.86, 1.74]} />
        <meshStandardMaterial map={deckTex} metalness={0.15} roughness={0.7} envMapIntensity={0.12} />
      </mesh>

      {/* ── Lid (hinged at back edge) ── */}
      <group ref={lid} position={[0, BASE_TOP, HINGE_Z]} rotation={[P.lidClosed, 0, 0]}>
        <RoundedBox args={[3.05, 2.0, 0.06]} radius={0.04} smoothness={6} position={[0, 1.0, 0]}>
          <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.45} envMapIntensity={0.55} />
        </RoundedBox>
        {/* Outer-lid logo (the "back" you see at the start) */}
        <mesh position={[0, 1.0, -0.045]}>
          <circleGeometry args={[0.26, 48]} />
          <meshStandardMaterial color={accent.glow} emissive={emissive} emissiveIntensity={0.5} metalness={0.3} roughness={0.4} />
        </mesh>
        {/* Thin black bezel */}
        <mesh position={[0, 1.0, 0.043]}>
          <planeGeometry args={[3.0, 1.95]} />
          <meshStandardMaterial color="#070a0e" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
        </mesh>
        {/* Screen — display content (near edge-to-edge) */}
        <mesh position={[0, 1.0, 0.046]}>
          <planeGeometry args={[2.92, 1.87]} />
          <meshStandardMaterial
            ref={screenMat}
            map={surface.texture}
            emissiveMap={surface.texture}
            emissive={'#ffffff'}
            emissiveIntensity={0.12}
            toneMapped={false}
            roughness={0.3}
            metalness={0}
          />
        </mesh>
        {/* Glass sheen overlay (reflects the studio environment) */}
        <mesh position={[0, 1.0, 0.05]}>
          <planeGeometry args={[3.0, 1.95]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.06}
            roughness={0.08}
            metalness={0}
            envMapIntensity={2.2}
            depthWrite={false}
          />
        </mesh>
      </group>

      <pointLight position={[0, 0.6, -0.2]} intensity={0.5} distance={4} color={accent.glow} />
    </group>
  );
}
