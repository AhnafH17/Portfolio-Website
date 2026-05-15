'use client';

import Image from 'next/image';
import { useRef, useEffect } from 'react';
import StarField from '@/components/StarField';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Mouse tilt targets the inner img elements directly
  const tiltRefs = useRef<(HTMLImageElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2),
        y: (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
      };
    };

    const onMouseLeave = () => { mouseRef.current = { x: 0, y: 0 }; };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    wrapper.addEventListener('mouseleave', onMouseLeave);

    const animate = () => {
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * 0.05;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * 0.05;

      const mx = currentRef.current.x;
      const my = currentRef.current.y;

      // Depth multipliers — deeper cards react more
      const depths = [1.4, 1.1, 1.0, 0.7];
      tiltRefs.current.forEach((el, i) => {
        if (!el) return;
        const d = depths[i];
        const tx = my * 2.5 * d;
        const ty = mx * -2.5 * d;
        el.style.transform = `${i >= 2 ? 'scaleX(-1) ' : ''}rotateX(${tx}deg) rotateY(${ty}deg)`;
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
          {/* Star field — behind everything */}
          <StarField className="hero-starfield" />

          {/* Concentric rings */}
          <div className="hero-ring hero-ring-1" />
          <div className="hero-ring hero-ring-2" />
          <div className="hero-ring hero-ring-3" />

          {/* LEFT — 3.png top, 4.png bottom */}
          <div className="hero-fc-wrap hero-fc-left-top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/3.png" alt="" aria-hidden="true" loading="lazy" decoding="async"
              ref={el => { tiltRefs.current[0] = el; }}
              className="hero-fc-img"
            />
          </div>
          <div className="hero-fc-wrap hero-fc-left-bot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/4.png" alt="" aria-hidden="true" loading="lazy" decoding="async"
              ref={el => { tiltRefs.current[1] = el; }}
              className="hero-fc-img"
            />
          </div>

          {/* RIGHT — 1.png top (mirrored), 2.png bottom (mirrored) */}
          <div className="hero-fc-wrap hero-fc-right-top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/1.png" alt="" aria-hidden="true" loading="lazy" decoding="async"
              ref={el => { tiltRefs.current[2] = el; }}
              className="hero-fc-img"
            />
          </div>
          <div className="hero-fc-wrap hero-fc-right-bot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/2.png" alt="" aria-hidden="true" loading="lazy" decoding="async"
              ref={el => { tiltRefs.current[3] = el; }}
              className="hero-fc-img"
            />
          </div>

          {/* Arch photo frame — LCP element, priority + explicit sizes */}
          <div className="hero-image-frame">
            <Image
              src="/AhnafHussain.png"
              alt="Ahnaf Hussain, Head of Web Development at AurixLab"
              fill
              priority
              sizes="(max-width: 768px) 260px, 340px"
              style={{ objectFit: 'cover', objectPosition: 'center 30%', transform: 'scale(1.35)' }}
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
