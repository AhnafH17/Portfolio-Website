'use client';

import { useEffect, useRef, useState } from 'react';
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
  { startLat: 23.68, startLng: 90.36, endLat: 43.65, endLng: -79.38 },  // BD -> Canada
  { startLat: 23.68, startLng: 90.36, endLat: 37.77, endLng: -122.4 },  // BD -> USA
  { startLat: 23.68, startLng: 90.36, endLat: 51.5,  endLng: -0.12 },   // BD -> Europe
  { startLat: 23.68, startLng: 90.36, endLat: -33.87, endLng: 151.2 },  // BD -> Australia
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

    let globeInstance: any = null;
    let rafId: number;

    const init = () => {
      if (container.clientWidth === 0) {
        rafId = requestAnimationFrame(init);
        return;
      }

      // Dynamically import globe.gl
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/globe.gl@2/dist/globe.gl.min.js';
      script.onload = () => {
        if (initialized.current) return;
        initialized.current = true;

        const Globe = (window as any).Globe;
        if (!Globe) return;

        const W = container.clientWidth;
        const H = container.clientHeight;

        globeInstance = Globe()(container)
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

        // Boost lights
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
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    gsap.fromTo(section.querySelectorAll('.ts-card'),
      { opacity: 0, y: 32 },
      {
        opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
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

        {/* LEFT — stacked accordion cards */}
        <div className="ts-left">
          <p className="section-label">Client Testimonials</p>
          <h2 className="ts-heading">Trusted by teams<br />across the globe.</h2>

          <div className="ts-cards" ref={cardsRef}>
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className={`ts-card${active === i ? ' active' : ''}`}
                onClick={() => setActive(i)}
              >
                <div className="ts-card-header">
                  <div className="ts-card-meta">
                    <span className="ts-company">{t.company}</span>
                    <span className="ts-role">{t.role}</span>
                  </div>
                  <div className="ts-card-num">0{i + 1}</div>
                </div>

                <div className="ts-card-body">
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
