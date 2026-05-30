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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('');
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
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
          if (en.isIntersecting) en.target.classList.add('visible');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
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
      <nav ref={navRef} id="navbar" className={scrolled ? 'scrolled' : ''}>
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
