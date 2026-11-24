'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import DeskModel, { type DeskBindings } from './DeskModel';

function Room({ onFailure }: { onFailure: () => void }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment, 0.025);
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

function Bloom() {
  const { gl, scene, camera, size } = useThree();
  const stack = useRef<EffectComposer | null>(null);
  useEffect(() => {
    const composer = new EffectComposer(gl);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.18, 0.94);
    const output = new OutputPass();
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(output);
    stack.current = composer;
    return () => {
      stack.current = null;
      bloom.dispose();
      output.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera]);
  useEffect(() => {
    stack.current?.setPixelRatio(gl.getPixelRatio());
    stack.current?.setSize(size.width, size.height);
  }, [size, gl]);
  useFrame(() => {
    stack.current?.render();
  }, 1);
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
  return (
    <Canvas
      aria-hidden="true"
      frameloop={active ? 'always' : 'never'}
      dpr={[1, phone ? 1.25 : 1.75]}
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
        {!phone && <Bloom />}
      </Suspense>
    </Canvas>
  );
}
