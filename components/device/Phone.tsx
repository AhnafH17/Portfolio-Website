'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { roundedSlab } from './roundedSlab';
import * as THREE from 'three';
import { createChromeSurface, createContentSurface, createLiveSurface, REGION, toPlane } from './screenTexture';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

const TITANIUM = '#b8bcc2';   // brushed natural-titanium rail
const BACK = '#14171c';       // matte back glass
const P = POSE.phone;

// Body proportions follow an iPhone 15 Pro (1179x2556 ≈ 0.461 aspect).
const BODY_W = 1.44;
const BODY_H = 3.02;
const BODY_D = 0.17;
const BODY_R = 0.26;

const SCREEN_W = 1.42;
const SCREEN_H = 3.00;

// Phone bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 1.62;
const DEVICE_H = 3.14;
const FIT = 0.98;

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  const accent = useMemo(() => readAccent(), []);
  const chrome = useMemo(() => createChromeSurface('phone'), []);
  const content = useMemo(() => createContentSurface('phone'), []);
  const emissive = useMemo(() => new THREE.Color(accent.glow), [accent]);
  const contentRect = useMemo(() => toPlane('phone', REGION.phone.editor), []);
  const island = useMemo(() => createLiveSurface('phone'), []);
  const islandRect = useMemo(() => toPlane('phone', REGION.phone.terminal), []);

  // Extruded slabs, not RoundedBox — see roundedSlab.ts for why.
  const bodyGeo = useMemo(() => roundedSlab(BODY_W, BODY_H, BODY_D, BODY_R, 0.02), []);
  const backGeo = useMemo(() => roundedSlab(BODY_W - 0.03, BODY_H - 0.03, 0.014, BODY_R - 0.014, 0.004), []);
  const plateauGeo = useMemo(() => roundedSlab(0.66, 0.66, 0.05, 0.17, 0.012), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    if (!root.current) return;
    island.update(state.clock.elapsedTime);

    const spin = easeInOut(phase(p, BEATS.spin));
    const rotY = Math.PI * (1 - spin);

    const open = easeInOut(phase(p, BEATS.open));
    const tiltX = THREE.MathUtils.lerp(0.45, 0, open);

    // Responsive: fit the phone to the visible area (adapts to resize).
    const vp = state.viewport;
    const dockScale = Math.min(vp.width / DEVICE_W, vp.height / DEVICE_H) * FIT;
    const scale = THREE.MathUtils.lerp(dockScale * 0.85, dockScale, open);

    const wake = easeOut(phase(p, BEATS.wakePhone));
    const read = phase(p, BEATS.read);

    const k = 1 - Math.exp(-DAMP * dt);
    root.current.rotation.y += (rotY - root.current.rotation.y) * k;
    root.current.rotation.x += (tiltX - root.current.rotation.x) * k;
    const s = root.current.scale.x + (scale - root.current.scale.x) * k;
    root.current.scale.setScalar(s);

    if (screenMat.current) {
      const target = 0.15 + wake * 1.0;
      screenMat.current.emissiveIntensity += (target - screenMat.current.emissiveIntensity) * k;
    }

    content.render(read);
  });

  const panel = {
    emissive: '#ffffff' as const,
    toneMapped: false as const,
    roughness: 0.22,
    metalness: 0,
  };

  const railY = BODY_H / 2;

  return (
    <group ref={root} rotation={[0.45, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      {/* Titanium rail — the flat band around the edge */}
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.32} envMapIntensity={0.8} />
      </mesh>
      {/* Front and back glass sit FLUSH inside the rail. Earlier they were
          pushed past the body faces with a tighter corner radius, so edge-on
          during the spin their silhouettes separated from the body and the
          phone read as two overlapping slabs. */}
      <mesh geometry={backGeo} position={[0, 0, -BODY_D / 2 + 0.007]}>
        {/* Deliberately matte: the scene's accent rim light sits behind the
            device, and a glossy back caught so much of it that the phone read
            as solid accent while it turned. */}
        <meshStandardMaterial color={BACK} metalness={0.25} roughness={0.8} envMapIntensity={0.3} />
      </mesh>
      {/* No separate front glass: it sat at the same depth as the body's front
          face and z-fought with it, striping the edges. The screen plane now
          spans the whole face and paints its own bezel and rounded corners. */}

      {/* Display: chrome plane (status bar, Dynamic Island, home indicator)
          with the scrolling content on top. The island is painted into the
          chrome texture rather than being geometry — that is where it actually
          sits, and it avoids a camera dot floating over the content. */}
      <mesh position={[0, 0, BODY_D / 2 + 0.001]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshStandardMaterial
          ref={screenMat}
          map={chrome.texture}
          emissiveMap={chrome.texture}
          emissiveIntensity={0.15}
          {...panel}
        />
      </mesh>
      <mesh position={[contentRect.x, contentRect.y, BODY_D / 2 + 0.0022]}>
        <planeGeometry args={[contentRect.w, contentRect.h]} />
        <meshStandardMaterial
          map={content.texture}
          emissiveMap={content.texture}
          emissiveIntensity={0.95}
          {...panel}
        />
      </mesh>
      <mesh position={[islandRect.x, islandRect.y, BODY_D / 2 + 0.0028]}>
        <planeGeometry args={[islandRect.w, islandRect.h]} />
        <meshStandardMaterial
          map={island.texture}
          emissiveMap={island.texture}
          emissiveIntensity={0.95}
          {...panel}
        />
      </mesh>

      {/* Side buttons — action + volume on the left, power on the right */}
      <RoundedBox args={[0.022, 0.16, 0.055]} radius={0.009} smoothness={3} position={[-BODY_W / 2 - 0.002, railY - 0.62, 0]}>
        <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.022, 0.26, 0.055]} radius={0.009} smoothness={3} position={[-BODY_W / 2 - 0.002, railY - 1.0, 0]}>
        <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.022, 0.26, 0.055]} radius={0.009} smoothness={3} position={[-BODY_W / 2 - 0.002, railY - 1.34, 0]}>
        <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.022, 0.34, 0.055]} radius={0.009} smoothness={3} position={[BODY_W / 2 + 0.002, railY - 1.02, 0]}>
        <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.3} />
      </RoundedBox>

      {/* Rear camera plateau — the back you see before it turns around */}
      <mesh geometry={plateauGeo} position={[-0.32, 0.98, -BODY_D / 2 - 0.028]}>
        <meshStandardMaterial color="#22262d" metalness={0.7} roughness={0.4} envMapIntensity={0.6} />
      </mesh>
      {([[-0.47, 1.13], [-0.17, 1.13], [-0.32, 0.83]] as const).map(([x, y], i) => (
        <group key={i} position={[x, y, -BODY_D / 2 - 0.058]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[0.115, 28]} />
            <meshStandardMaterial color={TITANIUM} metalness={0.95} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, -0.006]} rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[0.082, 28]} />
            <meshStandardMaterial color="#04060a" metalness={0.9} roughness={0.12} />
          </mesh>
        </group>
      ))}

      {/* Kept low: at full strength the accent washed the titanium rail and it
          stopped reading as metal. */}
      <pointLight position={[0, 0, 0.9]} intensity={0.22} distance={3} color={emissive} />
    </group>
  );
}
