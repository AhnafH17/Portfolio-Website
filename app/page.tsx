'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import ScrollShowcase from '@/components/ScrollShowcase';
import HeroSection from '@/components/HeroSection';
import CustomCursor from '@/components/CustomCursor';
import Preloader from '@/components/Preloader';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const MarqueeStrip = lazy(() => import('@/components/MarqueeStrip'));
const DeviceShowcase = lazy(() => import('@/components/DeviceShowcase'));
const AboutSection = lazy(() => import('@/components/AboutSection'));
const TestimonialSection = lazy(() => import('@/components/TestimonialSection'));
const ContactSection = lazy(() => import('@/components/ContactSection'));
const Footer = lazy(() => import('@/components/Footer'));

export default function Home() {
  // `reveal` starts the site fading in; `preloaderGone` removes the preloader
  // once its dissolve has finished. Collapsing these into one flag unmounts
  // the preloader mid-animation and the dissolve never renders.
  const [reveal, setReveal] = useState(false);
  const [preloaderGone, setPreloaderGone] = useState(false);
  const [belowFold, setBelowFold] = useState(false);
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

    // Held until the cross-dissolve is over — mounting six sections mid-fade
    // is the one thing that would visibly stutter it.
    const mount = setTimeout(() => setBelowFold(true), 1200);
    return () => clearTimeout(mount);
  }, [reveal]);

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
      () => import('@/components/device/DeviceCanvas'),   // heaviest, needed first
      () => import('@/components/DeviceShowcase'),
      () => import('@/components/AboutSection'),
      () => import('@/components/ContactSection'),
      () => import('@/components/TestimonialSection'),
      () => import('@/components/MarqueeStrip'),
      () => import('@/components/Footer'),
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

  useEffect(() => {
    if (!belowFold) return;
    // These sections change page height, so ScrollTrigger's cached start/end
    // positions need recomputing once they're in.
    const id = setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => clearTimeout(id);
  }, [belowFold]);

  return (
    <>
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
          <ScrollShowcase />
          {/* Below-fold sections are held back so their chunk eval and mount
              cost doesn't land during the preloader. */}
          {belowFold && (
            <Suspense fallback={null}>
              <MarqueeStrip />
              <DeviceShowcase />
              <AboutSection />
              <TestimonialSection />
              <ContactSection />
            </Suspense>
          )}
        </main>
        {belowFold && (
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        )}
      </div>
    </>
  );
}
