import type { Metadata } from 'next';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import { DESCRIPTION, rootGraph, jsonLd } from '@/lib/schema';

/* Syne and DM Sans are self-hosted via @font-face in globals.css rather than
   next/font/google — see the note there. --font-display and --font-body are
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
        {/* Pick a random color palette before first paint (no flash), and
            preload the matching hero portrait. The preload has to live here
            because which file is needed isn't known until the palette is
            chosen — a static preload would fetch the wrong one. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=['crimson','teal','amber','purple'];var c=p[Math.floor(Math.random()*p.length)];document.documentElement.setAttribute('data-palette',c);var l=document.createElement('link');l.rel='preload';l.as='image';l.href='/images/hero/portrait-'+c+'.png';l.setAttribute('fetchpriority','high');document.head.appendChild(l);}catch(e){}})();`,
          }}
        />
        {/* The preloader traces this font's glyphs into particles on first
            frame — preload so it's ready before sampling. */}
        <link
          rel="preload"
          as="font"
          type="font/otf"
          href="/fonts/GreaterTheory.otf"
          crossOrigin="anonymous"
        />
        {/* Latin subsets of the body/display faces — next/font used to emit
            these preloads itself. latin-ext and italic stay lazy. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/DMSans-latin.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/Syne-latin.woff2" crossOrigin="anonymous" />
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
