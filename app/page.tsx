'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import AccordionHero from '@/components/AccordionHero';
import MarqueeStrip from '@/components/MarqueeStrip';
import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import Modal from '@/components/Modal';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';
import CustomCursor from '@/components/CustomCursor';
import LenisProvider from '@/components/LenisProvider';
import { ProjectKey } from '@/lib/projects';

export default function Home() {
  const [activeModal, setActiveModal] = useState<ProjectKey | null>(null);

  return (
    <>
      <LenisProvider />
      <CustomCursor />
      <Navbar />
      <main>
        <AccordionHero onOpenModal={setActiveModal} />
        <MarqueeStrip />
        <HeroSection />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
      <Modal projectKey={activeModal} onClose={() => setActiveModal(null)} />
    </>
  );
}
