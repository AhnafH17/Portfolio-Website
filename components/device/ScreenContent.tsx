'use client';

import {
  siNextdotjs, siReact, siTypescript, siGreensock,
  siThreedotjs, siWordpress, siShopify, siPython,
} from 'simple-icons';

const TOOLS = [siNextdotjs, siReact, siTypescript, siGreensock, siThreedotjs, siWordpress, siShopify, siPython];

/**
 * Real HTML/CSS rendered onto the device screen via drei <Html transform>.
 * No GPU texture uploads → smooth scrolling; the logo collage animates with
 * cheap CSS. `frameRef` controls fade-in (screen wake); `scrollerRef` is
 * translated by scroll progress in the parent's useFrame.
 */
export default function ScreenContent({
  frameRef,
  scrollerRef,
  width,
  height,
}: {
  frameRef: React.Ref<HTMLDivElement>;
  scrollerRef: React.Ref<HTMLDivElement>;
  width: number;
  height: number;
}) {
  return (
    <div ref={frameRef} className="dv-scr" style={{ width, height }}>
      <div className="dv-scr-bar">
        <span className="dv-scr-dot" style={{ background: '#ff5f57' }} />
        <span className="dv-scr-dot" style={{ background: '#febc2e' }} />
        <span className="dv-scr-dot" style={{ background: '#28c840' }} />
        <span className="dv-scr-url">ahnafhussain.dev / about</span>
      </div>

      <div ref={scrollerRef} className="dv-scr-scroll">
        <span className="dv-scr-eyebrow">WHO I AM</span>
        <h3 className="dv-scr-name">Ahnaf Hussain</h3>
        <div className="dv-scr-rule" />
        <p className="dv-scr-role">Head of Web Development · AurixLab</p>

        <h4 className="dv-scr-h">My Journey</h4>
        <p className="dv-scr-p">
          I started out obsessed with how interfaces <em>feel</em> — the weight of a
          transition, the rhythm of a layout. That obsession became a career building
          high-performance frontends and interactive experiences.
        </p>
        <p className="dv-scr-p">
          Today I lead the web team at AurixLab, shipping SaaS products and marketing
          sites that are fast, accessible, and a little bit unexpected.
        </p>

        <h4 className="dv-scr-h">How I Work</h4>
        <ul className="dv-scr-list">
          <li>Performance first — every animation earns its frame budget.</li>
          <li>Design and engineering are one loop, not two steps.</li>
          <li>Ship, measure, refine. Real devices over assumptions.</li>
          <li>The details are the product.</li>
        </ul>

        <h4 className="dv-scr-h">Toolkit</h4>
        <div className="dv-scr-collage">
          {TOOLS.map((t, i) => (
            <span
              key={t.slug}
              className="dv-scr-tool"
              style={{ animationDelay: `${(i % 5) * 0.4}s` }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
                <path d={t.path} />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
