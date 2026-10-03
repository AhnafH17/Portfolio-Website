'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, createPortal } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  createChromeSurface, createContentSurface, createLiveSurface,
  REGION, toPlane,
} from './screenTexture';
import { makeScreenMaterial, prepareModel, SCREEN_PANEL } from './deviceModel';
import { readAccent } from '@/lib/accent';
import { BEATS, POSE, phase, easeInOut, easeOut, DAMP } from './beats';

/* The laptop is a Blender model (scripts/build-laptop.py →
   public/models/laptop.glb); this file animates it and paints its screen.
   Contract it relies on: `LID` has its origin on the hinge and rests standing
   straight up (+X rotation closes it onto the keys); `SCREEN` is a 2.92 x 1.87
   plane on the lid, 1.0 above the hinge; `SHADOW` is a ground plane for the
   baked contact shadow (public/models/laptop-shadow.png). */

const MODEL_URL = '/models/laptop.glb';
const SHADOW_URL = '/models/laptop-shadow.png';
const P = POSE.laptop;

// The screen's centre and front face, in the lid's own space.
const SCREEN_Y = 1.0;
const SCREEN_Z = -0.006;

// Open-laptop bounding size (local units, scale 1) used to fit the viewport.
const DEVICE_W = 3.35;
const DEVICE_H = 2.3;
const FIT = 0.94;       // leave a small margin around the device
const Y_FACTOR = -0.82; // vertical centring as a fraction of scale

export default function Laptop({ progress }: { progress: { current: number } }) {
  const root = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);
  const shadowTex = useTexture(SHADOW_URL);

  const accent = useMemo(() => readAccent(), []);
  const chrome = useMemo(() => createChromeSurface('laptop'), []);
  const content = useMemo(() => createContentSurface('laptop'), []);
  const live = useMemo(() => createLiveSurface(), []);
  // Only for the portal target below; the animation reaches the lid through
  // `rig`, set up once the model is in (three objects are mutated per frame).
  const lidNode = useMemo(() => scene.getObjectByName('LID') ?? null, [scene]);
  const rig = useRef<{ lid: THREE.Object3D; screen: THREE.MeshStandardMaterial } | null>(null);

  useEffect(() => {
    const lid = scene.getObjectByName('LID');
    if (!lid) return;
    const screen = makeScreenMaterial(chrome.texture);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
    prepareModel(scene, {
      screen,
      accent: new THREE.Color(accent.glow),
      // Matte keys and deck, satin metal (the old values for this look).
      envIntensity: { MAT_Aluminium: 0.55, MAT_Keys: 0.12, MAT_Dark: 0.4, MAT_Bezel: 0.5, MAT_Rubber: 0.1 },
    });
    const shadow = scene.getObjectByName('SHADOW') as THREE.Mesh | undefined;
    if (shadow) { shadow.material = shadowMat; shadow.renderOrder = -1; }
    // The model rests open; the intro starts closed.
    lid.rotation.x = P.lidClosed;
    rig.current = { lid, screen };
    return () => { rig.current = null; screen.dispose(); shadowMat.dispose(); };
  }, [scene, chrome, shadowTex, accent]);

  // Where the editor and terminal sit on the screen, derived from the same
  // canvas rects the chrome is drawn against — so they line up exactly.
  const editorRect = useMemo(() => toPlane('laptop', REGION.laptop.editor), []);
  const termRect = useMemo(() => toPlane('laptop', REGION.laptop.terminal), []);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const p = progress.current;
    const r = rig.current;
    if (!root.current || !r) return;
    live.update(state.clock.elapsedTime);

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
    r.lid.rotation.x += (lidAngle - r.lid.rotation.x) * k;

    const target = 0.15 + wake * 1.0;
    r.screen.emissiveIntensity += (target - r.screen.emissiveIntensity) * k;

    // Scroll the editor via texture offset (no redraw, no re-upload).
    content.render(read);
  });

  return (
    <group ref={root} rotation={[0, Math.PI, 0]} position={[0, P.posY, 0]} scale={P.introScale}>
      <primitive object={scene} />
      {/* The scrolling editor and the live terminal sit just in front of the
          model's screen, inside the lid so they open with it. The IDE chrome
          (title bar, sidebar, status bar) is the screen mesh's own texture. */}
      {lidNode && createPortal(
        <>
          <mesh position={[editorRect.x, SCREEN_Y + editorRect.y, SCREEN_Z + 0.0015]}>
            <planeGeometry args={[editorRect.w, editorRect.h]} />
            <meshStandardMaterial map={content.texture} emissiveMap={content.texture} emissiveIntensity={0.95} {...SCREEN_PANEL} />
          </mesh>
          <mesh position={[termRect.x, SCREEN_Y + termRect.y, SCREEN_Z + 0.0015]}>
            <planeGeometry args={[termRect.w, termRect.h]} />
            <meshStandardMaterial map={live.texture} emissiveMap={live.texture} emissiveIntensity={0.95} {...SCREEN_PANEL} />
          </mesh>
        </>,
        lidNode,
      )}
      <pointLight position={[0, 0.6, -0.2]} intensity={0.5} distance={4} color={accent.glow} />
    </group>
  );
}

