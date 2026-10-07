'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ParticleGlobe from '@/components/ParticleGlobe';

gsap.registerPlugin(ScrollTrigger);

const TESTIMONIALS = [
  {
    id: 1,
    company: 'CPC Clinics',
    role: 'Healthcare Provider',
    quote: 'Ahnaf rebuilt our entire web presence from the ground up. The site now ranks on page one for every key search term and our patient inquiry volume has more than doubled since launch.',
    tags: ['WordPress', 'SEO', 'Performance'],
    initials: 'CC',
  },
  {
    id: 2,
    company: 'Budget Promotion',
    role: 'Promotional Products',
    quote: 'The Shopify build was exactly what we needed. Custom product configurator, full Printavo integration, checkout optimized. Our conversion rate jumped considerably within the first month.',
    tags: ['Shopify', 'Integration', 'E-Commerce'],
    initials: 'BP',
  },
  {
    id: 3,
    company: 'LeadCraft IT Solutions',
    role: 'BPO & ITES Company',
    quote: 'Delivered a world-class website with WebGL shaders, smooth animations, and a globe visualization that genuinely impressed our US clients. Exactly the premium feel we were going for.',
    tags: ['Next.js', 'WebGL', 'GSAP'],
    initials: 'LC',
  },
  {
    id: 4,
    company: 'AurixLab',
    role: 'Digital Agency',
    quote: 'Ahnaf leads our entire development team with precision. He set the technical direction, built our internal tooling, and consistently delivers at a level that makes every client renew.',
    tags: ['Leadership', 'SaaS', 'Full-Stack'],
    initials: 'AL',
  },
];

export default function TestimonialSection() {
  const [[current, dir], setCurrent] = useState([0, 0]);
  const sectionRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimating = useRef(false);

  const paginate = useCallback((newDir: 1 | -1) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setCurrent(([c]) => [(c + newDir + TESTIMONIALS.length) % TESTIMONIALS.length, newDir]);
    setTimeout(() => { isAnimating.current = false; }, 520);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 70) paginate(info.offset.x < 0 ? 1 : -1);
  }, [paginate]);

  useEffect(() => {
    timerRef.current = setTimeout(() => paginate(1), 4500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paginate]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    gsap.fromTo(section.querySelector('.ts-left'),
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%', once: true } }
    );
    gsap.fromTo(section.querySelector('.ts-globe-wrap'),
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 70%', once: true } }
    );
  }, []);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, rotateY: d > 0 ? 12 : -12, scale: 0.92 }),
    center: { x: 0, opacity: 1, rotateY: 0, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, rotateY: d > 0 ? -12 : 12, scale: 0.92 }),
  };

  const t = TESTIMONIALS[current];

  return (
    <section ref={sectionRef} className="ts-section">
      <div className="ts-wrap">

        <div className="ts-left">
          <p className="section-label">Client Testimonials</p>
          <h2 className="ts-heading"><span className="gold-glow">Trusted</span> by teams<br />across the <span className="gold-glow">globe.</span></h2>

          <div className="ts-stack-outer" style={{ perspective: '900px' }}>
            <AnimatePresence custom={dir} mode="wait">
              <motion.div
                key={current}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={handleDragEnd}
                className="ts-stack-card"
                style={{ cursor: 'grab', position: 'relative' }}
                whileDrag={{ cursor: 'grabbing', scale: 0.99 }}
              >
                <div className="ts-card-shimmer" />
                <div className="ts-card-content">
                  <div className="ts-card-top">
                    <div className="ts-avatar">{t.initials}</div>
                    <div className="ts-card-meta">
                      <span className="ts-company">{t.company}</span>
                      <span className="ts-role">{t.role}</span>
                    </div>
                    <span className="ts-card-num">0{current + 1}</span>
                  </div>
                  <p className="ts-quote">&ldquo;{t.quote}&rdquo;</p>
                  <div className="ts-tags">
                    {t.tags.map(tag => (
                      <span key={tag} className="ts-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="ts-controls">
              <div className="ts-dots">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    className={`ts-dot${i === current ? ' active' : ''}`}
                    onClick={() => paginate(i > current ? 1 : -1)}
                    aria-label={`Testimonial ${i + 1}`}
                  />
                ))}
              </div>
              <div className="ts-arrows">
                <button className="ts-arrow" onClick={() => paginate(-1)} aria-label="Previous">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="ts-arrow" onClick={() => paginate(1)} aria-label="Next">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="ts-right">
          <div className="ts-globe-wrap">
            <div className="ts-globe-glow" />
            <div className="ts-globe-clip"><ParticleGlobe /></div>
            <div className="ts-globe-label">
              <span className="ts-globe-dot" />
              Bangladesh to the world
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
