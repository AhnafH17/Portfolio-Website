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
  // After animation completes we release the fixed wrapper
  const [transitionDone, setTransitionDone] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preloaderDone || !siteRef.current) return;

    gsap.fromTo(
      siteRef.current,
      { opacity: 0, scale: 1.1 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: 'power3.out',
        onComplete: () => setTransitionDone(true),
      }
    );
  }, [preloaderDone]);

  // While transitioning: fixed+overflow-hidden so scale anchor = viewport center
  // After: back to normal flow
  const wrapStyle: React.CSSProperties = !preloaderDone
    ? { opacity: 0 }
    : !transitionDone
    ? {
        position: 'fixed',
        inset: 0,
        overflowY: 'hidden',
        transformOrigin: '50vw 50vh',
        zIndex: 1,
      }
    : {};

  return (
    <>
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <div ref={siteRef} style={wrapStyle}>
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
