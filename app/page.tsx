'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import ScrollShowcase from '@/components/ScrollShowcase';
import HeroSection from '@/components/HeroSection';
import CustomCursor from '@/components/CustomCursor';
import LenisProvider from '@/components/LenisProvider';
import Preloader from '@/components/Preloader';
import gsap from 'gsap';

const MarqueeStrip = lazy(() => import('@/components/MarqueeStrip'));
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
        <LenisProvider />
        <Navbar />
        <main>
          <HeroSection />
          <ScrollShowcase />
          <Suspense fallback={null}>
            <MarqueeStrip />
            <AboutSection />
            <TestimonialSection />
            <ContactSection />
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
