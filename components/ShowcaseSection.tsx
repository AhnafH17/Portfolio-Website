'use client';

import { useState } from 'react';
import Image from 'next/image';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';

interface ShowcaseSectionProps {
  onOpenModal: (key: ProjectKey) => void;
}

export default function ShowcaseSection({ onOpenModal }: ShowcaseSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const active = stripMeta[activeIdx];
  const project = projectData[active.key];

  return (
    <section id="showcase" className="sc-wrap">
      {/* ── LEFT PANEL ── */}
      <div className="sc-left">
        <div className="sc-circuit" aria-hidden="true" />

        {/* Section heading */}
        <div className="sc-heading">
          <span className="sc-heading-label">Selected Work</span>
          <h2 className="sc-heading-title">Projects I&apos;ve <span>built &amp; led</span></h2>
        </div>

        {/* Mockup frame */}
        <div className="sc-mockup-frame">
          {/* Title bar */}
          <div className="sc-mockup-bar">
            <div className="sc-mockup-tags">
              {active.tags.map((tag) => (
                <span key={tag} className="sc-mockup-tag">{tag}</span>
              ))}
            </div>
            <div className="sc-mockup-dots">
              <span /><span /><span />
            </div>
          </div>

          {/* Image body */}
          <div className="sc-mockup-body">
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
              <h2 className="sc-mockup-title">{project.title}</h2>
              <p className="sc-mockup-subtitle">{project.label}</p>
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
          <button
            className="sc-cta"
            onClick={() => onOpenModal(active.key)}
          >
            VIEW PROJECT
            <span className="sc-cta-arrow">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} width={15} height={15}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </button>
        </div>

        {/* Giant faded number */}
        <span className="sc-big-num" aria-hidden="true">{active.num}</span>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="sc-right">
        <div className="sc-circuit sc-circuit-right" aria-hidden="true" />
        <div className="sc-grid">
          {stripMeta.map(({ key, num, tags }, idx) => {
            const p = projectData[key];
            const isActive = idx === activeIdx;
            return (
              <button
                key={key}
                className={`sc-card${isActive ? ' active' : ''}`}
                onClick={() => setActiveIdx(idx)}
                aria-label={`Select ${p.title}`}
              >
                <div className="sc-card-top">
                  <span className="sc-card-num">{num}</span>
                  <span className="sc-card-tag">{tags[0]}</span>
                </div>
                <div className="sc-card-img-wrap">
                  <Image
                    src={`/${p.image}`}
                    alt={p.title}
                    fill
                    className="sc-card-img"
                    sizes="15vw"
                  />
                </div>
                <div className="sc-card-bottom">
                  <div className="sc-card-dots">
                    <span className={isActive ? 'on' : ''} />
                    <span />
                    <span />
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
