'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';
import gsap from 'gsap';

interface ShowcaseSectionProps {
  onOpenModal: (key: ProjectKey) => void;
}

export default function ShowcaseSection({ onOpenModal }: ShowcaseSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const imgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const bigNumRef = useRef<HTMLSpanElement>(null);

  const active = stripMeta[activeIdx];
  const project = projectData[active.key];

  const handleSelect = useCallback((idx: number) => {
    if (idx === activeIdx) return;

    const tl = gsap.timeline();
    const targets = [imgRef.current, titleRef.current, subtitleRef.current, tagsRef.current, bigNumRef.current];

    tl.to(targets, { opacity: 0, y: 10, duration: 0.18, ease: 'power2.in', stagger: 0.03 })
      .call(() => setActiveIdx(idx))
      .to(targets, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out', stagger: 0.04 });
  }, [activeIdx]);

  // entrance animation on mount
  useEffect(() => {
    const targets = [tagsRef.current, imgRef.current, titleRef.current, subtitleRef.current, bigNumRef.current];
    gsap.fromTo(targets, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06, delay: 0.2 });
  }, []);

  return (
    <section id="showcase" className="sc-wrap">

      {/* ── LEFT PANEL ── */}
      <div className="sc-left">
        {/* Vertical structural lines */}
        <div className="sc-vlines" aria-hidden="true">
          <span /><span /><span />
        </div>
        {/* Radial glow */}
        <div className="sc-glow" aria-hidden="true" />

        {/* Mockup frame */}
        <div className="sc-mockup-frame">
          {/* Title bar */}
          <div className="sc-mockup-bar">
            <div className="sc-mockup-tags" ref={tagsRef}>
              {active.tags.map((tag) => (
                <span key={tag} className="sc-mockup-tag">{tag}</span>
              ))}
            </div>
            <div className="sc-mockup-dots">
              <span /><span /><span />
            </div>
          </div>

          {/* Image body */}
          <div className="sc-mockup-body" ref={imgRef}>
            <Image
              src={`/${project.image}`}
              alt={project.title}
              fill
              className="sc-mockup-img"
              sizes="(max-width: 768px) 100vw, 60vw"
              priority
            />
            <div className="sc-mockup-overlay" />
            <div className="sc-mockup-info">
              <h2 className="sc-mockup-title" ref={titleRef}>{project.title}</h2>
              <p className="sc-mockup-subtitle" ref={subtitleRef}>{project.label}</p>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="sc-status-bar">
          <span>STATUS: <span className="sc-status-active">ACTIVE</span></span>
          <span>SYSTEM: OPTIMAL</span>
        </div>

        {/* CTA */}
        <div className="sc-cta-wrap">
          <button className="sc-cta" onClick={() => onOpenModal(active.key)}>
            VIEW PROJECT
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={16} height={16}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>

        {/* Giant faded number */}
        <span className="sc-big-num" aria-hidden="true" ref={bigNumRef}>{active.num}</span>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="sc-right">
        {/* Vertical structural lines */}
        <div className="sc-vlines sc-vlines-right" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="sc-grid">
          {stripMeta.map(({ key, num, tags }, idx) => {
            const p = projectData[key];
            const isActive = idx === activeIdx;
            return (
              <button
                key={key}
                className={`sc-card${isActive ? ' active' : ''}`}
                onClick={() => handleSelect(idx)}
                aria-label={`Select ${p.title}`}
              >
                <div className="sc-card-top">
                  <span className="sc-card-tag">{tags[0]}</span>
                </div>
                <div className="sc-card-img-wrap">
                  <Image src={`/${p.image}`} alt={p.title} fill className="sc-card-img" sizes="15vw" />
                </div>
                <div className="sc-card-bottom">
                  <span className="sc-card-num">{num}</span>
                  <div className="sc-card-dots">
                    <span className={isActive ? 'on' : ''} />
                    <span /><span />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </section>
  );
}
