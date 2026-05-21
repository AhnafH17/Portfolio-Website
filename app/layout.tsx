import type { Metadata } from 'next';
import { Syne, DM_Sans, Bebas_Neue } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-preloader',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

const DESCRIPTION =
  'Ahnaf Hussain is Head of Web Development at AurixLab — architecting high-performance SaaS frontends, interactive digital experiences, and leading a team that delivers world-class products.';

export const metadata: Metadata = {
  title: 'Ahnaf Hussain | Head of Web Development at AurixLab',
  description: DESCRIPTION,
  keywords: [
    'Ahnaf Hussain',
    'Head of Web Development',
    'AurixLab',
    'SaaS frontend developer',
    'technical lead',
    'web development team lead',
    'GSAP developer',
    'Next.js architect',
    'portfolio',
  ],
  authors: [{ name: 'Ahnaf Hussain' }],
  robots: { index: true, follow: true },
  metadataBase: new URL('https://ahnafhussain.vercel.app'),
  alternates: { canonical: 'https://ahnafhussain.vercel.app/' },
  openGraph: {
    title: 'Ahnaf Hussain | Head of Web Development at AurixLab',
    description: DESCRIPTION,
    url: 'https://ahnafhussain.vercel.app/',
    type: 'website',
    locale: 'en_CA',
    images: [{ url: '/OG_image__resized.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ahnaf Hussain | Head of Web Development at AurixLab',
    description: DESCRIPTION,
    images: ['/OG_image__resized.png'],
  },
};

const schemaOrg = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      name: 'Ahnaf Hussain',
      url: 'https://ahnafhussain.vercel.app',
      jobTitle: 'Head of Web Development',
      worksFor: { '@type': 'Organization', name: 'AurixLab', url: 'https://www.aurixlab.com' },
      alumniOf: { '@type': 'EducationalOrganization', name: 'BRAC University' },
      knowsAbout: ['WordPress', 'Shopify', 'Python', 'SEO', 'Data Science', 'Web Development'],
      address: { '@type': 'PostalAddress', addressLocality: 'Calgary', addressRegion: 'AB', addressCountry: 'CA' },
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      name: 'Ahnaf Hussain Portfolio',
      url: 'https://ahnafhussain.vercel.app',
    },
    {
      '@type': 'ItemList',
      name: 'Portfolio Projects',
      itemListElement: [
        { '@type': 'ListItem', position: 1, item: { '@type': 'CreativeWork', name: 'CPC Clinics Website Redesign', description: 'Full website redesign including 20+ service pages, security remediation, and SEO optimization achieving 90+ scores.', url: 'https://cpcclinics.ca/' } },
        { '@type': 'ListItem', position: 2, item: { '@type': 'CreativeWork', name: 'Budget Promotion Shopify Development', description: 'Full-stack Shopify development including product customization, Printavo integration, and performance optimization.', url: 'https://budgetpromotion.ca/' } },
        { '@type': 'ListItem', position: 3, item: { '@type': 'CreativeWork', name: 'Image Resizer Studio', description: 'Browser-based image compression and resizing tool with batch processing and ZIP download.', url: 'https://ahnaf-image-resizer.netlify.app/' } },
        { '@type': 'ListItem', position: 4, item: { '@type': 'CreativeWork', name: 'AurixLab SEO Optimization', description: 'Comprehensive SEO strategy for Calgary market.', url: 'https://www.aurixlab.com/' } },
        { '@type': 'ListItem', position: 5, item: { '@type': 'CreativeWork', name: 'Customer Segmentation Engine', description: 'Python ML pipeline classifying 10,900+ customers into 9 sectors using embeddings and cosine similarity.' } },
        { '@type': 'ListItem', position: 6, item: { '@type': 'CreativeWork', name: 'CPC Revive', description: "Four-page WordPress build for CPC Clinics' premium mental wellness and performance program arm.", url: 'https://cpcclinics.ca/revive/' } },
        { '@type': 'ListItem', position: 7, item: { '@type': 'CreativeWork', name: 'Mission Control', description: 'Full-stack internal project and task management system for an 11-person digital agency, built with Next.js, Prisma, Supabase, and Claude AI integration.' } },
        { '@type': 'ListItem', position: 8, item: { '@type': 'CreativeWork', name: 'LeadCraft IT Solutions', description: 'Full 5-page WordPress/Elementor website for a US+Bangladesh ITES/BPO company, featuring WebGL shaders, GSAP animations, Lenis smooth scroll, Globe.gl visualization, and Swiper carousel.', url: 'https://www.leadcraftit.com/' } },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${bebasNeue.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
