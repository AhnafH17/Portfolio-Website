'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAccent } from '@/lib/palette';
import { DeskScreen, loadDeskThumbnails, screenLayout, type ScreenState, type Thumbs } from './screens';
import {
  ease,
  fitTour,
  HOLDS,
  introAt,
  measureDisplays,
  panelTransform,
  pose,
  sampleTour,
  toPin,
  tourScreens,
} from './beats';

export interface DeskBindings {
  progress: RefObject<number>;
  panels: RefObject<(HTMLDivElement | null)[]>;
  focusFirstProjectRef: RefObject<boolean>;
  indexButton: RefObject<HTMLButtonElement | null>;
  /** performance.now() when the preloader opened onto the desk, else null. */
  introStart: RefObject<number | null>;
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

interface LiveScreen {
  screen: DeskScreen;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  /** Upload sources for patches: never uploaded themselves, so three
   *  copies them into the screen texture with texSubImage2D. */
  sources: Map<HTMLCanvasElement, THREE.Texture>;
  last: number;
}

/** Long side of each screen texture: the screen's pixel size at its hold
 *  (with headroom for perspective filtering), 1024-2048 px; 1536+ on phones. */
function textureSizes(
  displays: ReturnType<typeof measureDisplays>,
  tour: ReturnType<typeof fitTour>,
  width: number,
  height: number,
  dpr: number,
  phone: boolean,
  max: number
) {
  const cam = new THREE.PerspectiveCamera(38, width / height, 0.01, 50);
  return displays.map((d, i) => {
    const stop = tour.screens[i];
    cam.fov = stop.fov;
    cam.position.copy(stop.eye);
    cam.lookAt(stop.at);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const [tl, tr, br, bl] = [d.tl, d.tr, d.br, d.bl].map((c) => c.clone().project(cam));
    const px = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(((a.x - b.x) * width) / 2, ((a.y - b.y) * height) / 2);
    const long = d.width >= d.height ? Math.max(px(tl, tr), px(bl, br)) : Math.max(px(tl, bl), px(tr, br));
    const want = Math.ceil((long * dpr * 1.25) / 256) * 256;
    return Math.min(max, 2048, Math.max(phone ? 1536 : 1024, want));
  });
}

export default function DeskModel({
  progress,
  panels,
  focusFirstProjectRef,
  indexButton,
  introStart,
  onReady,
  source,
}: DeskBindings & { source: THREE.Group }) {
  const { size, get, gl } = useThree();
  const dpr = useThree((state) => state.viewport.dpr);
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
    // The intro sweeps the LEDs on from left to right (world x).
    const sweep = { value: 1e3 };
    const accentBox = new THREE.Box3();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material === accentMaterial) accentBox.expandByObject(o);
    });
    accentMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uSweep = sweep;
      shader.vertexShader =
        'varying float vSweepX;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvSweepX = (modelMatrix * vec4(transformed, 1.0)).x;'
        );
      shader.fragmentShader =
        'uniform float uSweep;\nvarying float vSweepX;\n' +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.r * clamp((uSweep - vSweepX) / 0.08, 0.0, 1.0);'
        );
    };
    return {
      scene,
      displays,
      accentMaterial,
      sweep,
      sweepFrom: accentBox.min.x - 0.1,
      sweepTo: accentBox.max.x + 0.1,
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
  const live = useRef<LiveScreen[]>([]);
  /** Hover/focus and arrival per monitor, kept across texture rebuilds. */
  const screenState = useRef<ScreenState[]>([0, 1, 2].map(() => ({ hover: -1, arrived: null })));
  const pointerHover = useRef<[number, number]>([-1, -1]);
  const focusHover = useRef<[number, number]>([-1, -1]);
  const settledAt = useRef(-1);
  const [assets, setAssets] = useState<{ thumbs: Thumbs | null } | null>(null);
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

  // The atlas and typefaces load in parallel. The first visible GPU frame
  // already contains the finished typography and project imagery.
  useEffect(() => {
    let active = true;
    Promise.all([
      loadDeskThumbnails(),
      document.fonts.load('400 32px "Greater Theory"').catch(() => []),
      document.fonts.load('600 18px "DM Sans"').catch(() => []),
      document.fonts.load('300 18px "DM Sans"').catch(() => []),
    ]).then(([thumbs]) => {
      if (active) setAssets({ thumbs });
    });
    return () => {
      active = false;
    };
  }, []);

  const sizes = useMemo(
    () =>
      textureSizes(
        prepared.displays,
        tour,
        size.width,
        size.height,
        dpr,
        phone,
        gl.capabilities.maxTextureSize
      ).join(','),
    [prepared, tour, size, dpr, phone, gl]
  );

  // Link overlay: the same rectangles as the paint, for keyboard focus.
  useLayoutEffect(() => {
    prepared.displays.forEach((_, i) => {
      const panel = panels.current[i]!;
      const layout = screenLayout(i, phone);
      screenSizes.current[i] = layout;
      panel.style.setProperty('width', layout.w + 'px');
      panel.style.setProperty('height', layout.h + 'px');
      panel.querySelectorAll('a').forEach((link, j) => {
        const { x, y, w, h } = layout.cards[j];
        Object.assign(link.style, {
          left: x + 'px',
          top: y + 'px',
          width: w + 'px',
          height: h + 'px',
          borderRadius: layout.radius + 'px',
        });
      });
    });
  }, [prepared, panels, phone]);

  useLayoutEffect(() => {
    if (!assets) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const longSides = sizes.split(',').map(Number);
    const now = performance.now() / 1000;
    const entries = prepared.displays.map((display, i): LiveScreen => {
      const screen = new DeskScreen(i, phone, longSides[i], accent, assets.thumbs, still);
      screen.paintAll(now, screenState.current[i]);
      const texture = new THREE.CanvasTexture(screen.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.anisotropy = gl.capabilities.getMaxAnisotropy();
      const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, fog: false });
      display.mesh.material = material;
      const meter = document.createElement('canvas');
      meter.width = meter.height = 8;
      const ctx = meter.getContext('2d')!;
      ctx.drawImage(screen.canvas, 0, 0, 8, 8);
      const pixels = ctx.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      for (let k = 0; k < pixels.length; k += 4) {
        sum += 0.213 * pixels[k] + 0.715 * pixels[k + 1] + 0.072 * pixels[k + 2];
      }
      brightness.current[i] = sum / (64 * 255);
      return { screen, texture, material, sources: new Map(), last: 0 };
    });
    live.current = entries;
    painted.current = true;
    return () => {
      live.current = [];
      entries.forEach(({ material, texture }) => {
        material.dispose();
        texture.dispose();
      });
    };
  }, [assets, sizes, prepared, phone, accent, gl]);

  // Pointer: from any camera position a hover or tap on a monitor raycasts
  // the three screen meshes only and maps the hit UV to the layout's cards.
  useEffect(() => {
    const stage = gl.domElement.closest<HTMLElement>('.dh-stage');
    const root = gl.domElement.closest<HTMLElement>('.dh');
    if (!stage || !root) return;
    const ray = new THREE.Raycaster();
    const point = new THREE.Vector2();
    const meshes = prepared.displays.map((d) => d.mesh);
    const hitAt = (clientX: number, clientY: number) => {
      if (!ready.current || !live.current.length) return null;
      const { left, top, width, height } = gl.domElement.getBoundingClientRect();
      point.set(((clientX - left) / width) * 2 - 1, 1 - ((clientY - top) / height) * 2);
      ray.setFromCamera(point, get().camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (!hit?.uv) return null;
      const index = meshes.indexOf(hit.object as THREE.Mesh);
      const screen = live.current[index]?.screen;
      if (!screen) return null;
      return { index, target: screen.hit(hit.uv.x * screen.layout.w, hit.uv.y * screen.layout.h) };
    };
    // Controls layered over the stage keep their own clicks.
    const own = (event: Event) => {
      const el = event.target instanceof Element ? event.target : null;
      return !el || !el.closest('a, button, input, textarea, select, [role="button"]');
    };
    let frame = 0;
    let lastMove: PointerEvent | null = null;
    const setHover = (index: number, target: number) => {
      pointerHover.current = [index, target];
      const settledHere = index >= 0 && settledAt.current === index;
      stage.style.cursor = index >= 0 && (target >= 0 || !settledHere) ? 'pointer' : '';
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      lastMove = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!lastMove) return;
        const hit = own(lastMove) ? hitAt(lastMove.clientX, lastMove.clientY) : null;
        setHover(hit ? hit.index : -1, hit ? hit.target : -1);
      });
    };
    const leave = () => {
      lastMove = null;
      setHover(-1, -1);
    };
    // Touch: a tap is a short press that didn't move (a moving finger is
    // scrolling the page and is left alone). Handled on pointerup, as the
    // page's touch handling doesn't always let a click through.
    let down: { x: number; y: number; time: number } | null = null;
    let tapped = 0;
    const press = (event: PointerEvent) => {
      down = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY, time: event.timeStamp } : null;
    };
    const cancel = () => {
      down = null;
    };
    const release = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !down || !own(event)) return;
      const still = Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 10;
      const short = event.timeStamp - down.time < 600;
      down = null;
      if (still && short && activate(event.clientX, event.clientY, false)) tapped = event.timeStamp;
    };
    const open = (event: MouseEvent) => {
      if (!own(event) || event.button > 1) return;
      // The tap was already handled on pointerup.
      if (tapped && event.timeStamp - tapped < 800) {
        event.preventDefault();
        return;
      }
      if (activate(event.clientX, event.clientY, event.button === 1 || event.metaKey || event.ctrlKey, event.button))
        event.preventDefault();
    };
    const activate = (clientX: number, clientY: number, newTab: boolean, button = 0) => {
      const hit = hitAt(clientX, clientY);
      if (!hit) return false;
      const { screen } = live.current[hit.index];
      if (hit.target >= 0) {
        const href = '/projects/' + screen.keyAt(hit.target, performance.now() / 1000);
        if (newTab) window.open(href, '_blank', 'noopener');
        else window.location.assign(href);
        return true;
      }
      if (button !== 0 || settledAt.current === hit.index) return true;
      // An empty part of a monitor: glide to that monitor's stop.
      const [start, end] = HOLDS[hit.index];
      const y =
        root.getBoundingClientRect().top +
        window.scrollY +
        Math.round(stage.clientHeight * tourScreens(phone)) * toPin((start + end) / 2, phone);
      if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.6 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
      return true;
    };
    // Keyboard focus on an overlay link highlights the same card.
    const focusers = panels.current.map((panel, index) => {
      const focus = (event: FocusEvent) => {
        const links = [...panel!.querySelectorAll('a')];
        const j = links.indexOf(event.target as HTMLAnchorElement);
        focusHover.current = j >= 0 ? [index, j] : [-1, -1];
      };
      const blur = () => {
        focusHover.current = [-1, -1];
      };
      panel!.addEventListener('focusin', focus);
      panel!.addEventListener('focusout', blur);
      return () => {
        panel!.removeEventListener('focusin', focus);
        panel!.removeEventListener('focusout', blur);
      };
    });
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    stage.addEventListener('pointerdown', press);
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', cancel);
    stage.addEventListener('click', open);
    stage.addEventListener('auxclick', open);
    return () => {
      cancelAnimationFrame(frame);
      stage.style.cursor = '';
      focusers.forEach((remove) => remove());
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', leave);
      stage.removeEventListener('pointerdown', press);
      stage.removeEventListener('pointerup', release);
      stage.removeEventListener('pointercancel', cancel);
      stage.removeEventListener('click', open);
      stage.removeEventListener('auxclick', open);
    };
  }, [prepared, panels, gl, get, phone]);

  useEffect(
    () => () => {
      prepared.accentMaterial.dispose();
      prepared.diffuse.forEach((m) => m.dispose());
      prepared.bounce.dispose();
      prepared.glow.dispose();
    },
    [prepared]
  );

  const patchAt = useMemo(() => new THREE.Vector2(), []);
  const corner = useMemo(() => new THREE.Vector3(), []);
  /** Advance each monitor's UI: ~30 fps when it fills a good part of the
   *  view, a few fps when small, nothing when off screen or still dark.
   *  Only the patches that changed are copied into the texture. */
  const animateScreens = (cam: THREE.Camera, power: number[]) => {
    const now = performance.now();
    live.current.forEach((entry, i) => {
      const [pi, pt] = pointerHover.current;
      const [fi, ft] = focusHover.current;
      const state = screenState.current[i];
      const hover = pi === i ? pt : fi === i ? ft : -1;
      const hoverChanged = hover !== state.hover;
      state.hover = hover;
      if (power[i] < 0.05 && !hoverChanged) return;
      const d = modelRef.current.displays[i];
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity,
        behind = false;
      for (const c of [d.tl, d.tr, d.br, d.bl]) {
        corner.copy(c).project(cam);
        if (corner.z > 1) behind = true;
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      }
      const visible = !behind && maxX > -1 && minX < 1 && maxY > -1 && minY < 1;
      const area = ((Math.min(maxX, 1) - Math.max(minX, -1)) * (Math.min(maxY, 1) - Math.max(minY, -1))) / 4;
      const fps = !visible ? 0 : area > 0.12 ? 30 : 8;
      // Hover changes land on the next frame whatever the rate.
      if (!hoverChanged && (!fps || now - entry.last < 1000 / fps - 4)) return;
      entry.last = now;
      const patches = entry.screen.update(now / 1000, state);
      patches.forEach((p, k) => {
        let src = entry.sources.get(p.canvas);
        if (!src) {
          src = new THREE.Texture(p.canvas);
          entry.sources.set(p.canvas, src);
        }
        // Rebuild mipmaps once, after the last patch of this frame.
        entry.texture.generateMipmaps = k === patches.length - 1;
        gl.copyTextureToTexture(src, entry.texture, null, patchAt.set(p.x, p.y));
      });
      entry.texture.generateMipmaps = true;
    });
  };

  useFrame(({ camera, clock, scene: world }, dt) => {
    const model = modelRef.current;
    const rig = rigRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    const p = progress.current;
    const { light: tourLight, panel, settled } = sampleTour(tour, p, rig.pose);
    const { eye, at, fov, shiftX, shiftY } = rig.pose;
    // Power-on after the preloader: the tour pose is offset closer and
    // higher and eases home, so scrolling during the intro never jumps.
    const start = introStart.current;
    const intro = introAt(start === null ? null : (performance.now() - start) / 1000);
    const light = tourLight * intro.room;
    if (!intro.done) {
      const away = 1 - intro.camera;
      const reach = eye.distanceTo(at);
      eye.lerp(at, 0.16 * away);
      eye.y += reach * 0.1 * away;
      model.sweep.value = THREE.MathUtils.lerp(model.sweepFrom, model.sweepTo, intro.sweep);
    } else model.sweep.value = 1e3;
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
      fog.near = dist * tourLight + 0.4;
      fog.far = dist + 2 + tourLight * 8;
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
      const exposure = Math.min(1, 0.22 + tourLight * 0.78 + active) * intro.screens[i];
      const material = model.displays[i].mesh.material as THREE.MeshBasicMaterial;
      material.color.setScalar(exposure);
      if (l) l.intensity = (2 + brightness.current[i] * 16) * exposure * tourLight;
    });

    if (lastPanel.current !== panel) {
      if (lastPanel.current >= 0) {
        const prev = panels.current[lastPanel.current]!;
        if (prev.contains(document.activeElement)) indexButton.current?.focus({ preventScroll: true });
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
    settledAt.current = settled ? panel : -1;
    if (settled && screenState.current[panel].arrived === null) {
      screenState.current[panel].arrived = performance.now() / 1000;
    }
    animateScreens(cam, intro.screens);
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
