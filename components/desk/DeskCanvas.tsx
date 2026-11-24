'use client';

import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import DeskModel, { type DeskBindings } from './DeskModel';
import { loadDeskThumbnails } from './screens';
import { DESK_BUDGETS, type DeskQuality } from './quality';
import { loadDeskModel } from './loadModel';
import type { ReportDeskLoad } from './loading';

function ContextGuard({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onFailure);
    return () => canvas.removeEventListener('webglcontextlost', onFailure);
  }, [canvas, onFailure]);
  return null;
}

function Room({ resolution }: { resolution: number }) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    const { gl, scene } = get();
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment, 0.025, 0.1, 100, { size: resolution });
    scene.environment = target.texture;
    scene.environmentIntensity = 0.15;
    environment.dispose();
    generator.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [get, resolution]);
  return null;
}

function RenderBudget({
  active,
  ready,
  quality,
  onSlow,
}: {
  active: boolean;
  ready: boolean;
  quality: DeskQuality;
  onSlow: () => void;
}) {
  const get = useThree((state) => state.get);
  useEffect(() => {
    if (!active) return;
    const interval = 1000 / DESK_BUDGETS[quality].fps;
    let frame = 0;
    let next = 0;
    let previous = performance.now();
    let clock = get().clock.elapsedTime;
    let observed = 0;
    let frames = 0;
    let cpu = 0;
    let slowWindows = 0;
    const step = (time: number) => {
      if (time >= next - 0.55) {
        const elapsed = Math.max(0, time - previous);
        clock += Math.min(elapsed, 50) / 1000;
        const start = performance.now();
        get().advance(clock, false);
        next = next ? Math.max(next + interval, time + interval * 0.5) : time + interval;
        previous = time;
        // Ignore model/shader warmup and isolated long frames. Drop quality
        // after two sustained windows of expensive or infrequent draws.
        if (ready && quality === 'full') {
          observed += elapsed;
          frames++;
          cpu += performance.now() - start;
          if (observed >= 1000) {
            slowWindows = frames / observed < 0.045 || cpu / frames > 13 ? slowWindows + 1 : 0;
            observed = frames = cpu = 0;
            if (slowWindows >= 2) onSlow();
          }
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, ready, get, quality, onSlow]);
  return null;
}

export default function DeskCanvas({
  active,
  ready,
  quality,
  onFailure,
  onSlow,
  reportLoad,
  ...bindings
}: DeskBindings & {
  active: boolean;
  ready: boolean;
  quality: DeskQuality;
  onFailure: () => void;
  onSlow: () => void;
  reportLoad: ReportDeskLoad;
}) {
  const [source, setSource] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadDeskThumbnails();
    loadDeskModel((event) => {
      if (!mounted) return;
      reportLoad({
        phase: 'downloading',
        fraction: event.lengthComputable && event.total ? Math.min(1, event.loaded / event.total) : null,
      });
    }).then(
      ({ scene }) => {
        if (!mounted) return;
        reportLoad({ phase: 'rendering' });
        setSource(scene);
      },
      () => {
        if (mounted) onFailure();
      }
    );
    return () => {
      mounted = false;
    };
  }, [onFailure, reportLoad]);
  if (!source) return null;
  return (
    <Canvas
      aria-hidden="true"
      frameloop="never"
      dpr={[1, DESK_BUDGETS[quality].dpr]}
      camera={{ fov: 38, near: 0.012, far: 48 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        RectAreaLightUniformsLib.init();
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <ContextGuard onFailure={onFailure} />
      <Room resolution={DESK_BUDGETS[quality].environment} />
      <DeskModel source={source} {...bindings} />
      <RenderBudget active={active} ready={ready} quality={quality} onSlow={onSlow} />
    </Canvas>
  );
}
