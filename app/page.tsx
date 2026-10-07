'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import CanvasShowcase from '@/components/CanvasShowcase';
import HeroSection from '@/components/HeroSection';
import CustomCursor from '@/components/CustomCursor';
import Preloader from '@/components/Preloader';
import Footer from '@/components/Footer';
import { homeGraph, jsonLd } from '@/lib/schema';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const MarqueeStrip = lazy(() => import('@/components/MarqueeStrip'));
const DeviceShowcase = lazy(() => import('@/components/DeviceShowcase'));
const AboutSection = lazy(() => import('@/components/AboutSection'));
const ImpactsSection = lazy(() => import('@/components/ImpactsSection'));
const TestimonialSection = lazy(() => import('@/components/TestimonialSection'));
const ContactSection = lazy(() => import('@/components/ContactSection'));

// Mounted in this order, one per idle slot; Footer (outside <main>) last.
const BELOW_FOLD = [MarqueeStrip, DeviceShowcase, AboutSection, ImpactsSection, TestimonialSection, ContactSection];

export default function Home() {
  // `reveal` starts the site fading in; `preloaderGone` removes the preloader
  // once its dissolve has finished. Collapsing these into one flag unmounts
  // the preloader mid-animation and the dissolve never renders.
  const [reveal, setReveal] = useState(false);
  const [preloaderGone, setPreloaderGone] = useState(false);
  // How many below-fold sections are mounted (see BELOW_FOLD). They go in one
  // at a time — mounting all six in one commit blocked the main thread for
  // ~430ms, which landed on anyone already scrolling into the showcase.
  const [mounted, setMounted] = useState(0);
  const siteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reveal || !siteRef.current) return;
    /* Opacity only — no scale. The preloader hands off by cross-dissolving a
       particle portrait onto the real hero photo, so the target must not be
       moving. Reaches full opacity well before the preloader finishes fading
       (0.95s), so the photo is solid underneath while the particles resolve
       onto it and the two never dip to background together. */
    gsap.set(siteRef.current, { opacity: 0 });
    requestAnimationFrame(() => {
      gsap.to(siteRef.current!, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    });

    // Held until the cross-dissolve is over — mounting sections mid-fade is
    // the one thing that would visibly stutter it.
    const mount = setTimeout(() => setMounted(1), 1200);
    return () => clearTimeout(mount);
  }, [reveal]);

  useEffect(() => {
    if (mounted === 0) return;
    if (mounted >= BELOW_FOLD.length + 1) {
      // These sections change page height, so ScrollTrigger's cached
      // start/end positions need recomputing once they're all in.
      const id = setTimeout(() => ScrollTrigger.refresh(), 300);
      return () => clearTimeout(id);
    }
    // Next section in the next idle slot, so each mount is its own short
    // task, and only while the visitor isn't scrolling: a mount is a
    // 50-130ms task (much more on phones), and idle gaps between scroll
    // frames used to land it mid-flight in the showcase. If they get close
    // to the end of what's mounted, the next section goes in regardless.
    const next = () => setMounted((m) => m + 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    let lastScroll = 0;
    const onScroll = () => { lastScroll = performance.now(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    const attempt = () => {
      // "Close": the marker after the last mounted section is within two
      // screens. (Not the document end: until these sections exist the page
      // is short, so that was "close" from the first scroll.)
      const marker = document.querySelector('[data-mount-marker]');
      const nearEnd = !marker || marker.getBoundingClientRect().top < window.innerHeight * 2;
      if (nearEnd) { next(); return; }
      if (performance.now() - lastScroll < 300) { timer = setTimeout(attempt, 160); return; }
      if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(next, { timeout: 400 });
      else timer = setTimeout(next, 60);
    };
    attempt();
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    };
  }, [mounted]);

  /* Warm the heavy below-fold chunks while the preloader is still on screen.
     Fetching and mounting are deliberately separated: mounting during the
     preloader was what cost frames, but the download is off the main thread,
     and Three.js + R3F is ~260KB that used to arrive during the preloader for
     free. Left until mount it downloads, parses, and initialises WebGL only
     once the section is already scrolling into view.
     Evaluation is spread across idle callbacks so it lands between particle
     frames rather than inside one. */
  useEffect(() => {
    let cancelled = false;
    const jobs: (() => Promise<unknown>)[] = [
      // Heaviest, needed first, and then its model, fetched and parsed now
      // rather than when the section mounts (that parse landed mid-scroll).
      () => import('@/components/device/DeviceCanvas').then((m) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        m.preloadDeviceModel(window.matchMedia('(max-width: 768px)').matches ? 'phone' : 'laptop');
      }),
      // The About scene's module preloads its model when it loads.
      () => import('@/components/about/WorkspaceCanvas'),
      () => import('@/components/DeviceShowcase'),
      () => import('@/components/AboutSection'),
      () => import('@/components/ImpactsSection'),
      () => import('@/components/ContactSection'),
      () => import('@/components/TestimonialSection'),
      () => import('@/components/MarqueeStrip'),
    ];

    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(cb, { timeout: 1500 })
        : window.setTimeout(cb, 250);

    let i = 0;
    const step = () => {
      if (cancelled || i >= jobs.length) return;
      jobs[i++]().catch(() => {}).then(() => { if (!cancelled) idle(step); });
    };

    idle(step);

    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(homeGraph()) }} />
      {!preloaderGone && (
        <Preloader
          onReveal={() => setReveal(true)}
          onDone={() => setPreloaderGone(true)}
        />
      )}
      <CustomCursor />
      <div ref={siteRef} data-site-content>
        <Navbar />
        <main>
          {/* Paused while the preloader owns the screen — the hero's starfield
              and tilt loops are invisible behind it but were still burning
              frames the particle animation needed. */}
          <HeroSection paused={!reveal} />
          <CanvasShowcase />
          {/* Below-fold sections are held back so their chunk eval and mount
              cost doesn't land during the preloader. */}
          {BELOW_FOLD.slice(0, mounted).map((Section, i) => (
            // Own boundary each, so a later section suspending never blanks
            // one that's already on screen.
            <Suspense key={i} fallback={null}>
              <Section />
            </Suspense>
          ))}
          <div data-mount-marker aria-hidden="true" />
        </main>
        {/* Not lazy: it carries the bio and case-study links the server HTML
            needs (the sections above only arrive after mount). */}
        <Footer />
      </div>
    </>
  );
}
