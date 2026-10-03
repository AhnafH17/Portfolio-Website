/** The production origin. Shared by metadata, the sitemap and robots so the
    domain can't drift between them. */
export const SITE_URL = 'https://ahnafhussain.vercel.app';

/** Public profiles. Used for the footer/contact links and the structured
    data's `sameAs`, which is what ties this site to the person in search.
    Leave a value empty until it's real: empty ones are simply left out. */
export const SOCIAL = {
  linkedin: '',
  github: '',
  instagram: '',
};
export const SOCIAL_URLS = Object.values(SOCIAL).filter(Boolean);
