'use client';

import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import DeskModel, { type DeskBindings } from './DeskModel';
import { loadDeskThumbnails } from './screens';

function Room({ onFailure }: { onFailure: () => void }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment, 0.025, 0.1, 100, { size: 128 });
    scene.environment = target.texture;
    scene.environmentIntensity = 0.15;
    environment.dispose();
    generator.dispose();
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onFailure);
    return () => {
      canvas.removeEventListener('webglcontextlost', onFailure);
      scene.environment = null;
      target.dispose();
    };
  }, [get, onFailure]);
  return null;
}

export default function DeskCanvas({
  active,
  phone,
  onFailure,
  ...bindings
}: DeskBindings & {
  active: boolean;
  phone: boolean;
  onFailure: () => void;
}) {
  useEffect(() => {
    void loadDeskThumbnails();
  }, []);
  return (
    <Canvas
      aria-hidden="true"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, phone ? 1.25 : 2]}
      camera={{ fov: 38, near: 0.012, far: 48 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        RectAreaLightUniformsLib.init();
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <Suspense fallback={null}>
        <Room onFailure={onFailure} />
        <DeskModel {...bindings} />
      </Suspense>
    </Canvas>
  );
}
