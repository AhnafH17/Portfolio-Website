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
const ContactSection = lazy(() => import('@/components/ContactSection'));
const Footer = lazy(() => import('@/components/Footer'));
const Modal = lazy(() => import('@/components/Modal'));

export default function Home() {
  const [activeModal, setActiveModal] = useState<ProjectKey | null>(null);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preloaderDone && siteRef.current) {
      gsap.fromTo(siteRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }
      );
    }
  }, [preloaderDone]);

  return (
    <>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <div ref={siteRef} style={{ opacity: preloaderDone ? undefined : 0 }}>
        <LenisProvider />
        <CustomCursor />
        <Navbar />
        <main>
          <HeroSection />
          <ShowcaseSection onOpenModal={setActiveModal} />
          <Suspense fallback={null}>
            <MarqueeStrip />
            <AboutSection />
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
