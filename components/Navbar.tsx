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
  menuOpenRef.current = menuOpen;

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
    const links = navItems.map((i) => i.href.replace('#', ''));

    const handler = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = (en.target as HTMLElement).dataset.navId || en.target.id;
          setActiveHref('#' + id);
        }
      });
    };

    const obs = new IntersectionObserver(handler, {
      threshold: 0.01,
      rootMargin: '-60px 0px 0px 0px',
    });

    // showcase: observe the sticky inner div
    const accSticky = document.getElementById('accSticky');
    if (accSticky) {
      accSticky.dataset.navId = 'showcase';
      obs.observe(accSticky);
    }

    links
      .filter((id) => id !== 'showcase')
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) obs.observe(el);
      });

    return () => obs.disconnect();
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
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
    document.body.style.overflow = '';
  };

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    document.body.style.overflow = next ? 'hidden' : '';
  };

  return (
    <>
      <nav
        ref={navRef}
        id="navbar"
        className={`${scrolled ? 'scrolled' : ''}${hidden ? ' nav-hidden' : ''}`}
      >
        <div className="nav-logo">
          <svg
            viewBox="0 0 64 40"
            width="64"
            height="40"
            aria-label="Ahnaf Hussain"
            className="nav-logo-img"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <text
              x="2"
              y="32"
              fontFamily="'Georgia', serif"
              fontSize="36"
              fontWeight="700"
              letterSpacing="-1"
              fill="url(#logoGrad)"
            >AH</text>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" style={{ stopColor: 'var(--accent-glow)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--accent)' }} />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <ul className="nav-links">
          {navItems.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className={activeHref === href ? 'active' : ''}
                onClick={(e) => handleNavClick(e, href)}
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
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`mobile-nav${menuOpen ? ' open' : ''}`}>
        {navItems.map(({ href, label }) => (
          <a key={href} href={href} onClick={(e) => handleNavClick(e, href)}>
            {label}
          </a>
        ))}
      </div>
    </>
  );
}
