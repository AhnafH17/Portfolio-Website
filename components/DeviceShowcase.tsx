'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { hasWebGL } from '@/lib/webgl';

gsap.registerPlugin(ScrollTrigger);

// Three.js only ships to the device that needs it, and never during SSR.
const DeviceCanvas = dynamic(() => import('./device/DeviceCanvas'), { ssr: false });

type Mode = 'laptop' | 'phone' | 'fallback' | null;

function detectMode(): Mode {
  // Respect reduced-motion + missing WebGL → static fallback
  if (typeof window === 'undefined') return null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !hasWebGL()) return 'fallback';
  return window.matchMedia('(max-width: 768px)').matches ? 'phone' : 'laptop';
}

export default function DeviceShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  // Decided once on mount — we deliberately do NOT hot-swap on resize.
  const [mode, setMode] = useState<Mode>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMode(detectMode()));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Only run the WebGL render loop while the hero is on screen and not yet
  // fully covered by About.
  const [inView, setInView] = useState(false);
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '200px 0px' },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);
  const active = inView && !covered;

  useEffect(() => {
    if (mode !== 'laptop' && mode !== 'phone') return;
    const section = sectionRef.current;
    if (!section) return;

    /* The track is the device's part, then one screen in which About (pulled
       up a screen by CSS, `.dv-section + .ab3`) rises over the still-pinned
       scene. The trigger runs until the sticky releases, the moment About's
       top reaches the top of the screen. Everything below is a pure function
       of where the page is scrolled, so it reads the same whichever way the
       visitor got there. */
    const sticky = () => stickyRef.current?.offsetHeight || window.innerHeight;
    const apply = (scrolled: number) => {
      const riseStart = Math.max(1, section.offsetHeight - sticky() - window.innerHeight);
      const p = Math.min(1, Math.max(0, scrolled / riseStart));
      const cover = Math.min(1, Math.max(0, (scrolled - riseStart) / window.innerHeight));
      progress.current = p;
      // Fade the "About Me" overlay out as the device turns (first ~30%)
      if (overlayRef.current) {
        const o = 1 - Math.min(1, p / 0.3);
        overlayRef.current.style.opacity = String(o);
        overlayRef.current.style.transform = `translateY(${(1 - o) * -24}px)`;
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = String(1 - Math.min(1, p / 0.13));
      }
      // Covered by About: the scene darkens and settles back a little.
      if (fadeRef.current) fadeRef.current.style.opacity = String(cover * 0.6);
      if (canvasRef.current) canvasRef.current.style.transform = cover > 0 ? `scale(${1 - cover * 0.05})` : '';
      setCovered(cover >= 1);
    };
    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${section.offsetHeight - sticky()}`,
      invalidateOnRefresh: true,
      onUpdate: (self) => apply(self.progress * (self.end - self.start)),
      onRefresh: (self) => apply(self.progress * (self.end - self.start)),
    });

    return () => st.kill();
  }, [mode]);

  const isStatic = mode === 'fallback';

  return (
    <section
      id="about-intro"
      ref={sectionRef}
      className={`dv-section${isStatic ? ' dv-section--static' : ''}`}
      aria-label="About me"
    >
      <div ref={stickyRef} className="dv-sticky">
        {/* 3D layer */}
        <div ref={canvasRef} className="dv-canvas">
          {(mode === 'laptop' || mode === 'phone') && (
            <DeviceCanvas kind={mode} progress={progress} active={active} />
          )}
        </div>

        <div ref={fadeRef} className="dv-fade" aria-hidden="true" />

        {/* "About Me" overlay — fades as the device turns. Suppressed in the
            static fallback, which carries its own eyebrow and title: .dv-sticky
            is a centering flex row, so rendering both put two "About Me"
            blocks side by side, each overflowing the viewport. */}
        {!isStatic && (
          <div ref={overlayRef} className="dv-overlay">
            <span className="dv-eyebrow">WHO I AM</span>
            <h2 className="dv-title" tabIndex={-1}>About&nbsp;Me</h2>
            <span ref={hintRef} className="dv-hint" aria-hidden="true">
              scroll&nbsp;↓
            </span>
          </div>
        )}

        {/* Static fallback (reduced-motion / no WebGL) */}
        {isStatic && (
          <div className="dv-fallback">
            <span className="dv-eyebrow">WHO I AM</span>
            <h2 className="dv-title" tabIndex={-1}>About Me</h2>
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
