'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createChromeSurface, createContentSurface, createLiveSurface, REGION, toPlane } from './screenTexture';
import { makeScreenMaterial, prepareModel, SCREEN_PANEL } from './deviceModel';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

/* The phone is a Blender model (scripts/build-phone.py →
   public/models/phone.glb); this file animates it and paints its screen.
   Contract it relies on: origin at the body's centre, front facing +Z, and a
   `SCREEN` mesh 1.42 x 3.00 on the front face (z = +0.086) whose UVs span its
   bounding rectangle. The status bar, Dynamic Island and rounded corners are
   painted into the screen texture, not modelled. */

const MODEL_URL = '/models/phone.glb';
const P = POSE.phone;

const SCREEN_Z = 0.086; // the model's screen surface

// Phone bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 1.62;
const DEVICE_H = 3.14;
const FIT = 0.98;

export default function Phone({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  const accent = useMemo(() => readAccent(), []);
  const chrome = useMemo(() => createChromeSurface('phone'), []);
  const content = useMemo(() => createContentSurface('phone'), []);
  const contentRect = useMemo(() => toPlane('phone', REGION.phone.editor), []);
  const island = useMemo(() => createLiveSurface('phone'), []);
  const islandRect = useMemo(() => toPlane('phone', REGION.phone.terminal), []);

  // three objects are mutated every frame, so they live in a ref set up once
  // the model is in.
  const rig = useRef<{ screen: THREE.MeshStandardMaterial } | null>(null);
  useEffect(() => {
    const screen = makeScreenMaterial(chrome.texture);
    prepareModel(scene, {
      screen,
      accent: new THREE.Color(accent.glow),
      // Satin titanium, matte back (a glossy back caught the accent rim light
      // behind the phone and read as solid colour while it turned).
      envIntensity: { MAT_Titanium: 0.8, MAT_BackGlass: 0.3, MAT_CameraPlate: 0.6, MAT_LensGlass: 1, MAT_Bezel: 0.5 },
    });
    rig.current = { screen };
    return () => { rig.current = null; screen.dispose(); };
  }, [scene, chrome, accent]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    const r = rig.current;
    if (!root.current || !r) return;
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

    const target = 0.15 + wake * 1.0;
    r.screen.emissiveIntensity += (target - r.screen.emissiveIntensity) * k;

    content.render(read);
  });

  return (
    <group ref={root} rotation={[0.45, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      <primitive object={scene} />
      {/* The scrolling content and the live Dynamic Island sit just in front
          of the model's screen, whose own texture is the chrome around them. */}
      <mesh position={[contentRect.x, contentRect.y, SCREEN_Z + 0.0012]}>
        <planeGeometry args={[contentRect.w, contentRect.h]} />
        <meshStandardMaterial map={content.texture} emissiveMap={content.texture} emissiveIntensity={0.95} {...SCREEN_PANEL} />
      </mesh>
      <mesh position={[islandRect.x, islandRect.y, SCREEN_Z + 0.0018]}>
        <planeGeometry args={[islandRect.w, islandRect.h]} />
        <meshStandardMaterial map={island.texture} emissiveMap={island.texture} emissiveIntensity={0.95} {...SCREEN_PANEL} />
      </mesh>

      {/* Kept low: at full strength the accent washed the titanium rail and it
          stopped reading as metal. */}
      <pointLight position={[0, 0, 0.9]} intensity={0.22} distance={3} color={accent.glow} />
    </group>
  );
}
