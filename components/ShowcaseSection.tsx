'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';
import gsap from 'gsap';
import BackgroundPaths from '@/components/BackgroundPaths';

interface ShowcaseSectionProps {
  onOpenModal: (key: ProjectKey) => void;
}

export default function ShowcaseSection({ onOpenModal }: ShowcaseSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [mobilePair, setMobilePair] = useState(0); // 0,2,4,6 — pair start index
  const imgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const bigNumRef = useRef<HTMLSpanElement>(null);
  const mobilePairRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const mobileFirstRender = useRef(true);

  const active = stripMeta[activeIdx];
  const project = projectData[active.key];
  const totalPairs = Math.ceil(stripMeta.length / 2);

  const getTargets = useCallback(() =>
    [imgRef.current, titleRef.current, subtitleRef.current, tagsRef.current, bigNumRef.current].filter(Boolean),
  []);

  const handleSelect = useCallback((idx: number) => {
    if (idx === activeIdx) return;
    const targets = getTargets();
    gsap.to(targets, { opacity: 0, y: -12, duration: 0.2, ease: 'power2.in', stagger: 0.025,
      onComplete: () => setActiveIdx(idx),
    });
  }, [activeIdx, getTargets]);

  // Fade in after activeIdx changes — double rAF ensures new image src is painted
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    let raf1: number, raf2: number;
    // Kill any in-flight tweens on the targets first
    const targets = getTargets();
    gsap.killTweensOf(targets);
    gsap.set(targets, { opacity: 0, y: 16 });
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        gsap.to(targets, { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out', stagger: 0.05 });
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [activeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMobilePrev = useCallback(() => {
    const newPair = (mobilePair - 2 + stripMeta.length) % stripMeta.length;
    gsap.to(mobilePairRef.current, { opacity: 0, x: 30, duration: 0.18, ease: 'power2.in',
      onComplete: () => setMobilePair(newPair),
    });
  }, [mobilePair]);

  const handleMobileNext = useCallback(() => {
    const newPair = (mobilePair + 2) % stripMeta.length;
    gsap.to(mobilePairRef.current, { opacity: 0, x: -30, duration: 0.18, ease: 'power2.in',
      onComplete: () => setMobilePair(newPair),
    });
  }, [mobilePair]);

  // Fade in mobile pair after mobilePair state changes
  useEffect(() => {
    if (mobileFirstRender.current) { mobileFirstRender.current = false; return; }
    const raf = requestAnimationFrame(() => {
      gsap.fromTo(mobilePairRef.current,
        { opacity: 0, x: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [mobilePair]);

  // Initial entrance animation
  useEffect(() => {
    const targets = getTargets();
    gsap.fromTo(targets, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06, delay: 0.2 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The two cards shown on mobile
  const pairA = stripMeta[mobilePair];
  const pairB = stripMeta[(mobilePair + 1) % stripMeta.length];
  const projA = projectData[pairA.key];
  const projB = projectData[pairB.key];
  const pairPage = Math.floor(mobilePair / 2) + 1;

  return (
    <section id="showcase" className="sc-wrap">

      <span className="sc-bg-desktop"><BackgroundPaths count={36} /></span>
      <span className="sc-bg-mobile"><BackgroundPaths count={14} /></span>
      <div className="sc-glow" aria-hidden="true" />

      {/* ── DESKTOP LEFT PANEL ── */}
      <div className="sc-left">
        <div className="sc-mockup-frame">
          <div className="sc-mockup-bar">
            <div className="sc-mockup-tags" ref={tagsRef}>
              {active.tags.map((tag) => (
                <span key={tag} className="sc-mockup-tag">{tag}</span>
              ))}
            </div>
            <div className="sc-mockup-dots"><span /><span /><span /></div>
          </div>

          <div className="sc-mockup-body" ref={imgRef}>
            <BackgroundPaths />
            <Image src={`/${project.image}`} alt={project.title} fill className="sc-mockup-img"
              sizes="(max-width: 768px) 100vw, 60vw" priority style={{ opacity: 0.82 }} />
            <div className="sc-mockup-overlay" />
            <div className="sc-mockup-info">
              <h2 className="sc-mockup-title" ref={titleRef}>{project.title}</h2>
              <p className="sc-mockup-subtitle" ref={subtitleRef}>{project.label}</p>
            </div>
            <button className="sc-cta" onClick={() => onOpenModal(active.key)}>
              VIEW PROJECT
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={16} height={16}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="sc-status-bar">
          <span>STATUS: <span className="sc-status-active">ACTIVE</span></span>
          <span>SYSTEM: OPTIMAL</span>
        </div>

        <div className="sc-bottom-row">
          <div className="sc-nav-arrows">
            <button className="sc-arrow-btn" onClick={() => handleSelect((activeIdx - 1 + stripMeta.length) % stripMeta.length)} aria-label="Previous project">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="sc-arrow-count">{String(activeIdx + 1).padStart(2,'0')} / {String(stripMeta.length).padStart(2,'0')}</span>
            <button className="sc-arrow-btn" onClick={() => handleSelect((activeIdx + 1) % stripMeta.length)} aria-label="Next project">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <span className="sc-big-num" aria-hidden="true" ref={bigNumRef}>{active.num}</span>
      </div>

      {/* ── MOBILE PANEL — 2 cards per page ── */}
      <div className="sc-mobile-panel">
        <div className="sc-mobile-pair" ref={mobilePairRef}>
          {[{ meta: pairA, proj: projA }, { meta: pairB, proj: projB }].map(({ meta, proj }, i) => (
            <button
              key={meta.key}
              className={`sc-mobile-card${activeIdx === mobilePair + i ? ' active' : ''}`}
              onClick={() => { handleSelect(mobilePair + i); onOpenModal(meta.key); }}
              aria-label={`View ${proj.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${proj.image}`} alt={proj.title} className="sc-mobile-card-img" loading="lazy" decoding="async" />
              <div className="sc-mobile-card-overlay" />
              <div className="sc-mobile-card-footer">
                <span className="sc-mobile-card-num">{meta.num}</span>
                <div>
                  <p className="sc-mobile-card-title">{proj.title}</p>
                  <div className="sc-mobile-tags">
                    {meta.tags.map((t) => <span key={t} className="sc-card-tag">{t}</span>)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="sc-mobile-bottom">
          <div className="sc-nav-arrows">
            <button className="sc-arrow-btn" onClick={handleMobilePrev} aria-label="Previous pair">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="sc-arrow-count">{String(pairPage).padStart(2,'0')} / {String(totalPairs).padStart(2,'0')}</span>
            <button className="sc-arrow-btn" onClick={handleMobileNext} aria-label="Next pair">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (desktop only) ── */}
      <div className="sc-right">
        <div className="sc-vlines sc-vlines-right" aria-hidden="true"><span /><span /><span /></div>
        <div className="sc-grid">
          {stripMeta.map(({ key, num, tags }, idx) => {
            const p = projectData[key];
            const isActive = idx === activeIdx;
            return (
              <button key={key} className={`sc-card${isActive ? ' active' : ''}`}
                onClick={() => { handleSelect(idx); onOpenModal(key); }} aria-label={`Select ${p.title}`}>
                <div className="sc-card-top">{tags.map((t) => <span key={t} className="sc-card-tag">{t}</span>)}</div>
                <div className="sc-card-img-wrap">
                  <Image src={`/${p.image}`} alt={p.title} fill className="sc-card-img" sizes="15vw" />
                </div>
                <div className="sc-card-bottom">
                  <span className="sc-card-num">{num}</span>
                  <div className="sc-card-dots">
                    <span className={isActive ? 'on' : ''} /><span /><span />
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
