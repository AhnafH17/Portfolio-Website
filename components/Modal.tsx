'use client';

import { useEffect, useRef } from 'react';
import { projectData, ProjectKey } from '@/lib/projects';

declare global {
  interface Window { __lenisEnabled?: boolean; }
}

interface ModalProps {
  projectKey: ProjectKey | null;
  onClose: () => void;
}

export default function Modal({ projectKey, onClose }: ModalProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectKey) {
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      window.__lenisEnabled = true;
      return;
    }

    const overlay = scrollAreaRef.current;
    if (overlay) overlay.scrollTop = 0;

    // Lock page scroll completely
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${sbWidth}px`;
    document.documentElement.style.overflow = 'hidden';
    window.__lenisEnabled = false;

    // Window capture listener — fires before Lenis's bubble listener.
    // For events from inside the modal: neutralise preventDefault so Lenis
    // can't block the overlay's native scroll, and manually drive scrollTop
    // as a fallback in case native scroll still doesn't apply.
    const onWheel = (e: WheelEvent) => {
      if (!overlay) return;
      const t = e.target as Node;
      if (t !== overlay && !overlay.contains(t)) return;
      e.preventDefault = () => {};  // stop Lenis from blocking native scroll
      const px = e.deltaMode === 1 ? e.deltaY * 16
               : e.deltaMode === 2 ? e.deltaY * window.innerHeight
               : e.deltaY;
      overlay.scrollTop += px;
    };
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
      window.__lenisEnabled = true;
    };
  }, [projectKey]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const project = projectKey ? projectData[projectKey] : null;

  return (
    <div
      className={`modal-overlay${project ? ' open' : ''}`}
      id="projectModal"
      ref={scrollAreaRef}
      data-lenis-prevent
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button className="modal-close" onClick={onClose} aria-label="Close">
        <svg fill="none" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth={2} />
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth={2} />
        </svg>
      </button>

      <div
        className="modal-scroll-area"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {project && (
          <div className="modal-container" id="modalContent">
            <div className="modal-header">
              <p className="section-label">{project.label}</p>
              <h2>{project.title}</h2>
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-link"
                >
                  Visit Live Site{' '}
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              )}
            </div>

            {project.image ? (
              <div className="modal-image-placeholder">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/${project.image}`} alt={`${project.title} project screenshot`} loading="lazy" />
              </div>
            ) : (
              <div className="modal-image-placeholder empty">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>{project.imagePlaceholder}</span>
              </div>
            )}

            {project.sections.map((s, idx) => (
              <div key={idx} className="modal-section">
                <h3>{s.heading}</h3>
                {s.type === 'results' && s.items && (
                  <div className="modal-results-grid">
                    {s.items.map((item, i) => (
                      <div key={i} className="modal-result-card">
                        <span className="big">{item.big}</span>
                        <span className="label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.type === 'tech' && s.tags && (
                  <div className="modal-tech-tags">
                    {s.tags.map((tag, i) => (
                      <span key={i} className="modal-tech-tag">{tag}</span>
                    ))}
                  </div>
                )}
                {!s.type && s.content && (
                  <div dangerouslySetInnerHTML={{ __html: s.content }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
