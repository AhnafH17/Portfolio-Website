import type { Metadata } from 'next';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import { DESCRIPTION, rootGraph, jsonLd } from '@/lib/schema';

/* Two typefaces: Greater Theory (display) and DM Sans (body), both
   self-hosted via @font-face in globals.css rather than next/font/google —
   see the note there. --font-display and --font-body are
   defined on :root, so nothing needs to be wired onto <html>. */

const TITLE = 'Ahnaf Hussain – Web Developer in Calgary | AurixLab';

export const metadata: Metadata = {
  // Case studies set their own title; the template adds the name after it.
  title: { default: TITLE, template: '%s | Ahnaf Hussain' },
  description: DESCRIPTION,
  keywords: [
    'Ahnaf Hussain',
    'Ahnaf Hussain AurixLab',
    'Ahnaf Hussain Calgary',
    'Head of Web Development AurixLab',
    'Next.js developer Calgary',
    'Shopify developer Calgary',
    'WordPress developer Calgary',
    'web developer Calgary',
    'CPC Clinics website',
    'Merch Express Shopify',
    'LeadCraft IT Solutions website',
  ],
  authors: [{ name: 'Ahnaf Hussain', url: SITE_URL }],
  creator: 'Ahnaf Hussain',
  robots: { index: true, follow: true },
  metadataBase: new URL(SITE_URL),
  // The homepage's canonical. Every case study overrides it with its own;
  // inherited, it told Google all nine were copies of the homepage.
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'Ahnaf Hussain',
    type: 'profile',
    locale: 'en_CA',
    images: [{ url: '/images/social/og-image.png', width: 1200, height: 630, alt: 'Ahnaf Hussain, Head of Web Development at AurixLab' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/social/og-image.png'],
  },
};

import NavTransition from '@/components/NavTransition';
import LenisProvider from '@/components/LenisProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the palette before first paint (no flash): crimson, or the colour
            the visitor chose this session with the Return key, or one forced
            with ?theme=red|teal|amber|purple (kept for the session). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=['crimson','teal','amber','purple'],d=document.documentElement,c='crimson';try{var a={red:'crimson',crimson:'crimson',teal:'teal',green:'teal',amber:'amber',gold:'amber',purple:'purple',magenta:'purple'};var q=(new URLSearchParams(location.search).get('theme')||'').toLowerCase();if(a[q]){c=a[q];sessionStorage.setItem('theme',c);}else{var s=sessionStorage.getItem('theme');if(p.indexOf(s)>=0)c=s;}}catch(e){}d.setAttribute('data-palette',c);})();`,
          }}
        />
        {/* The display face: the preloader's name and the hero's are set in
            it from the first frame. */}
        <link
          rel="preload"
          as="font"
          type="font/otf"
          href="/fonts/GreaterTheory.otf"
          crossOrigin="anonymous"
        />
        {/* Latin subset of the body face — next/font used to emit this
            preload itself. latin-ext and italic stay lazy. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/DMSans-latin.woff2" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(rootGraph()) }}
        />
      </head>
      <body>
        <LenisProvider />
        <NavTransition />
        {children}
      </body>
    </html>
  );
}
