'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Three.js only ships to the device that needs it, and never during SSR.
const DeviceCanvas = dynamic(() => import('./device/DeviceCanvas'), { ssr: false });

type Mode = 'laptop' | 'phone' | 'fallback' | null;

function detectMode(): Mode {
  // Respect reduced-motion + missing WebGL → static fallback
  if (typeof window === 'undefined') return null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let webgl = false;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  if (reduced || !webgl) return 'fallback';
  return window.matchMedia('(max-width: 768px)').matches ? 'phone' : 'laptop';
}

export default function DeviceShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const progress = useRef(0);

  // Decided once on mount — we deliberately do NOT hot-swap on resize.
  const [mode, setMode] = useState<Mode>(null);
  useEffect(() => {
    setMode(detectMode());
  }, []);

  useEffect(() => {
    if (mode !== 'laptop' && mode !== 'phone') return;
    const section = sectionRef.current;
    if (!section) return;

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        progress.current = self.progress;
        // Fade the "About Me" overlay out as the device turns (first ~30%)
        if (overlayRef.current) {
          const o = 1 - Math.min(1, self.progress / 0.28);
          overlayRef.current.style.opacity = String(o);
          overlayRef.current.style.transform = `translateY(${(1 - o) * -24}px)`;
        }
        if (hintRef.current) {
          hintRef.current.style.opacity = String(1 - Math.min(1, self.progress / 0.12));
        }
      },
    });

    return () => st.kill();
  }, [mode]);

  return (
    <section id="about-intro" ref={sectionRef} className="dv-section" aria-label="About me">
      <div className="dv-sticky">
        {/* 3D layer */}
        <div className="dv-canvas">
          {(mode === 'laptop' || mode === 'phone') && (
            <DeviceCanvas kind={mode} progress={progress} />
          )}
        </div>

        {/* "About Me" overlay — fades as the device turns */}
        <div ref={overlayRef} className="dv-overlay">
          <span className="dv-eyebrow">WHO I AM</span>
          <h2 className="dv-title">About&nbsp;Me</h2>
          <span ref={hintRef} className="dv-hint" aria-hidden="true">
            scroll&nbsp;↓
          </span>
        </div>

        {/* Static fallback (reduced-motion / no WebGL) */}
        {mode === 'fallback' && (
          <div className="dv-fallback">
            <span className="dv-eyebrow">WHO I AM</span>
            <h2 className="dv-title">About Me</h2>
            <p className="dv-fallback-text">
              I&apos;m Ahnaf Hussain, Head of Web Development at AurixLab — building
              high-performance frontends and interactive digital experiences.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
