'use client';

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';

interface AccordionHeroProps {
  onOpenModal: (key: ProjectKey) => void;
}

export default function AccordionHero({ onOpenModal }: AccordionHeroProps) {
  const showcaseRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([]);

  const N = stripMeta.length;
  const FLEX_MIN = 1;
  const FLEX_MAX = 7;
  const HALF_WIDTH = 0.18;

  const isMobile = () => window.innerWidth <= 900;

  function smoothstep(t: number) {
    return t * t * (3 - 2 * t);
  }

  function stripCenter(i: number) {
    return i / (N - 1);
  }

  function getFlexForStrip(i: number, progress: number) {
    const center = stripCenter(i);
    const dist = Math.abs(progress - center);
    if (dist >= HALF_WIDTH) return FLEX_MIN;
    const t = smoothstep(1 - dist / HALF_WIDTH);
    return FLEX_MIN + (FLEX_MAX - FLEX_MIN) * t;
  }

  const lastIdxRef = useRef(-1);

  const setActive = useCallback(
    (idx: number) => {
      const strips = stripRefs.current;
      strips.forEach((s, i) => {
        if (!s) return;
        s.style.flex = '';
        s.classList.toggle('active', i === idx);
      });
      if (hintRef.current && idx >= 0) {
        hintRef.current.textContent = idx + 1 + ' / ' + N;
      }
    },
    [N]
  );

  const onScroll = useCallback(() => {
    if (isMobile()) return;
    const showcase = showcaseRef.current;
    if (!showcase) return;

    const rect = showcase.getBoundingClientRect();
    const total = showcase.offsetHeight - window.innerHeight;
    const scrolled = Math.max(0, Math.min(1, -rect.top / total));

    if (scrollHintRef.current) {
      scrollHintRef.current.classList.toggle('hidden', scrolled > 0.02);
    }
    if (progressRef.current) {
      progressRef.current.style.width = scrolled * 100 + '%';
    }

    const strips = stripRefs.current;
    strips.forEach((strip, i) => {
      if (!strip) return;
      const f = getFlexForStrip(i, scrolled);
      strip.style.flex = String(f);
      const isActive = f > FLEX_MIN + (FLEX_MAX - FLEX_MIN) * 0.5;
      strip.classList.toggle('active', isActive);
    });

    const nearestIdx = Math.round(scrolled * (N - 1));
    if (nearestIdx !== lastIdxRef.current) {
      lastIdxRef.current = nearestIdx;
      if (hintRef.current) {
        hintRef.current.textContent = nearestIdx + 1 + ' / ' + N;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isMobile()) {
      if (prefersReduced) {
        setActive(0);
      } else {
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
    } else {
      setActive(0);
    }

    const onResize = () => {
      if (isMobile()) {
        setActive(0);
      } else {
        onScroll();
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [onScroll, setActive]);

  // Desktop hover
  useEffect(() => {
    const strips = stripRefs.current;

    const enterHandlers: (() => void)[] = [];
    const focusHandlers: (() => void)[] = [];

    strips.forEach((strip, i) => {
      if (!strip) return;
      const onEnter = () => { if (!isMobile()) setActive(i); };
      const onFocus = () => { if (!isMobile()) setActive(i); };
      strip.addEventListener('mouseenter', onEnter);
      strip.addEventListener('focus', onFocus);
      enterHandlers[i] = onEnter;
      focusHandlers[i] = onFocus;
    });

    const track = trackRef.current;
    const onLeave = () => {
      if (!isMobile()) onScroll();
    };
    track?.addEventListener('mouseleave', onLeave);

    return () => {
      strips.forEach((strip, i) => {
        if (!strip) return;
        strip.removeEventListener('mouseenter', enterHandlers[i]);
        strip.removeEventListener('focus', focusHandlers[i]);
      });
      track?.removeEventListener('mouseleave', onLeave);
    };
  }, [onScroll, setActive]);

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
    const strip = stripRefs.current[idx];
    if (isMobile() || strip?.classList.contains('active')) {
      onOpenModal(key);
    }
  };

  return (
    <section id="showcase" ref={showcaseRef}>
      <div className="acc-showcase-sticky" id="accSticky">
        <div className="acc-progress-bar" ref={progressRef} id="accProgressBar" />

        <div className="acc-header">
          <span className="acc-header-label">Selected Work</span>
          <span className="acc-header-hint" id="accHint" ref={hintRef}>1 / {N}</span>
        </div>

        <div className="acc-track-wrap">
          <div className="acc-track" id="accTrack" ref={trackRef}>
            {stripMeta.map(({ key, num, tags }, idx) => {
              const project = projectData[key];
              return (
                <div
                  key={key}
                  className="acc-strip"
                  data-key={key}
                  ref={(el) => { stripRefs.current[idx] = el; }}
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
                    sizes="(max-width: 900px) 72vw, 15vw"
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
                      <h2 className="acc-title">{project.title}</h2>
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

        <div className="acc-scroll-hint" ref={scrollHintRef} id="accScrollHint">
          <span>Scroll</span>
          <svg fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </section>
  );
}
