'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';

interface AccordionHeroProps {
  onOpenModal: (key: ProjectKey) => void;
}

export default function AccordionHero({ onOpenModal }: AccordionHeroProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const N = stripMeta.length;
  const isMobile = () => window.innerWidth <= 900;

  // Mobile drag scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let isDown = false;
    let startX = 0;
    let sl = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!isMobile()) return;
      isDown = true;
      track.classList.add('drag-mode');
      startX = e.pageX - track.offsetLeft;
      sl = track.scrollLeft;
    };
    const onMouseLeave = () => { isDown = false; track.classList.remove('drag-mode'); };
    const onMouseUp = () => { isDown = false; track.classList.remove('drag-mode'); };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      track.scrollLeft = sl - (e.pageX - track.offsetLeft - startX) * 1.4;
    };

    track.addEventListener('mousedown', onMouseDown);
    track.addEventListener('mouseleave', onMouseLeave);
    track.addEventListener('mouseup', onMouseUp);
    track.addEventListener('mousemove', onMouseMove);

    return () => {
      track.removeEventListener('mousedown', onMouseDown);
      track.removeEventListener('mouseleave', onMouseLeave);
      track.removeEventListener('mouseup', onMouseUp);
      track.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const handleStripClick = (e: React.MouseEvent, key: ProjectKey, idx: number) => {
    if ((e.target as Element).closest('.acc-cta')) return;
    if (isMobile() || idx === activeIdx) {
      onOpenModal(key);
    }
  };

  return (
    <section id="showcase">
      <div className="acc-showcase-sticky" id="accSticky">
        <div className="acc-header">
          <span className="acc-header-label">Selected Work</span>
          <span className="acc-header-hint">{activeIdx + 1} / {N}</span>
        </div>

        <div className="acc-track-wrap">
          <div className="acc-track" id="accTrack" ref={trackRef}>
            {stripMeta.map(({ key, num, tags }, idx) => {
              const project = projectData[key];
              return (
                <div
                  key={key}
                  className={`acc-strip${idx === activeIdx ? ' active' : ''}`}
                  data-key={key}
                  onMouseEnter={() => { if (!isMobile()) setActiveIdx(idx); }}
                  onClick={(e) => handleStripClick(e, key, idx)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${project.title} project`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenModal(key);
                    }
                  }}
                >
                  <Image
                    src={`/${project.image}`}
                    alt={project.title}
                    fill
                    className="acc-img"
                    sizes="(max-width: 900px) 72vw, (max-width: 1300px) 55vw, 700px"
                    priority={idx < 2}
                  />
                  <div className="acc-overlay" />

                  <div className="acc-collapsed-label">
                    <span className="acc-num">{num}</span>
                    <span className="acc-vtitle">{project.title}</span>
                  </div>

                  <div className="acc-info">
                    <div className="acc-info-top">
                      <span className="acc-info-num">{num}</span>
                      <div className="acc-info-tags">
                        {tags.map((tag) => (
                          <span key={tag} className="acc-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="acc-info-bottom">
                      <h3 className="acc-title">{project.title}</h3>
                      <button
                        className="acc-cta"
                        onClick={(e) => { e.stopPropagation(); onOpenModal(key); }}
                      >
                        View Project
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
