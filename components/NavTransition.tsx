'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

export default function NavTransition() {
  const router = useRouter();

  useEffect(() => {
    (window as any).__navigate = (url: string) => {
      const bar     = document.getElementById('pt-bar') as HTMLDivElement | null;
      const content = document.querySelector<HTMLElement>('[data-site-content]');

      // 1. Gold loading bar fills to 70 %
      if (bar) {
        gsap.killTweensOf(bar);
        gsap.set(bar, { scaleX: 0, opacity: 1, transformOrigin: 'left center' });
        gsap.to(bar, { scaleX: 0.72, duration: 0.38, ease: 'power2.out' });
      }

      // 2. Page slides right + fades out
      if (content) {
        gsap.killTweensOf(content);
        gsap.to(content, {
          x: '7vw',
          opacity: 0,
          duration: 0.38,
          delay: 0.08,
          ease: 'power2.in',
          onComplete: () => {
            // 3. Bar completes to 100 % then fades
            if (bar) {
              gsap.to(bar, {
                scaleX: 1, duration: 0.12,
                onComplete: () => gsap.to(bar, { opacity: 0, duration: 0.25 }),
              });
            }
            router.push(url);
          },
        });
      } else {
        setTimeout(() => router.push(url), 450);
      }
    };

    return () => { delete (window as any).__navigate; };
  }, [router]);

  return (
    <div
      id="pt-bar"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0, left: 0,
        height: '2px',
        width: '100%',
        opacity: 0,
        background: 'linear-gradient(90deg,#c9a84c,#e2c973,#fff8c0)',
        zIndex: 99999,
        transformOrigin: 'left center',
        boxShadow: '0 0 10px rgba(226,201,115,0.7)',
        pointerEvents: 'none',
      }}
    />
  );
}
