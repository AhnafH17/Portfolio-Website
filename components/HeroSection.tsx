'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/* The hero: a role line, the name huge behind a cut-out portrait, an orbit
   of light around both, and one call to action.

   Entrance (it starts as the preloader's bars open, i.e. when `paused`
   turns false): the backdrop, role line, orbit and button come in first;
   the portrait rises from below into place; as it lands, AHNAF slides in
   from the left and HUSSAIN from the right, behind it.

   The portrait is a cut-out of assets/hero-portrait-master.png
   (assets/hero-portrait-cutout.png: matted, edge colours decontaminated,
   lightly graded), served as AVIF with a WebP fallback at two widths. A rim
   light in the palette colour sits over it, masked by
   assets/hero-portrait-rim.png, so it reads as lit by the orbit and streaks.
   It's a plain <img> on purpose: next/image's pipeline made the photo soft.

   Motion layer: the backdrop, name, orbit, portrait and text drift at
   different depths with the pointer (a slow automatic drift on touch
   screens), and a glint of light runs round the orbit. */

export default function HeroSection({ paused = false }: { paused?: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const played = useRef(false);

  // Entrance, once, when the hero is revealed.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || paused || played.current) return;
    played.current = true;
    const q = (s: string) => root.querySelectorAll<HTMLElement | SVGElement>(s);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(q('.hx-in'), { opacity: 1, clearProps: 'transform,filter' });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // 1. Everything around the portrait.
    tl.fromTo(q('.hx-streak'), { opacity: 0 }, { opacity: 1, duration: 1.2, stagger: 0.12, ease: 'power2.out' }, 0);
    // The tracking settles to whatever the stylesheet sets (tighter on
    // phones), from 1.6x that.
    const roles = root.querySelector<HTMLElement>('.hx-roles');
    const track = roles ? parseFloat(getComputedStyle(roles).letterSpacing) || 0 : 0;
    tl.fromTo(roles, { opacity: 0, y: 10, letterSpacing: `${track * 1.6}px` }, { opacity: 1, y: 0, letterSpacing: `${track}px`, duration: 0.9, clearProps: 'letterSpacing' }, 0.05);
    tl.fromTo(q('.hx-rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0.1);
    tl.fromTo(q('.hx-cred'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.8 }, 0.22);
    tl.fromTo(q('.hx-orbit'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.1);
    tl.fromTo(q('.hx-orbit-path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0.1);
    tl.fromTo(q('.hx-cta'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.25);
    // 2. The portrait rises into place.
    tl.fromTo(q('.hx-photo'), { opacity: 0, yPercent: 38 }, { opacity: 1, yPercent: 0, duration: 1.05, ease: 'power3.out' }, 0.3);
    // 3. As it lands, the name slides in behind it.
    tl.fromTo(q('.hx-first'), { opacity: 0, xPercent: -14, filter: 'blur(10px)' }, { opacity: 1, xPercent: 0, filter: 'blur(0px)', duration: 0.95, ease: 'expo.out' }, 1.0);
    tl.fromTo(q('.hx-last'), { opacity: 0, xPercent: 14, filter: 'blur(10px)' }, { opacity: 1, xPercent: 0, filter: 'blur(0px)', duration: 0.95, ease: 'expo.out' }, 1.08);
    // 4. Then the rim light comes up and the glint starts round the orbit.
    tl.fromTo(q('.hx-rim'), { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 1.2);
    tl.fromTo(q('.hx-orbit-glint'), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.4);
    return () => { tl.kill(); };
  }, [paused]);

  // Depth: each layer drifts by its own amount with the pointer, so the
  // name, orbit and portrait separate. On touch screens there's no pointer,
  // so the scene drifts slowly on its own.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const layer = (sel: string) => root.querySelector<HTMLElement | SVGElement>(sel);
    // [element, x px, y px, rotate deg] at full deflection (pointer at an edge).
    const layers = [
      [layer('.hx-bg'), -10, -8, 0],
      [layer('.hx-name'), -30, -12, 0],
      [layer('.hx-orbit-wrap'), 16, 10, 2.2],
      [layer('.hx-photo-wrap'), 20, 9, 0],
      [layer('.hx-copy'), 8, 4, 0],
    ] as const;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = false;
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const tick = (now: number) => {
      if (!fine) {
        const t = now / 1000;
        tx = Math.sin(t * 0.35) * 0.45;
        ty = Math.sin(t * 0.27 + 1) * 0.3;
      }
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      for (const [el, ax, ay, rot] of layers) {
        if (el) el.style.transform = `translate3d(${(x * ax).toFixed(2)}px,${(y * ay).toFixed(2)}px,0)${rot ? ` rotate(${(x * rot).toFixed(3)}deg)` : ''}`;
      }
      if (on) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
    });
    io.observe(root);
    if (fine) window.addEventListener('pointermove', move, { passive: true });
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); };
  }, [paused]);

  const toWork = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector('#showcase');
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section id="hero" ref={rootRef} className="hx">
      {/* Light sweeping across the dark */}
      <div className="hx-bg" aria-hidden="true">
        <i className="hx-streak hx-streak-1 hx-in" />
        <i className="hx-streak hx-streak-2 hx-in" />
        <svg className="hx-streak hx-streak-lines hx-in" viewBox="0 0 1600 900" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hxLine" x1="0" x2="1">
              <stop offset="0" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0" />
              <stop offset="0.55" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0.55" />
              <stop offset="1" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M-40 520 C 260 380, 420 260, 760 -40" stroke="url(#hxLine)" strokeWidth="2" fill="none" />
          <path d="M760 940 C 1080 760, 1330 660, 1660 610" stroke="url(#hxLine)" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="hx-copy">
        <p className="hx-roles hx-in">
          <span className="hx-rule" aria-hidden="true" />
          <span>Developer</span><i aria-hidden="true">/</i><span>Creative</span><i aria-hidden="true">/</i><span>Product builder</span>
          <span className="hx-rule" aria-hidden="true" />
        </p>
        <p className="hx-cred hx-in">
          <span className="hx-cred-dot" aria-hidden="true" />
          <span>Head of Web Development <i aria-hidden="true">·</i> <strong>AurixLab</strong>, Calgary</span>
        </p>
      </div>

      <div className="hx-stage">
        <h1 className="hx-name">
          <span className="hx-first hx-in"><span className="hx-slant">Ahnaf</span></span>
          <span className="hx-last hx-in"><span className="hx-slant">Hussain</span></span>
        </h1>

        <div className="hx-orbit-wrap" aria-hidden="true">
          <svg className="hx-orbit hx-in" viewBox="0 0 1000 420">
            <defs>
              <linearGradient id="hxOrbit" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0.15" />
                <stop offset="0.35" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0.95" />
                <stop offset="0.7" style={{ stopColor: '#ffffff' }} stopOpacity="0.9" />
                <stop offset="1" style={{ stopColor: 'rgb(var(--accent-rgb))' }} stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <ellipse className="hx-orbit-path" cx="500" cy="210" rx="470" ry="150" pathLength={1}
              transform="rotate(-13 500 210)" stroke="url(#hxOrbit)" />
            {/* A glint of light running round the orbit */}
            <ellipse className="hx-orbit-glint" cx="500" cy="210" rx="470" ry="150" pathLength={1}
              transform="rotate(-13 500 210)" />
          </svg>
        </div>

        <div className="hx-photo-wrap">
          <div className="hx-photo hx-in">
            <picture>
              <source type="image/avif" srcSet="/images/hero/portrait-cutout-400.avif 400w, /images/hero/portrait-cutout-546.avif 546w" sizes="(max-width: 768px) 400px, 546px" />
              <source type="image/webp" srcSet="/images/hero/portrait-cutout-400.webp 400w, /images/hero/portrait-cutout-546.webp 546w" sizes="(max-width: 768px) 400px, 546px" />
              <img
                src="/images/hero/portrait-cutout-546.webp"
                alt="Ahnaf Hussain, Head of Web Development at AurixLab"
                width={546}
                height={757}
                fetchPriority="high"
                decoding="async"
              />
            </picture>
            {/* Rim light in the palette colour, along the silhouette */}
            <span className="hx-rim hx-in" aria-hidden="true" />
          </div>
        </div>
      </div>

      <a href="#showcase" className="hx-cta hx-in" onClick={toWork}>
        View my work
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15m0 0-5-5m5 5-5 5" />
        </svg>
      </a>
    </section>
  );
}
