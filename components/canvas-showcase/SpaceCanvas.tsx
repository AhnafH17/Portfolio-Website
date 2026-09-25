'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Stars() {
  const pointsRef = useRef<THREE.Points>(null);
  const starCount = 2000;

  const [positions, colors] = useMemo(() => {
    // Seeded, so the starfield is identical on every render (render must be pure).
    let seed = 0x5a17c3;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const colorOptions = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#ffcc99'),
      new THREE.Color('#99ccff'),
      new THREE.Color('#ff9999'),
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 30 + rand() * 80;
      const theta = 2 * Math.PI * rand();
      const phi = Math.acos(2 * rand() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const color = colorOptions[Math.floor(rand() * colorOptions.length)];
      const mixRatio = rand() * 0.5;
      const finalColor = color.clone().lerp(new THREE.Color('#ffffff'), mixRatio);
      col[i * 3] = finalColor.r;
      col[i * 3 + 1] = finalColor.g;
      col[i * 3 + 2] = finalColor.b;
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.03;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function SpaceCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Stop rendering once the section has scrolled away — otherwise this
  // canvas keeps drawing every frame alongside the laptop's WebGL below.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      >
        <Stars />
      </Canvas>
    </div>
  );
}
