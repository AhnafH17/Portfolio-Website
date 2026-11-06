'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ABOUT_STOPS } from './about/stops';

// Three.js only on the client, and only once this section mounts.
const WorkspaceCanvas = dynamic(() => import('./about/WorkspaceCanvas'), { ssr: false });

/* About: the 3D scene tells the whole section. It pins, centred, and the
   camera tours the island as you scroll, with each stop's words floating in
   the scene (components/about/stops.ts).

   The same words are real text here too: visually hidden, for search engines
   and screen readers, and shown plainly under reduced motion or without
   WebGL. */
export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  useEffect(() => {
    // Set after mount: the server can't know, and the first paint shouldn't differ.
    const id = requestAnimationFrame(() => setNoWebgl(!('WebGLRenderingContext' in window)));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section id="about" ref={sectionRef} className={`ab3${noWebgl ? ' ab3--plain' : ''}`}>
      <div className="ab3-sticky" aria-hidden="true">
        {!noWebgl && <WorkspaceCanvas sectionRef={sectionRef} veilRef={veilRef} edgeRef={edgeRef} />}
        <div ref={edgeRef} className="ab3-edge" />
        <div ref={veilRef} className="ab3-veil" />
      </div>
      <div className="ab3-copy">
        <p>About Me</p>
        <h2>Lead by role, architect by craft.</h2>
        {ABOUT_STOPS.slice(1).map((stop) => (
          <div key={stop.id}>
            {stop.title && <h3>{stop.title}</h3>}
            {stop.lines.map((line) => <p key={line}>{line}</p>)}
            {stop.chips && <ul>{stop.chips.map((c) => <li key={c}>{c}</li>)}</ul>}
          </div>
        ))}
      </div>
    </section>
  );
}
