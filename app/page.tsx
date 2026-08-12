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
  const [preloaderDone, setPreloaderDone] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preloaderDone || !siteRef.current) return;
    gsap.set(siteRef.current, { opacity: 0, scale: 1.08 });
    requestAnimationFrame(() => {
      gsap.to(siteRef.current!, { opacity: 1, scale: 1, duration: 0.85, ease: 'power3.out' });
    });
    // The below-fold sections mount in this same pass and change page height,
    // so ScrollTrigger's cached start/end positions need recomputing.
    const id = setTimeout(() => ScrollTrigger.refresh(), 900);
    return () => clearTimeout(id);
  }, [preloaderDone]);

  return (
    <>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <CustomCursor />
      <div
        ref={siteRef}
        style={{ transformOrigin: '50% 50vh' }}
        data-site-content
      >
        <Navbar />
        <main>
          {/* Paused while the preloader owns the screen — the hero's starfield
              and tilt loops are invisible behind it but were still burning
              frames the particle animation needed. */}
          <HeroSection paused={!preloaderDone} />
          <ScrollShowcase />
          {/* Below-fold sections are held back so their chunk eval and mount
              cost doesn't land during the preloader. */}
          {preloaderDone && (
            <Suspense fallback={null}>
              <MarqueeStrip />
              <DeviceShowcase />
              <AboutSection />
              <TestimonialSection />
              <ContactSection />
            </Suspense>
          )}
        </main>
        {preloaderDone && (
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        )}
      </div>
    </>
  );
}
