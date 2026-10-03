import type { ProjectKey } from './projects';

/* Search-facing copy and structured-data facts for each case study, kept apart
   from the on-page content in projects.ts. Titles name the client so a search
   like "CPC Clinics website" can surface the case study; descriptions are
   written whole (the old ones were the overview cut mid-word at 160 chars).
   Facts only: every claim here is stated in the matching case study. */

export interface Client {
  name: string;
  url?: string;
  alternateName?: string;
  /** schema.org type for the client organisation. */
  type?: 'Organization' | 'MedicalOrganization' | 'Corporation';
}

export interface ProjectSeo {
  title: string;
  description: string;
  /** What the work is, for structured data: a live site, an app, or neither. */
  workType: 'WebSite' | 'WebApplication' | 'CreativeWork';
  /** Who the work was for (schema.org `sourceOrganization`). */
  client?: Client;
  /** Delivered through AurixLab (schema.org `producer`). */
  viaAurixLab: boolean;
}

const AURIXLAB: Client = { name: 'AurixLab', url: 'https://www.aurixlab.com' };
const CPC: Client = { name: 'CPC Clinics', url: 'https://cpcclinics.ca', type: 'MedicalOrganization' };
const MERCH: Client = { name: 'Merch Express', alternateName: 'Budget Promotion', url: 'https://budgetpromotion.ca' };

export const projectSeo: Record<ProjectKey, ProjectSeo> = {
  notion: {
    title: "Mission Control: AurixLab's Next.js Project Manager",
    description: 'Case study: Mission Control, the Next.js and Supabase project and task manager Ahnaf Hussain architected for the 11-person AurixLab team in Calgary.',
    workType: 'WebApplication',
    client: AURIXLAB,
    viaAurixLab: true,
  },
  scripting: {
    title: 'Scripting Engine: AI Short-Form Script Generator',
    description: 'Case study: an AI creative-operations engine by Ahnaf Hussain that writes brand-aware short-form scripts and learns from review feedback and campaign results.',
    workType: 'WebApplication',
    viaAurixLab: false,
  },
  revive: {
    title: 'CPC Revive Website: WordPress Build for CPC Clinics',
    description: "How Ahnaf Hussain built CPC Clinics' Revive program pages in WordPress: the Revive hub, the rTMS brain stimulation service page and two flagship programs.",
    workType: 'WebSite',
    client: CPC,
    viaAurixLab: true,
  },
  leadcraft: {
    title: 'LeadCraft IT Solutions Website: WordPress, GSAP & WebGL',
    description: 'LeadCraft IT Solutions case study: a 5-page WordPress site with a WebGL hero, GSAP scroll animation and a Globe.gl world map, led by Ahnaf Hussain.',
    workType: 'WebSite',
    client: { name: 'LeadCraft IT Solutions', url: 'https://www.leadcraftit.com' },
    viaAurixLab: false,
  },
  data: {
    title: 'Budget Promotion Customer Segmentation (Python + AI)',
    description: "The Python classification pipeline Ahnaf Hussain built to sort Budget Promotion's (now Merch Express) 10,900+ contacts into 9 sectors for targeted email.",
    workType: 'CreativeWork',
    client: MERCH,
    viaAurixLab: true,
  },
  cpc: {
    title: 'CPC Clinics Website Redesign, SEO & Malware Cleanup',
    description: 'CPC Clinics case study: a Calgary psychology practice website overhaul by Ahnaf Hussain, with 40+ service pages, a security breach fixed and a 95+ SEO score.',
    workType: 'WebSite',
    client: CPC,
    viaAurixLab: true,
  },
  bp: {
    title: 'Merch Express (Budget Promotion) Shopify Rebrand',
    description: 'Merch Express (formerly Budget Promotion) Shopify case study: the rebrand front end, product customization tools and API integrations, by Ahnaf Hussain.',
    workType: 'WebSite',
    client: MERCH,
    viaAurixLab: true,
  },
  aurix: {
    title: 'AurixLab Technical SEO: Schema & Core Web Vitals',
    description: 'How Ahnaf Hussain ran the SEO overhaul for AurixLab, a Calgary agency: keyword research, on-page optimization, JSON-LD schema and Core Web Vitals.',
    workType: 'CreativeWork',
    client: AURIXLAB,
    viaAurixLab: true,
  },
  resizer: {
    title: 'Image Resizer Studio: Free Private Image Compressor',
    description: 'A free batch image resizer and compressor that runs entirely in your browser, so images never leave your device. Built and launched by Ahnaf Hussain.',
    workType: 'WebApplication',
    viaAurixLab: false,
  },
};
