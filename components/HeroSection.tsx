'use client';

import Image from 'next/image';
import { useRef, useEffect } from 'react';

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

// Each card's base 3D transform — mouse tilt is added on top
const BASE_TRANSFORMS = [
  'translateZ(-120px) rotateY(-18deg) rotateX(8deg) rotateZ(-6deg)',  // left-top
  'translateZ(-80px) rotateY(-14deg) rotateX(6deg) rotateZ(-4deg)',   // left-bot
  'translateZ(-60px) rotateY(16deg) rotateX(5deg) rotateZ(5deg)',     // right-top
  'translateZ(-30px) rotateY(12deg) rotateX(4deg) rotateZ(3deg)',     // right-bot
];

export default function HeroSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Normalize -1 to 1 relative to wrapper center
      mouseRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2),
      };
    };

    const onMouseLeave = () => {
      mouseRef.current = { x: 0, y: 0 };
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    wrapper.addEventListener('mouseleave', onMouseLeave);

    const animate = () => {
      // Lerp toward target mouse position
      const lerp = 0.06;
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * lerp;

      const mx = currentRef.current.x;
      const my = currentRef.current.y;

      cardsRef.current.forEach((el, i) => {
        if (!el) return;
        // Deeper cards (higher Z offset magnitude) react more to mouse
        const depth = [1.4, 1.1, 1.0, 0.7][i];
        const tiltX = my * 8 * depth;   // tilt up/down
        const tiltY = mx * -8 * depth;  // tilt left/right
        el.style.transform = `${BASE_TRANSFORMS[i]} rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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

        <div className="hero-image-wrapper" ref={wrapperRef}>
          {/* Concentric rings */}
          <div className="hero-ring hero-ring-1" />
          <div className="hero-ring hero-ring-2" />
          <div className="hero-ring hero-ring-3" />

          {/* LEFT — 3.png top, 4.png bottom */}
          <div
            className="hero-fc-wrap hero-fc-left-top"
            ref={el => { cardsRef.current[0] = el; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/3.png" alt="" aria-hidden="true" />
          </div>
          <div
            className="hero-fc-wrap hero-fc-left-bot"
            ref={el => { cardsRef.current[1] = el; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/4.png" alt="" aria-hidden="true" />
          </div>

          {/* RIGHT — 1.png top (mirrored), 2.png bottom (mirrored) */}
          <div
            className="hero-fc-wrap hero-fc-right-top"
            ref={el => { cardsRef.current[2] = el; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/1.png" alt="" aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div
            className="hero-fc-wrap hero-fc-right-bot"
            ref={el => { cardsRef.current[3] = el; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/2.png" alt="" aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
          </div>

          {/* Arch photo frame — z-index 5, above all cards */}
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
