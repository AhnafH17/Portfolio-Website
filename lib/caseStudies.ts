import type { ProjectKey, ResultItem } from './projects';

/* Every project gets a full case study: the problem and my role, the approach
   with real images, and the result in numbers. Facts only:
   everything here comes from the project entry in projects.ts or from the
   sourced figures behind the Impacts section. A figure belongs to the
   project it was measured on. */

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
  /** Describes the header image. */
  heroAlt: string;
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

export const CASE_STUDY_ORDER: ProjectKey[] = ['notion', 'dashboard', 'cpc', 'data', 'bp', 'urbandecant', 'leadcraft', 'scripting', 'revive', 'aurix', 'resizer'];

export const CASE_STUDIES: Partial<Record<ProjectKey, CaseStudy>> = {
  notion: {
    heroAlt: 'Mission Control dashboard with task lists and project counters',
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
    heroAlt: 'Client reporting dashboard showing how people found a business on Google',
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
    heroAlt: 'CPC Clinics website shown on a screen',
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
    heroAlt: 'Illustration of contacts flowing through a data pipeline',
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

  scripting: {
    heroAlt: 'Scripting Engine overview screen showing the loop from brand to learning',
    summary: 'A closed-loop creative tool for short-form marketing teams: it writes brand-aware scripts, then learns from review feedback and campaign results.',
    problem: 'Short-form content work is usually split across separate tools for research, writing, posting and reporting. Scripts get written, posted and forgotten, so what actually performed never shapes the next one.',
    role: 'I’m building the product: the AI workflows, the API and the operator dashboard. It’s a private workspace, with a wider content operating system as the next phase.',
    approach: [
      { title: 'Write with the brand in the room', body: 'A LangGraph pipeline classifies the brief, loads brand context, retrieves weighted examples, generates hooks, writes the body, creates CTA options and runs a critic pass before formatting the final script.' },
      { title: 'Learn after the post goes out', body: 'A separate workflow accepts campaign metrics days or weeks later, scores performance, updates hook and CTA rankings, and promotes strong scripts into templates.' },
      { title: 'Keep people in charge', body: 'Script import, editable versions, review states and reviewer feedback sit around the AI, and approved brand knowledge is what it’s allowed to draw on.' },
      { title: 'Learn at the application layer', body: 'The system doesn’t fine-tune Gemini. Improvement comes from ranked assets, human feedback and campaign results, with Zod-validated outputs keeping each step structured.' },
    ],
    gallery: [
      { src: 'images/projects/scripting.webp', alt: 'Scripting Engine overview screen with a six-step loop from brand to learning, a script in progress and scheduled posts', caption: 'The loop in one view: brand, idea, script, post, metrics and learning. Sample data.', width: 1600, height: 900 },
      { src: 'images/case/scripting-login.webp', alt: 'Scripting Engine sign-in page reading “Create. Publish. Measure. Improve.”', caption: 'The private workspace’s sign-in page. Scripts, results and brand memory stay behind one login.', width: 1440, height: 900 },
    ],
    outcome: 'Two LangGraph workflows now cover generation and delayed learning, across nine core API areas, with a dashboard for daily use. The expansion into a full content operating system comes next.',
    metrics: [
      { big: '2', label: 'LangGraph workflows' },
      { big: '9', label: 'Core API areas' },
    ],
  },

  revive: {
    heroAlt: 'CPC Revive hub page reading “A Clear Plan for Your Mental Wellness and Performance”',
    summary: 'The web presence for CPC Clinics’ premium program arm: four connected pages that turn structured wellness programs into a clear path to enrol.',
    problem: 'CPC Revive is built for people who want clarity and measurable outcomes rather than open-ended appointments. Its programs and rTMS treatment needed pages that explained a complex offer plainly and showed visible endpoints before anyone enrolled.',
    role: 'I designed and built all four pages in WordPress and Elementor, within the existing CPC Clinics brand system, and handled their structure and SEO.',
    approach: [
      { title: 'Connect the offer', body: 'A Revive hub carries the program overview, five-phase framework and comparison, and links out to the rTMS service page and two flagship programs: Executive Reset and Competitive Edge.' },
      { title: 'Show the endpoint first', body: 'Each program page follows the same five phases, from consultation to a maintenance plan, so people can see the whole journey before they start.' },
      { title: 'Make pricing conversations easy', body: 'Tiered structures (Starter, Pro and Elite) set out the scope and inclusions of each tier, for transparent pricing conversations.' },
      { title: 'Guide each stage', body: 'The rTMS page educates and pre-qualifies leads, targeted CTAs meet people at each stage, and SEO and internal linking tie the pages to the main CPC Clinics site.' },
    ],
    gallery: [
      { src: 'images/case/revive-program-hub.webp', alt: 'CPC Revive hub page with buttons to book a consultation and explore programs', caption: 'The Revive hub: the program overview and the two paths in.', width: 1440, height: 715 },
      { src: 'images/case/revive-rtms-page.webp', alt: 'Brain Stimulation Treatment page for rTMS in Calgary with a glowing brain illustration', caption: 'The rTMS service page educates and pre-qualifies leads.', width: 1440, height: 715 },
      { src: 'images/case/revive-phone.webp', alt: 'CPC Revive hub on a phone', caption: 'The hub on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'Four interconnected pages now take a visitor from understanding the treatment to choosing a program tier, all inside the existing CPC Clinics site.',
    metrics: [
      { big: '4', label: 'Pages built' },
      { big: '2', label: 'Flagship programs' },
      { big: '3', label: 'Tiers per program' },
      { big: '5', label: 'Phase framework' },
    ],
  },

  leadcraft: {
    heroAlt: 'LeadCraft IT homepage with a WebGL hero and a 3D globe',
    summary: 'A 5-page site for a US and Bangladesh BPO company, with a WebGL hero and animated globe, earning a 14.8% search click-through rate.',
    problem: 'LeadCraft IT Solutions serves enterprise clients in real estate and banking from offices in the US and Bangladesh. It needed a site with the presence to match those clients, showing two offices working as one operation.',
    role: 'I directed the development and led the technical strategy, architecting the WordPress and Elementor foundation and the integration of the animation and 3D work.',
    approach: [
      { title: 'Build on a maintainable base', body: 'WordPress and Elementor keep the site editable, with custom JS and CSS layers on top for everything a page builder can’t do.' },
      { title: 'Make the hero do the talking', body: 'An animated WebGL shader runs on the GPU behind the homepage hero, beside a Globe.gl world map with arcs linking the US and Bangladesh offices.' },
      { title: 'Give scrolling some weight', body: 'Lenis inertia scrolling is wired into GSAP ScrollTrigger for pinned sections, a parallax hero and staggered character-level text reveals.' },
      { title: 'Make it work as a business site', body: 'A filterable careers board with expandable job cards, tabbed service panels, and Organization, LocalBusiness and JobPosting schema for search.' },
    ],
    gallery: [
      { src: 'images/case/leadcraft-home.webp', alt: 'LeadCraft IT homepage hero reading “Scale Your Operations. Eliminate the Overhead.” beside a 3D globe', caption: 'The homepage: an animated WebGL background and the Globe.gl office map.', width: 1440, height: 900 },
      { src: 'images/case/leadcraft-phone.webp', alt: 'LeadCraft IT About page on a phone', caption: 'The About page on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'Over seven weeks in Google Search Console (Aug 10 to Sep 27, 2026), the site earned 101 clicks from 681 impressions, a 14.8% click-through rate, at an average position of 8.',
    metrics: [
      { big: '14.8%', label: 'Search click-through rate' },
      { big: '101', label: 'Search clicks in 7 weeks' },
      { big: '8', label: 'Average search position' },
      { big: '5', label: 'Pages built' },
    ],
  },

  bp: {
    heroAlt: 'Merch Express homepage reading “Budget Promotion is now Merch Express”',
    summary: 'The Shopify rebrand of Budget Promotion into Merch Express, along with the customisation tools and integrations behind the store.',
    problem: 'A Calgary promotional products company was changing its name and identity while running a live Shopify store with custom ordering. The rebrand had to change the whole front end without breaking the customiser, quotes and fulfilment behind it.',
    role: 'I led the technical and visual transition. Before the rebrand, I worked across the full stack on customisation tools, API integrations and performance.',
    approach: [
      { title: 'Rebuild the front end', body: 'A new hero with custom regional branding, a custom preloader, redesigned popular products, a Proof section with a moving SVG background and 3D cards, and a new process flow.' },
      { title: 'Rebuild the way through it', body: 'An updated header and footer, a custom-planned search bar, and collection pages across 9 industry and 9 custom apparel categories.' },
      { title: 'Make customisation dependable', body: 'A canvas-based tool lets customers upload artwork, position it on a product and preview it. Its rendering differed between Mac and Windows, so I debugged canvas, font and mouse handling until it matched.' },
      { title: 'Connect orders to production', body: 'A webhook architecture pushes Shopify orders into Printavo, including custom orders with uploaded artwork, alongside an AJAX cart and a quote system for bulk orders.' },
    ],
    gallery: [
      { src: 'images/case/merch-home.webp', alt: 'Merch Express homepage with the rebrand headline and client logos', caption: 'The rebranded homepage, with the seasonal treatment live at the time of capture.', width: 1440, height: 900 },
      { src: 'images/case/merch-phone.webp', alt: 'Merch Express homepage on a phone', caption: 'The same hero on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'The rebrand is live as Merch Express, with 18 collection pages rebuilt at a 95+ load speed score and a 90+ SEO score.',
    metrics: [
      { big: '18', label: 'Collection pages rebuilt' },
      { big: '95+', label: 'Load speed score' },
      { big: '90+', label: 'SEO score' },
    ],
  },

  aurix: {
    heroAlt: 'AurixLab homepage showing a 3D office scene with the AurixLab name',
    summary: 'A technical SEO overhaul for a Calgary digital marketing agency, competing in its own crowded local market.',
    problem: 'An agency that sells digital marketing has to be findable itself. AurixLab needed better visibility and performance in Calgary’s competitive digital marketing space, and its site needed proper technical foundations.',
    role: 'I ran the SEO overhaul: keyword research, on-page optimisation, structured data and performance work.',
    approach: [
      { title: 'Find winnable terms', body: 'Extensive keyword research across Calgary-specific digital marketing searches, looking for high-value terms with less competition.' },
      { title: 'Tighten every page', body: 'Meta titles, descriptions, heading hierarchy and internal linking optimised across the site, with canonical URLs, the sitemap and robots.txt set up properly.' },
      { title: 'Describe the business to search engines', body: 'Organization, LocalBusiness and Service schema in JSON-LD, mapping each service to the right schema.org type and validating it in Google’s Rich Results Test.' },
      { title: 'Fix what slowed it down', body: 'Image optimisation, render-blocking resources removed, and CLS and LCP improved.' },
    ],
    gallery: [
      { src: 'images/case/aurix-home.webp', alt: 'AurixLab homepage with a 3D office scene and a Let’s Talk button', caption: 'The site the work was done on.', width: 1440, height: 900 },
      { src: 'images/case/aurix-phone.webp', alt: 'AurixLab homepage on a phone', caption: 'The same page on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'The site reached a 90+ SEO score, with structured data live across its services.',
    metrics: [
      { big: '90+', label: 'SEO score' },
      { big: '3', label: 'Schema types live' },
    ],
  },

  resizer: {
    heroAlt: 'Image Resizer Studio with a drag-and-drop area and compression settings',
    summary: 'A free image compressor that runs entirely in the browser, so images never leave your device. Built and launched solo.',
    problem: 'Most online image resizers upload your files to a server, run slowly or add watermarks. I needed a fast, private tool for daily web development work, and no free option did that without a trade-off.',
    role: 'I designed, built and launched it independently, from idea to deployment.',
    approach: [
      { title: 'Keep it private by design', body: 'All processing happens in the browser through the Canvas API. There’s no backend, so images physically can’t leave the device.' },
      { title: 'Make the file the product', body: 'One portable HTML, CSS and JavaScript file with no frameworks, deployed on Netlify.' },
      { title: 'Show the trade-off live', body: 'Drag-and-drop uploads with preview thumbnails, pixel-level sizing with an aspect lock, and a quality slider with real-time file-size estimates.' },
      { title: 'Handle real workloads', body: 'Batch processing with a ZIP download through JSZip, and chunked rendering so files up to 20MB stay smooth.' },
    ],
    gallery: [
      { src: 'images/case/resizer-home.webp', alt: 'Image Resizer Studio interface with an upload area, preview and compression settings', caption: 'Upload, preview and compression settings on one screen.', width: 1440, height: 900 },
      { src: 'images/case/resizer-phone.webp', alt: 'Image Resizer Studio on a phone', caption: 'It works on a phone too.', width: 585, height: 996, tall: true },
    ],
    outcome: 'It’s live and free to use: a private tool that does the whole job in one browser tab.',
    metrics: [
      { big: '0', label: 'Images sent to a server' },
      { big: '20MB', label: 'Files handled smoothly' },
      { big: '1', label: 'HTML file, no backend' },
    ],
  },

  urbandecant: {
    heroAlt: 'Urbandecant storefront reading “A memory held in time” above a shelf of perfume bottles',
    summary: 'A live perfume decant store for Bangladesh, built end to end on Next.js and a self-hosted Medusa backend, taking real orders.',
    problem: 'A decant shop splits full bottles into small vials, so one perfume becomes several sizes at local prices. It needed a luxury feel, plus payments and delivery that work in Bangladesh.',
    role: 'I built the whole thing, from the storefront to the commerce backend, as the only developer.',
    approach: [
      { title: 'Make the first screen feel premium', body: 'A dark-and-gold storefront with an interactive 3D bottle hero in React Three Fiber, using compressed models loaded during the intro.' },
      { title: 'Sell decants the way people buy them', body: 'Sizes as instant-updating variants, a 6ml package builder, a mood-based Fragrance Finder and a cart drawer instead of a cart page.' },
      { title: 'Build checkout for Bangladesh', body: 'Cash on Delivery and manual bKash or Nagad with transaction IDs, plus a division selector with Dhaka-city and outside-Dhaka delivery rates.' },
      { title: 'Hand the shop to its owner', body: 'Medusa 2 with PostgreSQL on Render, a custom Cloudinary file provider so images survive server restarts, and a written guide for running the store from the admin.' },
    ],
    gallery: [
      { src: 'images/case/urbandecant-home.webp', alt: 'Urbandecant homepage with perfume bottles displayed in lit wooden arches', caption: 'The storefront’s opening shelf.', width: 1440, height: 900 },
      { src: 'images/case/urbandecant-phone.webp', alt: 'Urbandecant homepage on a phone', caption: 'The same shelf on a phone.', width: 585, height: 996, tall: true },
    ],
    outcome: 'Urbandecant is live and taking real orders, with the owner running products, orders and promotions from the admin.',
    metrics: [
      { big: 'Live', label: 'Taking real orders' },
      { big: '2', label: 'Local payment methods' },
      { big: '3D', label: 'Interactive bottle hero' },
      { big: '1', label: 'Developer, end to end' },
    ],
  },
};
