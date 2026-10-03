'use client';

import Link from 'next/link';
import { projectData, type ProjectKey } from '@/lib/projects';
import { SOCIAL } from '@/lib/site';

/* Rendered with the page from the start (not lazy like the sections above
   it), so the server HTML always says who this is, who he has worked with,
   and links every case study: the rest of the homepage's text only arrives
   once the client has mounted it. */

const ICONS = {
  linkedin: (
    <>
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  github: (
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
  ),
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </>
  ),
};
const LABELS = { linkedin: 'LinkedIn', github: 'GitHub', instagram: 'Instagram' } as const;

export default function Footer() {
  const socials = (Object.keys(SOCIAL) as (keyof typeof SOCIAL)[]).filter((k) => SOCIAL[k]);
  return (
    <footer>
      <div className="footer-about">
        <p className="footer-bio">
          <strong>Ahnaf Hussain</strong> is Head of Web Development at{' '}
          <a href="https://www.aurixlab.com" target="_blank" rel="noopener">AurixLab</a>, a digital agency in
          Calgary, Alberta. He leads the team building WordPress, Shopify and Next.js websites, plus Python and
          AI tools, for clients including CPC Clinics, Merch Express (formerly Budget Promotion), LeadCraft IT
          Solutions and Vista Preservation.
        </p>
        {/* A div, not <nav>: the global nav{} rule is the fixed top navbar's. */}
        <div className="footer-work" role="navigation" aria-label="Case studies">
          <p className="footer-work-label">Case studies</p>
          <ul>
            {(Object.keys(projectData) as ProjectKey[]).map((key) => (
              <li key={key}>
                <Link href={`/projects/${key}`}>{projectData[key].title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer-inner">
        <p>
          Created by <span>Ahnaf Hussain</span>{' '}| Head of Web Development, AurixLab &copy; 2026
        </p>
        {socials.length > 0 && (
          <div className="social-links" style={{ margin: 0 }}>
            {socials.map((k) => (
              <a key={k} href={SOCIAL[k]} className="social-link" aria-label={LABELS[k]} target="_blank" rel="noopener me">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{ICONS[k]}</svg>
              </a>
            ))}
          </div>
        )}
        <button
          className="footer-back-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <svg fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
