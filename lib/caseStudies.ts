import type { ProjectKey, ResultItem } from './projects';

/* The four flagship projects get a full case study: the problem and my role,
   the approach with real images, and the result in numbers. Facts only:
   everything here comes from the project entry in projects.ts or from the
   sourced figures behind the Impacts section. A figure belongs to the
   project it was measured on (14.8% CTR is LeadCraft's, not one of these). */

export interface CaseImage {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  /** Portrait images sit beside the previous image instead of full width. */
  tall?: boolean;
}

export interface CaseChart {
  title: string;
  caption: string;
  rows: { label: string; value: number; muted?: boolean }[];
}

export interface CaseStudy {
  /** One sentence under the title: what this was and what it did. */
  summary: string;
  problem: string;
  role: string;
  approach: { title: string; body: string }[];
  gallery: CaseImage[];
  chart?: CaseChart;
  outcome: string;
  metrics: ResultItem[];
}

export const CASE_STUDY_ORDER: ProjectKey[] = ['notion', 'dashboard', 'cpc', 'data'];

export const CASE_STUDIES: Partial<Record<ProjectKey, CaseStudy>> = {
  notion: {
    summary: 'An internal workspace that replaced Slack threads and spreadsheets for the 11-person AurixLab team, saving $220 a month on tooling.',
    problem: 'AurixLab ran client work across Slack threads and spreadsheets. That fragmentation was creating real operational drag: work was spread across tools, and the paid tooling around it cost $220 a month.',
    role: 'I identified the problem, architected the system and led its development as Head of Web Development.',
    approach: [
      { title: 'Model how an agency actually works', body: 'Projects and tasks with Kanban, Table and Calendar views, multi-assignee tasks, and a team-wide board for work outside any project. Five agency templates, from web development to video production, start each project with the right statuses, tags and priorities.' },
      { title: 'Make every change traceable', body: 'Every create, update and delete stores before-and-after snapshots for a full audit trail. Deleted work can be restored, and version checks stop two people silently overwriting each other.' },
      { title: 'Put AI where it saves reading', body: 'Claude summarises a task and its recent activity in plain English, writes a weekly digest for the team, and a daily check flags anyone carrying more than 30% of active tasks as a bottleneck risk.' },
      { title: 'Run it for nothing', body: 'Deployed on Vercel with a Supabase PostgreSQL database, with pooled connections for serverless runtime queries. No server to maintain and no monthly infrastructure bill.' },
    ],
    gallery: [
      { src: 'images/projects/notion.webp', alt: 'Mission Control dashboard showing ongoing projects, upcoming deadlines, the signed-in user’s tasks and a due-soon list', caption: 'The dashboard each team member lands on: their tasks, what’s due soon and the state of every project.', width: 900, height: 503 },
    ],
    outcome: 'Mission Control replaced the old tooling outright. All 11 people use it daily, and it costs nothing to run.',
    metrics: [
      { big: '11', label: 'People using it daily' },
      { big: '$220', label: 'Saved on tooling monthly' },
      { big: '$0', label: 'Monthly infrastructure' },
      { big: '5', label: 'Agency workflow templates' },
    ],
  },

  dashboard: {
    summary: 'A private reporting product that replaced monthly PDFs: each client signs in and sees their results in plain English, synced every 30 minutes.',
    problem: 'AurixLab reported results to clients as monthly PDFs and screenshots. They were static, out of date as soon as they were sent, and not written for people who aren’t marketers.',
    role: 'I designed and built the whole product, from the report experience to the sync engine and security model.',
    approach: [
      { title: 'Lead with the verdict', body: 'The monthly report opens with a headline, a short lead and the key figures, then gives each channel its own page of depth. Every metric is explained where it appears, and every chart has a table view.' },
      { title: 'Keep the data fresh on its own', body: 'A Postgres pg_cron schedule calls the app every 30 minutes. A job queue with retries, backoff and idempotent upserts pulls from each provider through typed adapters, because Vercel Hobby’s cron only runs daily.' },
      { title: 'Treat client data as the product', body: 'Every client table carries a client id with Row Level Security, enforced again in a data-access layer and proven by pgTAP tests. Third-party APIs are only called from server code, and credentials are encrypted with AES-256-GCM.' },
      { title: 'Give staff a real back office', body: 'An admin area lets staff connect data sources, write the monthly commentary and watch integration health, behind password plus TOTP multi-factor sign-in.' },
    ],
    gallery: [
      { src: 'images/case/dashboard-report.webp', alt: 'Monthly report opening with the headline “October, best month on record” beside key figures for search, Instagram and email', caption: 'The report opens with the verdict, then the figures behind it. Demo client with sample data.', width: 1600, height: 843 },
      { src: 'images/case/dashboard-seo.webp', alt: 'Search page titled “How people found you on Google” with clicks, impressions, rankings and a monthly chart', caption: 'Each channel gets a plain-English page of its own. Demo client with sample data.', width: 1440, height: 728 },
      { src: 'images/case/dashboard-phone.webp', alt: 'Three phone screens of the report, the search page and the email page', caption: 'The whole report works on a phone. Demo client with sample data.', width: 900, height: 1331, tall: true },
    ],
    outcome: 'The dashboard runs for CPC Clinics and Merch Express. Manual PDF reports are gone, and the whole system costs $0 a month to run.',
    metrics: [
      { big: '2', label: 'Clients live' },
      { big: '30 min', label: 'Sync interval' },
      { big: '0', label: 'Manual PDF reports' },
      { big: '$0', label: 'Monthly running cost' },
    ],
  },

  cpc: {
    summary: 'A hacked Calgary psychology practice website, recovered and rebuilt: 40+ pages, a 95+ SEO score and 582K search impressions in six months.',
    problem: 'CPC Clinics’ website had suffered a serious breach. An outside party had taken over the admin account, Japanese spam was appearing in its Google results, and malicious database entries were redirecting visitors to spam sites. Underneath that, the site’s content and booking journey needed rebuilding.',
    role: 'I was responsible for the complete overhaul: the security recovery, the front end, the content architecture and the SEO.',
    approach: [
      { title: 'Take the site back', body: 'I recovered the admin account through the database, removed the unauthorised access, cleaned a backdoor in the core files, deleted the malware, stripped 395 lines of malicious code from functions.php, sanitised the database and submitted a security review through Google Search Console.' },
      { title: 'Rebuild the structure', body: '40+ service and workshop pages across counselling, assessments and workshops, a new About section, and a rebuilt homepage and contact flow, all aligned end to end around one path: book a free consultation.' },
      { title: 'Earn search back', body: 'A full on-page SEO pass across every page, from titles and heading hierarchy to internal linking and alt text, plus 11 blog posts targeting Calgary mental-health topics.' },
    ],
    gallery: [
      { src: 'images/case/cpc-homepage.webp', alt: 'CPC Clinics homepage with the headline “Real Support, Built Around You” and a Book a Free Consultation button', caption: 'The homepage, rebuilt around one action: book a free consultation.', width: 1440, height: 790 },
      { src: 'images/case/cpc-service.webp', alt: 'CPC Clinics Anxiety Therapy page with the headline “Steady Your Mind. Reclaim Your Days.”', caption: 'One of 40+ service pages, each written for the people searching for that help.', width: 1440, height: 900 },
      { src: 'images/case/cpc-phone.webp', alt: 'CPC Clinics homepage on a phone', caption: 'The same journey on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'The site went from compromised to a clean, fully rebuilt presence: Yoast green across every key SEO criterion, and 582K search impressions and 1.23K organic clicks in six months.',
    metrics: [
      { big: '582K', label: 'Search impressions in 6 months' },
      { big: '1.23K', label: 'Organic clicks in 6 months' },
      { big: '95+', label: 'SEO score' },
      { big: '40+', label: 'Pages created' },
    ],
  },

  data: {
    summary: 'A Python pipeline that sorted 10,925 Budget Promotion (now Merch Express) contacts into 9 business sectors for targeted email.',
    problem: 'Budget Promotion wanted targeted email campaigns but had one undifferentiated list of 10,900+ contacts. Most had almost no data, often just a name and a personal email, and Mailchimp’s campaign tags were actively misleading: “Back 2 School Clicks” made people look like schools.',
    role: 'I designed and built the classification pipeline end to end.',
    approach: [
      { title: 'Merge into one clean record', body: 'Three separate Mailchimp exports were loaded, standardised and deduplicated by primary email, then each contact got one normalised text field built from company, name, email domain, tags, notes and city.' },
      { title: 'Filter out false signals', body: 'Engagement tags like “Clicked Black Friday” were stripped before classification, because they described campaigns rather than customers and were inflating sectors such as Schools.' },
      { title: 'Score with weighted rules', body: 'Each sector has a weighted keyword dictionary, with company-name matches counting for more than tags, and a fixed priority order so ties always resolve the same way.' },
      { title: 'Be honest about uncertainty', body: 'Every contact carries a confidence score. Low-confidence rows (below 0.65) are routed to an AI fallback using Claude or flagged for review, rather than quietly treated as certain.' },
    ],
    gallery: [],
    chart: {
      title: 'Where 10,925 contacts landed',
      caption: 'Real totals from the rules pass. Contacts with no company data fall into Corporates, the catch-all, and are flagged for AI or manual review.',
      rows: [
        { label: 'Trades', value: 789 },
        { label: 'Non-Profits', value: 612 },
        { label: 'Schools', value: 486 },
        { label: 'Sports', value: 417 },
        { label: 'Retail', value: 307 },
        { label: 'Events', value: 234 },
        { label: 'Restaurants', value: 201 },
        { label: 'Camps', value: 142 },
        { label: 'Corporates (catch-all)', value: 7737, muted: true },
      ],
    },
    outcome: 'A contact list nobody could target became a segmented master file. Rules alone placed 3,188 contacts in a specific sector, and the sparse remainder is clearly flagged rather than mislabelled.',
    metrics: [
      { big: '10,925', label: 'Contacts processed' },
      { big: '9', label: 'Business sectors' },
      { big: '3,188', label: 'Placed in a specific sector by rules' },
      { big: '5', label: 'Output deliverables' },
    ],
  },
};
