'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const TESTIMONIALS = [
  {
    company: 'CPC Clinics',
    role: 'Healthcare Provider',
    quote: 'Ahnaf rebuilt our entire web presence from the ground up. The site now ranks on page one for every key search term and our patient inquiry volume has more than doubled since launch.',
    tags: ['WordPress', 'SEO', 'Performance'],
  },
  {
    company: 'Budget Promotion',
    role: 'Promotional Products',
    quote: 'The Shopify build was exactly what we needed. Custom product configurator, full Printavo integration, checkout optimized. Our conversion rate jumped considerably within the first month.',
    tags: ['Shopify', 'Integration', 'E-Commerce'],
  },
  {
    company: 'LeadCraft IT Solutions',
    role: 'BPO & ITES Company',
    quote: 'Delivered a world-class website with WebGL shaders, smooth animations, and a globe visualization that genuinely impressed our US clients. Exactly the premium feel we were going for.',
    tags: ['Next.js', 'WebGL', 'GSAP'],
  },
  {
    company: 'AurixLab',
    role: 'Digital Agency',
    quote: 'Ahnaf leads our entire development team with precision. He set the technical direction, built our internal tooling, and consistently delivers at a level that makes every client renew.',
    tags: ['Leadership', 'SaaS', 'Full-Stack'],
  },
];

const ARCS = [
  { startLat: 23.68, startLng: 90.36, endLat: 43.65, endLng: -79.38 },
  { startLat: 23.68, startLng: 90.36, endLat: 37.77, endLng: -122.4 },
  { startLat: 23.68, startLng: 90.36, endLat: 51.5,  endLng: -0.12 },
  { startLat: 23.68, startLng: 90.36, endLat: -33.87, endLng: 151.2 },
];

const POINTS = [
  { lat: 23.68,  lng: 90.36,   color: '#c9a84c', label: 'Bangladesh' },
  { lat: 43.65,  lng: -79.38,  color: '#e2c973', label: 'Canada' },
  { lat: 37.77,  lng: -122.4,  color: '#e2c973', label: 'USA' },
  { lat: 51.5,   lng: -0.12,   color: '#e2c973', label: 'Europe' },
  { lat: -33.87, lng: 151.2,   color: '#e2c973', label: 'Australia' },
];

function GlobeViz() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;

    const init = () => {
      if (container.clientWidth === 0) {
        rafId = requestAnimationFrame(init);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/globe.gl@2/dist/globe.gl.min.js';
      script.onload = () => {
        if (initialized.current) return;
        initialized.current = true;

        const Globe = (window as any).Globe;
        if (!Globe) return;

        const W = container.clientWidth;
        const H = container.clientHeight;

        const globeInstance = Globe()(container)
          .width(W)
          .height(H)
          .backgroundColor('rgba(0,0,0,0)')
          .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
          .atmosphereColor('rgba(201,168,76,0.4)')
          .atmosphereAltitude(0.18)
          .arcsData(ARCS)
          .arcColor(() => ['#c9a84c', '#e2c973'])
          .arcDashLength(0.35)
          .arcDashGap(0.2)
          .arcDashAnimateTime(2200)
          .arcStroke(1.2)
          .arcAltitude(0.28)
          .pointsData(POINTS)
          .pointColor((d: any) => d.color)
          .pointAltitude(0.015)
          .pointRadius(0.6)
          .labelsData(POINTS)
          .labelText((d: any) => d.label)
          .labelColor((d: any) => d.color)
          .labelSize(1.8)
          .labelAltitude(0.02)
          .labelDotRadius(0);

        globeInstance.controls().autoRotate = true;
        globeInstance.controls().autoRotateSpeed = 0.9;
        globeInstance.controls().enableZoom = false;

        setTimeout(() => {
          globeInstance.scene().children.forEach((obj: any) => {
            if (obj.type?.includes('Light')) obj.intensity *= 2.2;
          });
        }, 150);

        globeInstance.pointOfView({ lat: 23.68, lng: 90.36, altitude: 1.8 });

        const ro = new ResizeObserver(() => {
          if (!container) return;
          globeInstance.width(container.clientWidth);
          globeInstance.height(container.clientHeight);
        });
        ro.observe(container);
      };
      document.head.appendChild(script);
    };

    rafId = requestAnimationFrame(init);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );
}

export default function TestimonialSection() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimating = useRef(false);

  const goTo = useCallback((next: number, dir: 1 | -1 = 1) => {
    if (isAnimating.current) return;
    const slider = sliderRef.current;
    if (!slider) return;

    const cards = slider.querySelectorAll<HTMLElement>('.ts-slide');
    const current = cards[active];
    const nextCard = cards[next];
    if (!current || !nextCard) return;

    isAnimating.current = true;

    gsap.set(nextCard, { opacity: 0, x: dir * 60, position: 'absolute', top: 0, left: 0, width: '100%' });
    gsap.set(current, { position: 'relative' });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(current, { clearProps: 'all', position: '', opacity: 0, x: 0 });
        gsap.set(nextCard, { clearProps: 'all', position: '', opacity: 1, x: 0 });
        setActive(next);
        isAnimating.current = false;
      },
    });

    tl.to(current, { opacity: 0, x: -dir * 40, duration: 0.35, ease: 'power2.in' }, 0)
      .to(nextCard, { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out' }, 0.15);
  }, [active]);

  const advance = useCallback((dir: 1 | -1) => {
    const next = (active + dir + TESTIMONIALS.length) % TESTIMONIALS.length;
    goTo(next, dir);
  }, [active, goTo]);

  // Auto-advance
  useEffect(() => {
    timerRef.current = setTimeout(() => advance(1), 4500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, advance]);

  // Entrance animation
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    gsap.fromTo(section.querySelector('.ts-left'),
      { opacity: 0, x: -40 },
      {
        opacity: 1, x: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%', once: true },
      }
    );
    gsap.fromTo(section.querySelector('.ts-globe-wrap'),
      { opacity: 0, scale: 0.92 },
      {
        opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      }
    );
  }, []);

  return (
    <section ref={sectionRef} className="ts-section">
      <div className="ts-wrap">

        {/* LEFT — slider */}
        <div className="ts-left">
          <p className="section-label">Client Testimonials</p>
          <h2 className="ts-heading">Trusted by teams<br />across the globe.</h2>

          <div className="ts-slider-wrap">
            <div className="ts-slider" ref={sliderRef}>
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="ts-slide"
                  style={{ display: i === active ? 'block' : (i === (active + 1) % TESTIMONIALS.length || i === (active - 1 + TESTIMONIALS.length) % TESTIMONIALS.length) ? 'block' : 'none', opacity: i === active ? 1 : 0 }}
                >
                  <div className="ts-slide-inner">
                    <div className="ts-slide-top">
                      <span className="ts-company">{t.company}</span>
                      <span className="ts-role">{t.role}</span>
                    </div>
                    <p className="ts-quote">&ldquo;{t.quote}&rdquo;</p>
                    <div className="ts-tags">
                      {t.tags.map(tag => (
                        <span key={tag} className="ts-tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="ts-controls">
              <div className="ts-dots">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    className={`ts-dot${i === active ? ' active' : ''}`}
                    onClick={() => goTo(i, i > active ? 1 : -1)}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>
              <div className="ts-arrows">
                <button className="ts-arrow" onClick={() => advance(-1)} aria-label="Previous">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M11 14L6 9l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="ts-arrow" onClick={() => advance(1)} aria-label="Next">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — globe */}
        <div className="ts-right">
          <div className="ts-globe-wrap">
            <div className="ts-globe-glow" />
            <div className="ts-globe-clip">
              <GlobeViz />
            </div>
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
