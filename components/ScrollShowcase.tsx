'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { projectData, stripMeta, ProjectKey } from '@/lib/projects';

gsap.registerPlugin(ScrollTrigger);

function excerpt(html: string, max = 155) {
  const plain = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > max ? plain.slice(0, max).replace(/\s+\S*$/, '') + '…' : plain;
}

export default function ScrollShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const router = useRouter();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cases = gsap.utils.toArray<HTMLElement>('.sv-case');

      cases.forEach((caseEl) => {
        const imgWrap = caseEl.querySelector<HTMLElement>('.sv-img-wrap');
        const img     = caseEl.querySelector<HTMLElement>('.sv-img');
        const info    = caseEl.querySelectorAll<HTMLElement>('.sv-anim');

        if (!imgWrap || !img) return;

        // ── Clip-path reveal from bottom ──
        gsap.fromTo(imgWrap,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.1, ease: 'power3.out',
            scrollTrigger: { trigger: caseEl, start: 'top 82%', toggleActions: 'play none none none' },
          }
        );

        // ── Image scale-in ──
        gsap.fromTo(img,
          { scale: 1.12 },
          {
            scale: 1,
            duration: 1.3, ease: 'power3.out',
            scrollTrigger: { trigger: caseEl, start: 'top 82%', toggleActions: 'play none none none' },
          }
        );

        // ── Parallax (scrub) ──
        gsap.to(img, {
          y: -55,
          ease: 'none',
          scrollTrigger: { trigger: caseEl, start: 'top bottom', end: 'bottom top', scrub: 1.4 },
        });

        // ── Text stagger ──
        if (info.length) {
          gsap.fromTo(info,
            { opacity: 0, y: 32 },
            {
              opacity: 1, y: 0,
              duration: 0.65, ease: 'power2.out',
              stagger: 0.1, delay: 0.15,
              scrollTrigger: { trigger: caseEl, start: 'top 78%', toggleActions: 'play none none none' },
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const navigate = (key: ProjectKey) => {
    (window as any).__overlayShow?.();
    setTimeout(() => router.push(`/projects/${key}`), 380);
  };

  return (
    <section id="showcase" ref={sectionRef} className="sv-wrap">

      {/* ── Section header ── */}
      <div className="sv-header">
        <span className="sv-header-label sv-anim-fast">SELECTED WORK</span>
        <span className="sv-header-line" aria-hidden="true" />
        <span className="sv-header-count sv-anim-fast">0{stripMeta.length}</span>
      </div>

      {/* ── Project list ── */}
      <div className="sv-list">
        {stripMeta.map(({ key, num, tags }, idx) => {
          const project = projectData[key];
          const flip    = idx % 2 === 1;
          const text    = excerpt(project.sections[0]?.content ?? '');

          return (
            <article key={key} className={`sv-case${flip ? ' sv-case-flip' : ''}`}>

              {/* Image */}
              <div className="sv-img-wrap" onClick={() => navigate(key)} aria-label={`Open ${project.title}`} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(key)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/${project.image}`} alt={project.title} className="sv-img" />
                <div className="sv-img-shade" aria-hidden="true" />
                <span className="sv-cross sv-tl" aria-hidden="true" />
                <span className="sv-cross sv-tr" aria-hidden="true" />
                <span className="sv-cross sv-bl" aria-hidden="true" />
                <span className="sv-cross sv-br" aria-hidden="true" />
              </div>

              {/* Info */}
              <div className="sv-info">
                <span className="sv-bg-num" aria-hidden="true">{num}</span>
                <span className="sv-divider sv-anim" />
                <div className="sv-tags sv-anim">
                  {tags.map((t) => <span key={t} className="sv-tag">{t}</span>)}
                </div>
                <h3 className="sv-title sv-anim">{project.title}</h3>
                <p className="sv-desc sv-anim">{text}</p>
                <button className="sv-btn sv-anim" onClick={() => navigate(key)}>
                  VIEW PROJECT
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} width={13} height={13}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>

            </article>
          );
        })}
      </div>
    </section>
  );
}
