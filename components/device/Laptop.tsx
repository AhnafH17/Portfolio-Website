'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import ScreenContent from './ScreenContent';
import { makeDeckTexture } from './deckTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const SILVER = '#c7ccd2';   // aluminium body
const P = POSE.laptop;

const HINGE_Z = -1.0;
const BASE_TOP = 0.04; // half of base thickness (0.08)

// Real-HTML screen: design size in px, scaled to (nearly) fill the screen plane.
// drei transform maps px→world by 0.025, so scale = worldWidth / (px * 0.025).
const SCR_PX = { w: 1160, h: 744 };
const SCR_SCALE = 3 / (SCR_PX.w * 0.025);
const SCR_POS: [number, number, number] = [-0.31, 1.0, 0.05]; // x nudged left to centre

// Open-laptop bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 3.35;
const DEVICE_H = 2.3;
const FIT = 0.94;       // leave a small margin around the device
const Y_FACTOR = -0.82; // vertical centring as a fraction of scale

export default function Laptop({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  const frameEl = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);

  const accent = useMemo(() => readAccent(), []);
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
      const target = 0.02 + wake * 0.12;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }

    // Real HTML screen: fade in as it wakes, scroll content during "read".
    if (frameEl.current) frameEl.current.style.opacity = String(wake);
    if (scrollEl.current) {
      const max = Math.max(0, scrollEl.current.scrollHeight - SCR_PX.h);
      scrollEl.current.style.transform = `translateY(${-read * max}px)`;
    }
  });

  return (
    <group ref={root} rotation={[0, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* ── Base: thin + deep (modern laptop), with keyboard deck ── */}
      <RoundedBox args={[3.06, 0.08, 2.0]} radius={0.035} smoothness={4}>
        <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.45} envMapIntensity={0.55} />
      </RoundedBox>
      {/* Keyboard + trackpad deck — matte so the keys read clearly */}
      <mesh position={[0, BASE_TOP + 0.002, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.92, 1.86]} />
        <meshStandardMaterial map={deckTex} metalness={0.15} roughness={0.7} envMapIntensity={0.12} />
      </mesh>

      {/* ── Lid (hinged at back edge) ── */}
      <group ref={lid} position={[0, BASE_TOP, HINGE_Z]} rotation={[P.lidClosed, 0, 0]}>
        <RoundedBox args={[3.06, 2.0, 0.06]} radius={0.04} smoothness={4} position={[0, 1.0, 0]}>
          <meshStandardMaterial color={SILVER} metalness={0.9} roughness={0.45} envMapIntensity={0.55} />
        </RoundedBox>
        {/* Outer-lid logo (the "back" you see at the start) */}
        <mesh position={[0, 1.0, -0.045]}>
          <circleGeometry args={[0.26, 48]} />
          <meshStandardMaterial color={accent.glow} emissive={emissive} emissiveIntensity={0.5} metalness={0.3} roughness={0.4} />
        </mesh>
        {/* Thin black bezel + dark glass screen (the real content is HTML on top) */}
        <mesh position={[0, 1.0, 0.043]}>
          <planeGeometry args={[3.0, 1.95]} />
          <meshStandardMaterial color="#070a0e" metalness={0.4} roughness={0.5} envMapIntensity={0.5} />
        </mesh>
        <mesh position={[0, 1.0, 0.046]}>
          <planeGeometry args={[2.92, 1.87]} />
          <meshStandardMaterial
            ref={screenMat}
            color="#04060a"
            emissive={emissive}
            emissiveIntensity={0.02}
            roughness={0.2}
            metalness={0}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Real HTML content rendered onto the screen */}
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
      </group>

      <pointLight position={[0, 0.6, -0.2]} intensity={0.5} distance={4} color={accent.glow} />
    </group>
  );
}
