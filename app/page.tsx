'use client';

import { useState, lazy, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import ShowcaseSection from '@/components/ShowcaseSection';
import HeroSection from '@/components/HeroSection';
import CustomCursor from '@/components/CustomCursor';
import LenisProvider from '@/components/LenisProvider';
import { ProjectKey } from '@/lib/projects';

const MarqueeStrip = lazy(() => import('@/components/MarqueeStrip'));
const AboutSection = lazy(() => import('@/components/AboutSection'));
const ContactSection = lazy(() => import('@/components/ContactSection'));
const Footer = lazy(() => import('@/components/Footer'));
const Modal = lazy(() => import('@/components/Modal'));

export default function Home() {
  const [activeModal, setActiveModal] = useState<ProjectKey | null>(null);

  return (
    <>
      <LenisProvider />
      <CustomCursor />
      <Navbar />
      <main>
        <ShowcaseSection onOpenModal={setActiveModal} />
        <HeroSection />
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
    </>
  );
}
