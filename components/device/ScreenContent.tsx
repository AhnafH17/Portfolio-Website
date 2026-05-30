'use client';

import { forwardRef } from 'react';

/**
 * The real "About Me" page that lives INSIDE the device screen.
 * Rendered via drei <Html transform> so it sits on the 3D display.
 * It does not scroll natively — its inner `scrollerRef` is translated by the
 * parent's useFrame based on scroll progress (one scroll driver = the page).
 *
 * `frameRef`    → outer screen bezel (we fade this in as the screen wakes)
 * `scrollerRef` → the tall content column we slide up
 */
interface Props {
  frameRef: React.Ref<HTMLDivElement>;
  scrollerRef: React.Ref<HTMLDivElement>;
  width: number;
  height: number;
}

const ScreenContent = forwardRef<HTMLDivElement, Props>(function ScreenContent(
  { frameRef, scrollerRef, width, height },
) {
  return (
    <div ref={frameRef} className="dv-screen" style={{ width, height }}>
      <div className="dv-screen-bar">
        <span className="dv-dot" style={{ background: '#ff5f57' }} />
        <span className="dv-dot" style={{ background: '#febc2e' }} />
        <span className="dv-dot" style={{ background: '#28c840' }} />
        <span className="dv-screen-url">ahnafhussain.dev / about</span>
      </div>

      <div ref={scrollerRef} className="dv-screen-scroll">
        <header className="dv-os-hero">
          <span className="dv-os-eyebrow">WHO I AM</span>
          <h3 className="dv-os-name">Ahnaf Hussain</h3>
          <p className="dv-os-role">Head of Web Development · AurixLab</p>
        </header>

        <section className="dv-os-block">
          <h4 className="dv-os-h">My Journey</h4>
          <p>
            I started out obsessed with how interfaces <em>feel</em> — the weight of a
            transition, the rhythm of a layout. That obsession turned into a career
            building high-performance frontends and interactive digital experiences.
          </p>
          <p>
            Today I lead the web team at AurixLab, shipping SaaS products and
            marketing sites that are fast, accessible, and a little bit unexpected.
          </p>
        </section>

        <section className="dv-os-block">
          <h4 className="dv-os-h">How I Work</h4>
          <ul className="dv-os-list">
            <li>Performance first — every animation earns its frame budget.</li>
            <li>Design and engineering aren&apos;t separate steps, they&apos;re one loop.</li>
            <li>Ship, measure, refine. Real devices over assumptions.</li>
            <li>Details are the product — the 1% nobody notices is why it feels right.</li>
          </ul>
        </section>

        <section className="dv-os-block">
          <h4 className="dv-os-h">Toolkit</h4>
          <div className="dv-os-tags">
            {['Next.js', 'React', 'TypeScript', 'GSAP', 'Three.js', 'WordPress', 'Shopify', 'Python', 'SEO'].map(
              (t) => (
                <span key={t} className="dv-os-tag">{t}</span>
              ),
            )}
          </div>
        </section>

        <footer className="dv-os-foot">Keep scrolling →</footer>
      </div>
    </div>
  );
});

export default ScreenContent;
