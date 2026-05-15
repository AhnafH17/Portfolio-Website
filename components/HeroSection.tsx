'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

const floatA = {
  animate: {
    y: [0, -12, 0],
    transition: { duration: 4.5, ease: 'easeInOut' as const, repeat: Infinity },
  },
};
const floatB = {
  animate: {
    y: [0, 10, 0],
    transition: { duration: 5.2, ease: 'easeInOut' as const, repeat: Infinity, delay: 0.6 },
  },
};
const floatC = {
  animate: {
    y: [0, -10, 0],
    transition: { duration: 5.8, ease: 'easeInOut' as const, repeat: Infinity, delay: 1.2 },
  },
};
const floatD = {
  animate: {
    y: [0, 14, 0],
    transition: { duration: 4.2, ease: 'easeInOut' as const, repeat: Infinity, delay: 1.8 },
  },
};

const PARTICLES = [
  { top: '10%', left: '72%', size: 8 },
  { top: '18%', left: '88%', size: 5 },
  { top: '32%', left: '68%', size: 6 },
  { top: '55%', left: '92%', size: 4 },
  { top: '70%', left: '75%', size: 7 },
  { top: '80%', left: '60%', size: 5 },
  { top: '15%', left: '55%', size: 4 },
  { top: '42%', left: '95%', size: 6 },
  { top: '25%', left: '45%', size: 3 },
  { top: '65%', left: '48%', size: 4 },
  { top: '8%',  left: '62%', size: 9 },
  { top: '88%', left: '80%', size: 5 },
];

export default function HeroSection() {
  return (
    <section id="hero">
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />
      <div className="hero-bg-line" />

      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`hero-particle${i >= 6 ? ' hero-particle--minor' : ''}`}
          style={{ top: p.top, left: p.left, width: p.size, height: p.size }}
        />
      ))}

      <div className="hero-content">
        <div className="hero-text">
          <h1 className="hero-name">
            Hi, I&apos;m<br />
            <span className="accent">Ahnaf Hussain</span>
          </h1>
          <p className="hero-tagline">
            Architecting high-performance SaaS frontends and interactive digital experiences. Leading the development team at AurixLab to bridge the gap between complex data and world-class UI.
          </p>
          <a href="#about" className="hero-cta">
            Learn More{' '}
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        <div className="hero-image-wrapper">
          {/* Concentric rings */}
          <div className="hero-ring hero-ring-1" />
          <div className="hero-ring hero-ring-2" />
          <div className="hero-ring hero-ring-3" />

          {/* LEFT cards: 3 (top) + 4 (bottom) */}
          <motion.div className="hero-fc-wrap hero-fc-left-top" variants={floatA} animate="animate">
            <div className="hero-float-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/3.png" alt="" aria-hidden="true" />
              <div className="hero-float-glass" />
            </div>
          </motion.div>

          <motion.div className="hero-fc-wrap hero-fc-left-bot" variants={floatB} animate="animate">
            <div className="hero-float-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/4.png" alt="" aria-hidden="true" />
              <div className="hero-float-glass" />
            </div>
          </motion.div>

          {/* RIGHT cards: 1 (top) + 2 (bottom) */}
          <motion.div className="hero-fc-wrap hero-fc-right-top" variants={floatC} animate="animate">
            <div className="hero-float-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/1.png" alt="" aria-hidden="true" />
              <div className="hero-float-glass" />
            </div>
          </motion.div>

          <motion.div className="hero-fc-wrap hero-fc-right-bot" variants={floatD} animate="animate">
            <div className="hero-float-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/2.png" alt="" aria-hidden="true" />
              <div className="hero-float-glass" />
            </div>
          </motion.div>

          {/* Arch photo frame — highest z-index so cards hide behind it */}
          <div className="hero-image-frame">
            <Image
              src="/ahnaf-photo.jpg"
              alt="Ahnaf Hussain, Head of Web Development at AurixLab"
              fill
              priority
              style={{ objectFit: 'cover', objectPosition: 'center 50%', transform: 'scale(1.2)', filter: 'contrast(1.05) brightness(0.95)' }}
            />
          </div>

          <div className="hero-floating-tag">
            <span>@</span> AurixLab | Head of Dev
          </div>
        </div>
      </div>

      <div className="scroll-indicator">
        <span>Scroll</span>
        <div className="scroll-line" />
      </div>
    </section>
  );
}
