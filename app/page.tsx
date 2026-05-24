'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import ShowcaseSection from '@/components/ShowcaseSection';
import HeroSection from '@/components/HeroSection';
import CustomCursor from '@/components/CustomCursor';
import LenisProvider from '@/components/LenisProvider';
import Preloader from '@/components/Preloader';
import { ProjectKey } from '@/lib/projects';
import gsap from 'gsap';

const MarqueeStrip = lazy(() => import('@/components/MarqueeStrip'));
const AboutSection = lazy(() => import('@/components/AboutSection'));
const TestimonialSection = lazy(() => import('@/components/TestimonialSection'));
const ContactSection = lazy(() => import('@/components/ContactSection'));
const Footer = lazy(() => import('@/components/Footer'));
const Modal = lazy(() => import('@/components/Modal'));

export default function Home() {
  const [activeModal, setActiveModal] = useState<ProjectKey | null>(null);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preloaderDone || !siteRef.current) return;
    // Force opacity 0 before GSAP runs so there's no flash
    gsap.set(siteRef.current, { opacity: 0, scale: 1.08 });
    // rAF ensures the set() has painted before we start the tween
    requestAnimationFrame(() => {
      gsap.to(siteRef.current!, { opacity: 1, scale: 1, duration: 0.85, ease: 'power3.out' });
    });
  }, [preloaderDone]);

  return (
    <>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      {/* Cursor outside site wrapper — must not inherit opacity:0 animation */}
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
          <ShowcaseSection onOpenModal={setActiveModal} />
          <Suspense fallback={null}>
            <MarqueeStrip />
            <AboutSection />
            <TestimonialSection />
            <ContactSection />
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <Footer />
          <Modal projectKey={activeModal} onClose={() => setActiveModal(null)} />
        </Suspense>
      </div>
    </>
  );
}
