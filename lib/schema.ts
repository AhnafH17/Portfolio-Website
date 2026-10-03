import { SITE_URL, SOCIAL_URLS } from './site';
import { projectData, type ProjectKey } from './projects';
import { projectSeo, type Client } from './projectSeo';

/* Schema.org JSON-LD. Every node has an @id so pages can point at the same
   person and organisation instead of restating them. Facts only: no ratings,
   reviews or result figures (structured data must match visible content). */

export const PERSON_ID = `${SITE_URL}/#person`;
export const AURIXLAB_ID = 'https://www.aurixlab.com/#organization';
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const DESCRIPTION =
  'Ahnaf Hussain is Head of Web Development at AurixLab in Calgary. He leads a team building WordPress, Shopify and Next.js sites, plus Python and AI tools.';

/** Site-wide nodes: the person, his employer, and the site. */
export function rootGraph() {
  return [
    {
      '@type': 'Person',
      '@id': PERSON_ID,
      name: 'Ahnaf Hussain',
      url: SITE_URL,
      image: `${SITE_URL}/images/social/og-image.png`,
      description: DESCRIPTION,
      jobTitle: 'Head of Web Development',
      worksFor: { '@id': AURIXLAB_ID },
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'BRAC University', sameAs: 'https://en.wikipedia.org/wiki/BRAC_University' },
      address: { '@type': 'PostalAddress', addressLocality: 'Calgary', addressRegion: 'AB', addressCountry: 'CA' },
      knowsAbout: [
        'Web development', 'Technical leadership', 'Next.js', 'React', 'TypeScript', 'WordPress', 'Elementor',
        'Shopify', 'Liquid', 'Python', 'Machine learning', 'SEO', 'Technical SEO', 'Core Web Vitals',
        'Schema markup', 'GSAP', 'Three.js', 'WebGL', 'Supabase', 'PostgreSQL', 'AI integration',
      ],
      ...(SOCIAL_URLS.length ? { sameAs: SOCIAL_URLS } : {}),
    },
    {
      '@type': 'Organization',
      '@id': AURIXLAB_ID,
      name: 'AurixLab',
      url: 'https://www.aurixlab.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Calgary', addressRegion: 'AB', addressCountry: 'CA' },
      employee: { '@id': PERSON_ID },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Ahnaf Hussain',
      url: SITE_URL,
      inLanguage: 'en',
      publisher: { '@id': PERSON_ID },
    },
  ];
}

/** Homepage: a profile page about the person, listing the case studies. */
export function homeGraph() {
  const keys = Object.keys(projectData) as ProjectKey[];
  return [
    {
      '@type': 'ProfilePage',
      '@id': `${SITE_URL}/#profile`,
      url: SITE_URL,
      name: 'Ahnaf Hussain, Head of Web Development at AurixLab',
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: { '@id': PERSON_ID },
    },
    {
      '@type': 'ItemList',
      name: 'Case studies',
      itemListElement: keys.map((key, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/projects/${key}`,
        name: projectSeo[key].title,
      })),
    },
  ];
}

function clientNode(c: Client) {
  if (c.name === 'AurixLab') return { '@id': AURIXLAB_ID };
  return {
    '@type': c.type ?? 'Organization',
    name: c.name,
    ...(c.alternateName ? { alternateName: c.alternateName } : {}),
    ...(c.url ? { url: c.url } : {}),
  };
}

/** A case-study page: the page, the work it describes, and a breadcrumb. */
export function projectGraph(key: ProjectKey) {
  const p = projectData[key];
  const seo = projectSeo[key];
  const url = `${SITE_URL}/projects/${key}`;
  const workId = `${url}#work`;
  return [
    {
      '@type': 'WebPage',
      '@id': url,
      url,
      name: seo.title,
      description: seo.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': workId },
      author: { '@id': PERSON_ID },
      primaryImageOfPage: `${SITE_URL}/${p.image}`,
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': seo.workType,
      '@id': workId,
      name: p.title,
      description: seo.description,
      image: `${SITE_URL}/${p.image}`,
      ...(p.link ? { url: p.link } : {}),
      creator: { '@id': PERSON_ID },
      ...(seo.viaAurixLab ? { producer: { '@id': AURIXLAB_ID } } : {}),
      ...(seo.client ? { sourceOrganization: clientNode(seo.client) } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ahnaf Hussain', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: p.title, item: url },
      ],
    },
  ];
}

/** Serialise for a <script type="application/ld+json">, safe against "</script>". */
export function jsonLd(graph: object[]) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\u003c');
}
