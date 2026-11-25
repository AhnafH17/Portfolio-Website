'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { ABOUT_STOPS, longestWord } from './about/stops';
import { hasWebGL } from '@/lib/webgl';

// Three.js only on the client, and only once this section mounts.
const WorkspaceCanvas = dynamic(() => import('./about/WorkspaceCanvas'), { ssr: false });

// Each word its own span, so the scene can bring them in one after another.
const words = (text: string) => text.split(' ').map((w, i, all) => (
  <span key={i}><span className="ab3-w">{w}</span>{i < all.length - 1 ? ' ' : ''}</span>
));

/* About: the 3D scene tells the whole section. It pins, centred, and the
   camera tours the island as you scroll (components/about/stops.ts).

   Each stop's words are real text laid over the scene, on the side the
   camera leaves free (WorkspaceCanvas frames the subject beside them and
   brings the words in and out with the scroll). Under reduced motion or
   without WebGL the same text reads as a plain page. */
export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [noWebgl, setNoWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    // Set after mount: the server can't know, and the first paint shouldn't differ.
    const id = requestAnimationFrame(() => setNoWebgl(!hasWebGL()));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section id="about" ref={sectionRef} className={`ab3${noWebgl ? ' ab3--plain' : ''}`}>
      <div className="ab3-sticky" aria-hidden="true">
        {noWebgl === false && <WorkspaceCanvas sectionRef={sectionRef} veilRef={veilRef} edgeRef={edgeRef} copyRef={copyRef} />}
        <div ref={edgeRef} className="ab3-edge" />
        <div ref={veilRef} className="ab3-veil" />
      </div>
      <div ref={copyRef} className="ab3-copy">
        {ABOUT_STOPS.map((stop, i) => {
          const Title = i === 0 ? 'h2' : 'h3';
          return (
            <div key={stop.id} className={`ab3-say ab3-say--${stop.side} ab3-say--${stop.id}`}
              style={{ '--chars': longestWord(stop.title) } as CSSProperties}>
              <Title className="ab3-say-title">{words(stop.title)}</Title>
              {stop.lines.map((line) => <p key={line} className="ab3-say-line">{words(line)}</p>)}
              {stop.chips && (
                <ul className="ab3-say-chips">
                  {stop.chips.map((c) => <li key={c}><span className="ab3-w">{c}</span></li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
