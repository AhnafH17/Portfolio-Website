'use client';

import { useEffect, useRef, useState } from 'react';

const navItems = [
  { href: '#hero', label: 'Home' },
  { href: '#showcase', label: 'Work' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('');
  const navRef = useRef<HTMLElement>(null);
  // Read inside the scroll handler, which is bound once
  const menuOpenRef = useRef(false);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.setProperty('overflow', 'hidden');
    return () => { document.body.style.setProperty('overflow', previous); };
  }, [menuOpen]);

  /* Hide on scroll down, reveal on scroll up. The threshold stops the bar
     flickering on the small jitter Lenis produces while easing, and it always
     comes back near the top so the logo is reachable. */
  useEffect(() => {
    let last = window.scrollY;
    const THRESHOLD = 6;

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);

      const delta = y - last;
      if (Math.abs(delta) < THRESHOLD) return;
      // The mobile menu covers the screen — never pull the close button away.
      if (!menuOpenRef.current) setHidden(delta > 0 && y > 140);
      last = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Nav active scroll-spy
  useEffect(() => {
    // Work is a point inside the desk pin. About and Contact mount lazily.
    const links = [...navItems].reverse();
    let frame = 0;
    const read = () => {
      frame = 0;
      const current = links.find(({ href }) => {
        const el = document.querySelector(href);
        return el && el.getBoundingClientRect().top <= 80;
      });
      setActiveHref(current?.href ?? '#hero');
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(read); };
    queue();
    window.addEventListener('scroll', queue, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', queue); };
  }, []);

  // Reveal observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('visible');
            obs.unobserve(en.target);   // revealed once; stop watching it
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const observeIn = (root: Element | Document) => {
      if (root instanceof Element && root.classList.contains('reveal')) obs.observe(root);
      root.querySelectorAll('.reveal:not(.visible)').forEach((el) => obs.observe(el));
    };

    observeIn(document);

    /* Sections below the fold are lazy and mount after the preloader hands
       over — long after this effect ran. A one-shot querySelectorAll misses
       them entirely and they stay stuck at opacity 0, so watch for anything
       added later too. */
    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        rec.addedNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) observeIn(n as Element);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { obs.disconnect(); mo.disconnect(); };
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    if (href === '#showcase' && e.detail === 0) {
      document.querySelector<HTMLAnchorElement>('#hero .dh-work')?.click();
      setMenuOpen(false);
      return;
    }
    const target = document.querySelector(href);
    if (target instanceof HTMLElement) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (window.__lenis) window.__lenis.scrollTo(target, { immediate: reduce });
      else target.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
    }
    setMenuOpen(false);
  };
  const handleNavKey = (e: React.KeyboardEvent<HTMLAnchorElement>, href: string) => {
    if (e.key !== 'Enter' || href !== '#showcase') return;
    const work = document.querySelector<HTMLAnchorElement>('#hero .dh-work');
    if (!work) return;
    e.preventDefault();
    work.click();
    setMenuOpen(false);
  };

  const toggleMenu = () => {
    setMenuOpen(open => !open);
  };

  return (
    <>
      <nav
        ref={navRef}
        id="navbar"
        className={`${scrolled ? 'scrolled' : ''}${hidden ? ' nav-hidden' : ''}`}
      >
        <div className="nav-logo">
          {/* The AH mark, in the display face (Greater Theory) like every
              other heading, so the site stays at two typefaces. */}
          <span className="nav-logo-mark" role="img" aria-label="Ahnaf Hussain">AH</span>
        </div>

        <ul className="nav-links">
          {navItems.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className={activeHref === href ? 'active' : ''}
                onClick={(e) => handleNavClick(e, href)}
                onKeyDown={(e) => handleNavKey(e, href)}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <button
          className={`menu-toggle${menuOpen ? ' active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
          aria-controls="mobile-navigation"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div id="mobile-navigation" className={`mobile-nav${menuOpen ? ' open' : ''}`} inert={!menuOpen}>
        {navItems.map(({ href, label }) => (
          <a key={href} href={href} onClick={(e) => handleNavClick(e, href)} onKeyDown={(e) => handleNavKey(e, href)}>
            {label}
          </a>
        ))}
      </div>
    </>
  );
}
