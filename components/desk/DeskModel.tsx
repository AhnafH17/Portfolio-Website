'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useAccent } from '@/lib/palette';
import { drawOverview, drawScreen, screenImages, screenLayout } from './screens';
import { ease, fitTour, HOLDS, measureDisplays, pose, sampleTour } from './beats';

export interface DeskBindings {
  progress: RefObject<number>;
  panels: RefObject<(HTMLDivElement | null)[]>;
  onReady: () => void;
}

interface ScreenArtwork {
  canvas: HTMLCanvasElement;
  overview: HTMLCanvasElement;
  blend: HTMLCanvasElement;
  detailMap: THREE.CanvasTexture;
  overviewMap: THREE.CanvasTexture;
  blendMap: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  step: number;
}

function showArtwork(art: ScreenArtwork, detail: number) {
  const step = Math.round(detail * 12);
  if (step === art.step) return;
  art.step = step;
  if (step === 0 || step === 12) {
    art.material.map = step === 0 ? art.overviewMap : art.detailMap;
    return;
  }
  const { blend, overview, canvas } = art;
  const ctx = blend.getContext('2d')!;
  ctx.globalAlpha = 1;
  ctx.drawImage(overview, 0, 0, blend.width, blend.height);
  ctx.globalAlpha = step / 12;
  ctx.drawImage(canvas, 0, 0, blend.width, blend.height);
  art.blendMap.needsUpdate = true;
  art.material.map = art.blendMap;
}

export default function DeskModel({ progress, panels, onReady }: DeskBindings) {
  const { scene: source } = useGLTF('/models/desk-hero.glb');
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
          local.lightMapIntensity = wall ? 10 : floor ? 24 : mat.name.startsWith('MAT_Hand') ? 0.45 : 2.2;
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
      fan: scene.getObjectByName('FAN_Blades')!,
      shoulders: scene.getObjectByName('Shoulders')!,
      bar: scene.getObjectByName('LIGHTBAR')!.getWorldPosition(new THREE.Vector3()),
    };
  }, [source]);
  const tour = useMemo(
    () => fitTour(prepared.scene, prepared.displays, size.width / size.height, phone),
    [prepared, size, phone]
  );
  const rigRef = useRef({ pose: pose(), tl: new THREE.Vector3(), br: new THREE.Vector3() });
  const fill = useRef<THREE.HemisphereLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const lights = useRef<(THREE.RectAreaLight | null)[]>([]);
  const brightness = useRef<number[]>([1, 1, 1]);
  const ready = useRef(false);
  const painted = useRef(false);
  const artwork = useRef<ScreenArtwork[]>([]);
  const lastPanel = useRef(-1);
  const overlayBox = useRef('');
  const modelRef = useRef(prepared);
  useLayoutEffect(() => {
    modelRef.current = prepared;
  }, [prepared]);

  useEffect(() => {
    const world = get().scene;
    const m = modelRef.current.accentMaterial;
    m.color.set('#110d0e');
    m.emissive.set(accent.glow).lerp(new THREE.Color(accent.deep), 0.42);
    m.emissiveIntensity = 2.4;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--black').trim();
    world.fog = new THREE.Fog(bg, 5, 18);
    world.background = new THREE.Color(bg);
  }, [accent, prepared, get]);

  useLayoutEffect(() => {
    let active = true;
    const makeTexture = (canvas: HTMLCanvasElement) => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      return texture;
    };
    const entries = modelRef.current.displays.map((d, i) => {
      const panel = panels.current[i]!;
      const canvas = panel.querySelector('canvas')!;
      const overview = document.createElement('canvas');
      const blend = document.createElement('canvas');
      // Establish the backing-store sizes before WebGL allocates the textures.
      drawScreen(canvas, i, phone, accent, {});
      drawOverview(overview, i, accent, {});
      blend.width = overview.width;
      blend.height = overview.height;
      const overviewMap = makeTexture(overview);
      const material = new THREE.MeshBasicMaterial({ map: overviewMap, toneMapped: false, fog: false });
      d.mesh.material = material;
      const layout = screenLayout(i, phone);
      panel.querySelectorAll('a').forEach((link, j) => {
        const { x, y, w, h } = layout.cards[j];
        Object.assign(link.style, {
          left: (x / layout.w) * 100 + '%',
          top: (y / layout.h) * 100 + '%',
          width: (w / layout.w) * 100 + '%',
          height: (h / layout.h) * 100 + '%',
        });
      });
      return {
        canvas,
        overview,
        blend,
        detailMap: makeTexture(canvas),
        overviewMap,
        blendMap: makeTexture(blend),
        material,
        step: -1,
      };
    });
    artwork.current = entries;
    const paint = (images: Awaited<ReturnType<typeof screenImages>>) => {
      if (!active) return;
      entries.forEach((art, i) => {
        drawScreen(art.canvas, i, phone, accent, images);
        drawOverview(art.overview, i, accent, images);
        art.detailMap.needsUpdate = true;
        art.overviewMap.needsUpdate = true;
        art.step = -1;
        // Sample the actual artwork to set the display's area-light output.
        const meter = document.createElement('canvas');
        meter.width = meter.height = 8;
        const ctx = meter.getContext('2d')!;
        ctx.drawImage(art.canvas, 0, 0, 8, 8);
        const pixels = ctx.getImageData(0, 0, 8, 8).data;
        let sum = 0;
        for (let k = 0; k < pixels.length; k += 4)
          sum += 0.213 * pixels[k] + 0.715 * pixels[k + 1] + 0.072 * pixels[k + 2];
        brightness.current[i] = sum / (64 * 255);
      });
      painted.current = true;
    };
    const full = screenImages(false);
    screenImages(true).then(async (previews) => {
      paint(previews);
      await document.fonts.ready;
      const loaded = await full;
      paint({ ...previews, ...loaded });
    });
    return () => {
      active = false;
      entries.forEach(({ material, detailMap, overviewMap, blendMap }) => {
        material.dispose();
        detailMap.dispose();
        overviewMap.dispose();
        blendMap.dispose();
      });
    };
  }, [prepared, panels, phone, accent, gl]);

  useEffect(
    () => () => {
      prepared.accentMaterial.dispose();
      prepared.diffuse.forEach((m) => m.dispose());
      prepared.bounce.dispose();
    },
    [prepared]
  );

  useFrame(({ camera, clock, scene: world }, dt) => {
    const model = modelRef.current;
    const rig = rigRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    const p = progress.current;
    const { light, panel, opacity } = sampleTour(tour, p, rig.pose);
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
    world.environmentIntensity = 0.15 * light;
    if (fill.current) fill.current.intensity = 0.15 * light;
    if (lamp.current) lamp.current.intensity = 0.21 * light;
    model.diffuse.forEach((m) => {
      m.lightMapIntensity = m.userData.bounce * light;
    });
    lights.current.forEach((l, i) => {
      const [start, end] = HOLDS[i];
      const active = ease((p - start + 0.045) / 0.045) * (1 - ease((p - end) / 0.045));
      const exposure = Math.min(1, Math.pow(light, 1.6) + active);
      const material = model.displays[i].mesh.material as THREE.MeshBasicMaterial;
      const art = artwork.current[i];
      if (art) showArtwork(art, active);
      material.color.setScalar(exposure);
      if (l) l.intensity = (2 + brightness.current[i] * 16) * exposure * light;
    });

    if (lastPanel.current !== panel) {
      if (lastPanel.current >= 0) {
        const prev = panels.current[lastPanel.current]!;
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
    }
    if (panel >= 0) {
      const d = model.displays[panel],
        el = panels.current[panel]!;
      const a = rig.tl.copy(d.tl).project(cam),
        b = rig.br.copy(d.br).project(cam);
      const x = ((1 + a.x) * size.width) / 2,
        y = ((1 - a.y) * size.height) / 2;
      const width = ((b.x - a.x) * size.width) / 2,
        height = ((a.y - b.y) * size.height) / 2;
      const transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      const key = transform + width + ',' + height;
      if (overlayBox.current !== key) {
        Object.assign(el.style, { transform, width: width + 'px', height: height + 'px' });
        overlayBox.current = key;
      }
      el.style.setProperty('opacity', String(opacity));
    }
    if (painted.current && !ready.current) {
      ready.current = true;
      onReady();
    }
  });

  return (
    <>
      <primitive object={prepared.scene} dispose={null} />
      <hemisphereLight ref={fill} args={['#f5f4f2', '#9d9997', 0.15]} />
      <pointLight
        ref={lamp}
        position={[prepared.bar.x, prepared.bar.y - 0.015, prepared.bar.z + 0.014]}
        color={accent.glow}
        distance={1.25}
      />
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
