'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAccent } from '@/lib/palette';
import { drawScreen, loadDeskThumbnails, screenLayout } from './screens';
import { ease, fitTour, HOLDS, measureDisplays, panelTransform, pose, sampleTour } from './beats';

export interface DeskBindings {
  progress: RefObject<number>;
  panels: RefObject<(HTMLDivElement | null)[]>;
  focusFirstProjectRef: RefObject<boolean>;
  indexButton: RefObject<HTMLButtonElement | null>;
  onReady: () => void;
}

function softGlow() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const radius = Math.hypot((2 * x) / (size - 1) - 1, (2 * y) / (size - 1) - 1);
      pixels.set([255, 255, 255, Math.round(255 * (1 - ease(radius)) ** 3)], i);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export default function DeskModel({
  progress,
  panels,
  focusFirstProjectRef,
  indexButton,
  onReady,
  source,
}: DeskBindings & { source: THREE.Group }) {
  const { size, get, gl } = useThree();
  const accent = useAccent();
  const phone = size.width <= 768;
  const prepared = useMemo(() => {
    const scene = source.clone(true);
    const displays = measureDisplays(scene);
    const accentMaterial = new THREE.MeshStandardMaterial();
    // The baked atlas supplies neutral indirect diffuse light and contact.
    // Without that bounce NeutralToneMapping crushes black fabric in shadow.
    const bounce = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    bounce.needsUpdate = true;
    const diffuse = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mat = o.material as THREE.MeshStandardMaterial;
      if (mat.name === 'MAT_Accent_Emissive') {
        accentMaterial.copy(mat);
        o.material = accentMaterial;
      } else if (mat.aoMap || mat.name === 'MAT_Wall') {
        let local = diffuse.get(mat);
        if (!local) {
          local = mat.clone();
          local.lightMap = mat.aoMap ?? bounce;
          const floor = mat.name === 'MAT_Floor',
            wall = mat.name === 'MAT_Wall';
          local.lightMapIntensity = wall ? 11 : floor ? 29 : mat.name.startsWith('MAT_Hand') ? 0.55 : 2.8;
          if (wall) {
            local.onBeforeCompile = (shader) => {
              shader.vertexShader = 'varying float wallHeight;\n' + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                '#include <project_vertex>\nwallHeight = (modelMatrix * vec4(transformed, 1.0)).y;'
              );
              shader.fragmentShader = 'varying float wallHeight;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <lights_fragment_maps>',
                '#include <lights_fragment_maps>\nirradiance *= mix(.28, 1., smoothstep(0., 1.3, wallHeight));'
              );
            };
          }
          local.userData.bounce = local.lightMapIntensity;
          diffuse.set(mat, local);
        }
        o.material = local;
      }
    });
    // The stitched pad edge uses the same emitter with a vertex brightness
    // factor. All four lights still follow one material and palette update.
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.material !== accentMaterial) return;
      const colors = new Float32Array(o.geometry.attributes.position.count * 3);
      colors.fill(o.name === 'GLOW_Pad' ? 0.22 : 1);
      o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    });
    accentMaterial.vertexColors = true;
    accentMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.r;'
      );
    };
    return {
      scene,
      displays,
      accentMaterial,
      diffuse,
      bounce,
      glow: softGlow(),
      wallZ: new THREE.Box3().setFromObject(scene.getObjectByName('Backdrop')!).max.z,
      fan: scene.getObjectByName('FAN_Blades')!,
      shoulders: scene.getObjectByName('Shoulders')!,
      bar: scene.getObjectByName('LIGHTBAR')!.getWorldPosition(new THREE.Vector3()),
    };
  }, [source]);
  const tour = useMemo(
    () => fitTour(prepared.scene, prepared.displays, size.width / size.height, phone),
    [prepared, size, phone]
  );
  const rigRef = useRef({ pose: pose(), corners: Array.from({ length: 4 }, () => new THREE.Vector3()) });
  const fill = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const wallGlow = useRef<THREE.MeshBasicMaterial>(null);
  const lights = useRef<(THREE.RectAreaLight | null)[]>([]);
  const brightness = useRef<number[]>([1, 1, 1]);
  const ready = useRef(false);
  const painted = useRef(false);
  const firstFrame = useRef(0);
  const screenSizes = useRef<ReturnType<typeof screenLayout>[]>([]);
  const lastPanel = useRef(-1);
  const lastSettled = useRef(false);
  const overlayBox = useRef('');
  const modelRef = useRef(prepared);
  useLayoutEffect(() => {
    modelRef.current = prepared;
  }, [prepared]);
  useEffect(() => () => cancelAnimationFrame(firstFrame.current), []);

  useEffect(() => {
    const world = get().scene;
    const m = modelRef.current.accentMaterial;
    m.color.set('#110d0e');
    m.emissive.set(accent.glow).lerp(new THREE.Color(accent.deep), 0.42);
    m.emissiveIntensity = 1.7;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--black').trim();
    world.fog = new THREE.Fog(bg, 5, 18);
    world.background = new THREE.Color(bg);
  }, [accent, prepared, get]);

  useLayoutEffect(() => {
    let active = true;
    const model = modelRef.current;
    const entries = model.displays.map((display, i) => {
      const panel = panels.current[i]!;
      const canvas = document.createElement('canvas');
      drawScreen(canvas, i, phone, accent, null);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, fog: false });
      display.mesh.material = material;

      const layout = screenLayout(i, phone);
      screenSizes.current[i] = layout;
      panel.style.setProperty('width', layout.w + 'px');
      panel.style.setProperty('height', layout.h + 'px');
      panel.querySelectorAll('a').forEach((link, j) => {
        const { x, y, w, h } = layout.cards[j];
        Object.assign(link.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      });
      return { canvas, texture, material };
    });

    // The atlas and typefaces load in parallel. The first visible GPU frame
    // already contains the finished typography and project imagery.
    Promise.all([
      loadDeskThumbnails(),
      document.fonts.load('400 32px "Greater Theory"').catch(() => []),
      document.fonts.load('600 18px "DM Sans"').catch(() => []),
    ]).then(([thumbs]) => {
      if (!active) return;
      entries.forEach(({ canvas, texture }, i) => {
        drawScreen(canvas, i, phone, accent, thumbs);
        texture.needsUpdate = true;
        const meter = document.createElement('canvas');
        meter.width = meter.height = 8;
        const ctx = meter.getContext('2d')!;
        ctx.drawImage(canvas, 0, 0, 8, 8);
        const pixels = ctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (let k = 0; k < pixels.length; k += 4) {
          sum += 0.213 * pixels[k] + 0.715 * pixels[k + 1] + 0.072 * pixels[k + 2];
        }
        brightness.current[i] = sum / (64 * 255);
      });
      painted.current = true;
    });
    return () => {
      active = false;
      entries.forEach(({ material, texture }) => {
        material.dispose();
        texture.dispose();
      });
    };
  }, [prepared, panels, phone, accent, gl]);

  useEffect(() => {
    const ray = new THREE.Raycaster();
    const point = new THREE.Vector2();
    const installations = prepared.displays.map(({ mesh }, index) => {
      const panel = panels.current[index]!;
      let hovered: HTMLAnchorElement | null = null;
      const clear = () => {
        hovered?.removeAttribute('data-hit');
        hovered = null;
      };
      const hitsScreen = (event: MouseEvent) => {
        const { left, top, width, height } = gl.domElement.getBoundingClientRect();
        point.set(((event.clientX - left) / width) * 2 - 1, 1 - ((event.clientY - top) / height) * 2);
        ray.setFromCamera(point, get().camera);
        return ray.intersectObject(prepared.scene, true)[0]?.object === mesh;
      };
      const pick = (event: PointerEvent) => {
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (link === hovered && hovered?.hasAttribute('data-hit') && panel.dataset.settled === 'true') return;
        clear();
        if (link && hitsScreen(event)) {
          hovered = link;
          link.setAttribute('data-hit', '');
        }
      };
      const activate = (event: MouseEvent) => {
        if (event.detail && !hitsScreen(event)) event.preventDefault();
      };
      panel.addEventListener('pointermove', pick);
      panel.addEventListener('pointerleave', clear);
      panel.addEventListener('click', activate);
      panel.addEventListener('auxclick', activate);
      return () => {
        clear();
        panel.removeEventListener('pointermove', pick);
        panel.removeEventListener('pointerleave', clear);
        panel.removeEventListener('click', activate);
        panel.removeEventListener('auxclick', activate);
      };
    });
    return () => installations.forEach((remove) => remove());
  }, [prepared, panels, gl, get]);

  useEffect(
    () => () => {
      prepared.accentMaterial.dispose();
      prepared.diffuse.forEach((m) => m.dispose());
      prepared.bounce.dispose();
      prepared.glow.dispose();
    },
    [prepared]
  );

  useFrame(({ camera, clock, scene: world }, dt) => {
    const model = modelRef.current;
    const rig = rigRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    const p = progress.current;
    const { light, panel, settled } = sampleTour(tour, p, rig.pose);
    const { eye, at, fov, shiftX, shiftY } = rig.pose;
    const idle = 1 - ease((p - 0.08) / 0.03);
    const phase = (clock.elapsedTime * Math.PI) / 6;
    if (idle) {
      const dist = eye.distanceTo(at);
      eye.x += Math.sin(phase) * 0.01047 * dist * idle;
      eye.y += Math.sin(phase * 2) * 0.01047 * dist * idle;
    }
    model.shoulders.scale.y = 1 + 0.006 * Math.sin((clock.elapsedTime * Math.PI) / 2) * idle;
    model.fan.rotation.z += Math.min(dt, 0.1) * 0.8 * Math.PI;
    cam.position.copy(eye);
    cam.lookAt(at);
    cam.fov = fov;
    cam.setViewOffset(
      size.width,
      size.height,
      (-shiftX * size.width) / 2,
      (shiftY * size.height) / 2,
      size.width,
      size.height
    );
    cam.updateMatrixWorld();
    const fog = world.fog as THREE.Fog | null;
    if (fog) {
      const dist = eye.distanceTo(at);
      fog.near = dist * light + 0.4;
      fog.far = dist + 2 + light * 8;
    }
    world.environmentIntensity = 0.25 * light;
    if (fill.current) fill.current.intensity = 0.21 * light;
    if (lamp.current) lamp.current.intensity = 0.28 * light;
    if (wallGlow.current) wallGlow.current.opacity = 0.085 * light;
    model.diffuse.forEach((m) => {
      m.lightMapIntensity = m.userData.bounce * light;
    });
    lights.current.forEach((l, i) => {
      const [start, end] = HOLDS[i];
      const active = ease((p - start + 0.045) / 0.045) * (1 - ease((p - end) / 0.045));
      const exposure = Math.min(1, 0.22 + light * 0.78 + active);
      const material = model.displays[i].mesh.material as THREE.MeshBasicMaterial;
      material.color.setScalar(exposure);
      if (l) l.intensity = (2 + brightness.current[i] * 16) * exposure * light;
    });

    if (lastPanel.current !== panel) {
      if (lastPanel.current >= 0) {
        const prev = panels.current[lastPanel.current]!;
        if (prev.contains(document.activeElement)) indexButton.current?.focus({ preventScroll: true });
        prev.querySelector('[data-hit]')?.removeAttribute('data-hit');
        prev.setAttribute('hidden', '');
        prev.setAttribute('inert', '');
      }
      if (panel >= 0) {
        const next = panels.current[panel]!;
        next.removeAttribute('hidden');
        next.removeAttribute('inert');
      }
      lastPanel.current = panel;
      overlayBox.current = '';
      lastSettled.current = !settled;
    }
    if (panel >= 0) {
      const d = model.displays[panel],
        el = panels.current[panel]!;
      const { w, h } = screenSizes.current[panel];
      [d.tl, d.tr, d.br, d.bl].forEach((corner, i) => rig.corners[i].copy(corner).project(cam));
      const transform = panelTransform(rig.corners, size.width, size.height, w, h);
      if (overlayBox.current !== transform) {
        el.style.setProperty('transform', transform);
        overlayBox.current = transform;
      }
      if (lastSettled.current !== settled) {
        el.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', settled ? '0' : '-1'));
        el.setAttribute('data-settled', String(settled));
        if (!settled && el.contains(document.activeElement))
          indexButton.current?.focus({ preventScroll: true });
        lastSettled.current = settled;
      }
      if (settled && focusFirstProjectRef.current) {
        focusFirstProjectRef.current = false;
        requestAnimationFrame(() => {
          if (!el.hidden && el.dataset.settled === 'true') {
            el.querySelector('a')?.focus({ preventScroll: true });
          }
        });
      }
    }
    if (painted.current && !ready.current) {
      ready.current = true;
      // R3F renders immediately after this callback. Open the letterbox
      // on the next frame, after the desk has been presented.
      firstFrame.current = requestAnimationFrame(onReady);
    }
  });

  return (
    <>
      <primitive object={prepared.scene} dispose={null} />
      {/* Continue the floor beyond the small baked contact-shadow plane. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#08090b" toneMapped={false} />
      </mesh>
      <hemisphereLight ref={fill} args={['#f5f4f2', '#9d9997', 0.21]} />
      <pointLight
        ref={lamp}
        position={[prepared.bar.x, prepared.bar.y - 0.015, prepared.bar.z + 0.014]}
        color={accent.glow}
        distance={1.25}
      />
      {/* A local pool of light replaces the full-screen bloom pass, allowing
          the scene and monitor edges to use the canvas's native MSAA. */}
      <mesh position={[prepared.bar.x, prepared.bar.y + 0.08, prepared.wallZ + 0.008]}>
        <planeGeometry args={[1.25, 0.88]} />
        <meshBasicMaterial
          ref={wallGlow}
          map={prepared.glow}
          color={accent.glow}
          transparent
          opacity={0.085}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {prepared.displays.map((d, i) => (
        <rectAreaLight
          key={d.mesh.name}
          ref={(l) => {
            lights.current[i] = l;
            if (l) l.lookAt(d.centre.clone().add(d.normal));
          }}
          position={d.centre.clone().addScaledVector(d.normal, 0.004)}
          width={d.width}
          height={d.height}
          color="#e8ecf2"
        />
      ))}
    </>
  );
}
