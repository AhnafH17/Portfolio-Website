'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';

// Three.js only on the client, and only once this section mounts.
const WorkspaceCanvas = dynamic(() => import('./about/WorkspaceCanvas'), { ssr: false });

const SKILLS = ['WordPress', 'Next.js', 'TypeScript', 'Shopify', 'Python', 'SEO'];

const FOCUS = [
  { id: 'systems', title: 'Systems Architecture', icon: <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5 12 21l9-4.5" /> },
  { id: 'frontend', title: 'Frontend Standards', icon: <path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" /> },
  {
    id: 'team',
    title: 'Team Leadership',
    icon: <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19m16 0v-1.5a3.5 3.5 0 0 0-2.5-3.35M14.5 4.15a3.5 3.5 0 0 1 0 6.7M13 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />,
  },
];

export default function AboutSection() {
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <section id="about" className="ab3">
      {/* The 3D scene is the whole section's background; the copy sits on top. */}
      <div className="ab3-bg" aria-hidden="true">
        <WorkspaceCanvas stageRef={stageRef} />
      </div>
      <div className="ab3-inner">
        <div className="ab3-left reveal">
          <div className="ab3-label">
            <svg className="ab3-target" viewBox="0 0 150 52" aria-hidden="true">
              <path className="ab3-target-line" d="M46 26H150" />
              <path className="ab3-target-cross" d="M26 2v10M26 40v10M2 26h10M40 26h6" />
              <circle cx="26" cy="26" r="15" />
              <circle cx="26" cy="26" r="4" className="ab3-target-dot" />
            </svg>
            <p>About Me</p>
          </div>

          <h2 className="ab3-title">
            <span className="ab3-title-accent">Lead by role,</span>
            {/* Phones break it as "Architect / by craft." */}
            <span>Architect <br className="ab3-mbr" />by craft.</span>
          </h2>
          <span className="ab3-rule" aria-hidden="true" />

          <p className="ab3-name">Ahnaf Hussain</p>
          <p className="ab3-role">Head of Web Development at AurixLab</p>
          <p className="ab3-bio">I design scalable systems and lead teams building modern web products.</p>

          <ul className="ab3-focus">
            {FOCUS.map((f) => (
              <li key={f.id}>
                <span className="ab3-focus-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <span className="ab3-focus-title">{f.title}</span>
              </li>
            ))}
          </ul>

          <ul className="ab3-skills" aria-label="Skills">
            {SKILLS.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>

        {/* Empty placeholder: on phones the canvas fits the model into wherever
            this lands (between the focus cards and the skills); on desktop the
            model is framed across the right side. */}
        <div ref={stageRef} className="ab3-stage" aria-hidden="true" />
      </div>
    </section>
  );
}
