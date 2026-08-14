export interface ResultItem {
  big: string;
  label: string;
}

export interface ProjectSection {
  heading: string;
  content?: string;
  type?: 'results' | 'tech';
  items?: ResultItem[];
  tags?: string[];
}

export interface Project {
  label: string;
  title: string;
  link: string | null;
  image: string;
  imagePlaceholder: string;
  sections: ProjectSection[];
}

export type ProjectKey =
  | 'notion'
  | 'scripting'
  | 'revive'
  | 'leadcraft'
  | 'data'
  | 'cpc'
  | 'bp'
  | 'aurix'
  | 'resizer';

export const projectData: Record<ProjectKey, Project> = {
  notion: {
    label: 'Project 01',
    title: 'Misson Control',
    link: null,
    image: 'images/projects/notion.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>Mission Control is a full-stack internal project and task management system I architected and led the development of for the 11-person AurixLab team. Identifying that fragmented Slack threads and spreadsheets were creating operational drag, I designed and directed the build of a purpose-built agency workspace — deployed on Vercel with a Supabase PostgreSQL backend, replacing legacy tooling at zero monthly infrastructure cost.</p>',
      },
      {
        heading: 'Core Features Built',
        content:
          '<ul><li><strong>Authentication system:</strong> Username + password login with Argon2id (later bcrypt) hashing, first-login forced password change, JWT sessions with 30-day persistence, and rate-limited brute-force protection</li><li><strong>Projects &amp; Tasks:</strong> Full CRUD for projects and tasks with Kanban board (drag-and-drop with persisted orderIndex), Table view, and Calendar view per project</li><li><strong>Multi-assignee tasks:</strong> Tasks can be assigned to multiple team members simultaneously using a JSON array field, with a custom AssigneePicker UI component</li><li><strong>Standalone tasks:</strong> Team-wide task board (Backlog / In Progress / Done) not tied to any project — for cross-functional or personal work items</li><li><strong>5 Agency Templates</strong> Web Development, Content Creation, Social Media &amp; Ads, Video Production, and Client Delivery Pipeline — each pre-seeded with statuses, tags, priorities, and example tasks</li><li><strong>Activity logging:</strong> Every create, update, and delete captures before/after JSON snapshots for a full audit trail</li><li><strong>Soft delete &amp; restore:</strong> Tasks and projects use deletedAt for recoverable deletion</li><li><strong>Admin panel:</strong> User creation, password reset, role management, and manual digest trigger</li></ul>',
      },
      {
        heading: 'Claude AI Integration',
        content:
          '<ul><li><strong>Task summarizer:</strong> POST /api/ai/summarize — fetches a task and its last 20 activity logs, calls Claude Haiku to generate a 2-3 sentence plain-English summary of what happened and current status</li><li><strong>Weekly email digest:</strong> Automated digest using Vercel Cron (Mondays 9am UTC) — queries 4 days of ActivityLog, groups by team member, sends a Claude-written natural-language summary via Resend email</li><li><strong>Manual digest trigger:</strong> Admin-only button in the dashboard to fire the digest on demand without waiting for the cron schedule</li><li><strong>MCP bridge:</strong> Connected Claude Desktop directly to the Supabase database via Model Context Protocol (read-only), enabling natural language queries against live project data — "What are the current active tasks?" returns live results</li><li><strong>Scheduled workload analysis:</strong> Daily 8am automation that calculates each team member\'s workload share, flags anyone carrying &gt;30% of total active tasks as a "Critical Bottleneck Risk," and posts a formatted Markdown summary to Discord via webhook</li></ul>',
      },
      {
        heading: 'Technical Challenges Solved',
        content:
          '<ul><li><strong>Argon2id on Vercel serverless:</strong> Native bindings failed on Vercel\'s Linux runtime — diagnosed from build logs and migrated to bcrypt without resetting any existing user passwords</li><li><strong>Prisma + Supabase connection pooling:</strong> Configured correct PgBouncer transaction pooler (port 6543) for runtime queries and direct connection (port 5432) for migrations — avoiding "too many connections" on serverless</li><li><strong>Multi-assignee without schema migration risk:</strong> Used a JSON array assigneeIds field alongside the existing assigneeId to add multi-assignee support without touching existing task data</li><li><strong>Optimistic concurrency:</strong> Every task and project carries a version integer; mismatched versions return a 409 Conflict with the current server state and a diff-friendly message so clients can merge rather than overwrite</li><li><strong>Active task count fix:</strong> Dashboard was hardcoding status !== "Done" — fixed to use the last item in each project\'s custom statuses array as the completion status, supporting custom workflows</li></ul>',
      },
      {
        heading: 'Stack &amp; Deployment',
        content:
          '<p>Deployed on <strong>Vercel</strong> (free Hobby tier) with a <strong>Supabase</strong> free PostgreSQL database. Zero monthly cost, runs 24/7, no server maintenance. CI/CD via GitHub — every push to main triggers an automatic Vercel redeploy. Vercel Cron handles the weekly digest scheduling natively.</p>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '11', label: 'Team Members' },
          { big: '7', label: 'Core Features' },
          { big: '$220', label: 'Monthly Savings' },
          { big: '$0', label: 'Monthly Infrastructure Cost' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'Next.js 14',
          'TypeScript',
          'Prisma ORM',
          'PostgreSQL / Supabase',
          'TanStack Query',
          'Tailwind CSS',
          'Claude Haiku API',
          'Resend',
          'Vercel Cron',
          'JWT Auth',
          'bcryptjs',
          'MCP',
        ],
      },
    ],
  },

  scripting: {
    label: 'Project 02',
    title: 'Scripting Engine',
    link: 'https://scripting-engine.vercel.app',
    image: 'images/projects/scripting.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>Scripting Engine is a closed-loop creative operations product I am building for short-form marketing teams. The current system generates brand-aware scripts, stores every output, accepts review feedback and campaign performance later, then uses those results to improve future retrieval and prompts. The next phase expands it into a full content operating system for discovering ideas, writing scripts, scheduling posts, publishing, measuring performance, and learning from the results.</p>',
      },
      {
        heading: 'Product Direction',
        content:
          '<p>The product is designed around one connected loop: <strong>Brand -> Idea -> Script -> Post -> Published Reel -> Metrics -> Learning</strong>. Instead of splitting research, writing, posting, and reporting across separate tools, the scripting app becomes the home for the full content workflow while Agency Hub remains focused on internal operations and project management.</p>',
      },
      {
        heading: 'What I Built',
        content:
          '<ul><li><strong>Generation workflow:</strong> A LangGraph pipeline that classifies the brief, loads brand context, retrieves weighted examples, generates hooks, writes the script body, creates CTA options, runs a critic pass, formats the final script, and stores the generation context</li><li><strong>Performance learning workflow:</strong> A separate graph that accepts campaign metrics days or weeks later, stores snapshots, scores performance, updates hook and CTA rankings, promotes strong scripts into templates, and records audit events</li><li><strong>Creative operations:</strong> Script import, editable versions, review states, reviewer feedback, restore support, and brand knowledge entries that are supplied to Gemini as approved context</li><li><strong>API and dashboard foundation:</strong> Fastify endpoints for brands, assets, generation, imports, performance, feedback, insights, and a React/Vite operator dashboard for daily use</li></ul>',
      },
      {
        heading: 'Content OS Roadmap',
        content:
          '<ul><li><strong>Discover:</strong> Save viral reels, competitor examples, hooks, captions, formats, and trend references before generating ideas</li><li><strong>Ideas:</strong> Turn saved references and brand knowledge into content angles grouped by brand, campaign, objective, and platform</li><li><strong>Calendar and publishing:</strong> Convert approved scripts into scheduled posts with account connections, post statuses, publish logs, retry states, and Meta/Instagram publishing where available</li><li><strong>Insights:</strong> Sync views, reach, engagement, saves, watch data, CTR, conversions, and platform IDs back to the exact post, script, idea, and reference chain</li><li><strong>Learning:</strong> Promote winning hooks, CTAs, formats, topics, and structures while demoting weak patterns and writing clearer future prompt rules</li></ul>',
      },
      {
        heading: 'AI Architecture',
        content:
          '<p>The system does not fine-tune Gemini. It learns at the application layer through approved brand knowledge, ranked creative assets, human feedback, campaign metrics, and reusable templates. LangChain handles structured Gemini calls and Zod-validated outputs, while LangGraph controls the explicit workflow state for generation and delayed performance learning. This keeps the learning loop immediate, auditable, reversible, and much cheaper than maintaining a custom-trained model.</p>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '2', label: 'LangGraph Workflows' },
          { big: 'Loop', label: 'Creative Learning System' },
          { big: '9', label: 'Core API Areas' },
          { big: 'Soon', label: 'Content OS Expansion' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'Node.js',
          'TypeScript',
          'LangGraph',
          'LangChain',
          'Gemini API',
          'Fastify',
          'React',
          'Vite',
          'Supabase',
          'PostgreSQL',
          'Zod',
          'Vitest',
          'Meta API',
        ],
      },
    ],
  },

  revive: {
    label: 'Project 03',
    title: 'CPC Revive',
    link: 'https://cpcclinics.ca/revive/',
    image: 'images/projects/revive.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>CPC Revive is the premium program arm of CPC Clinics — a suite of structured mental wellness and performance programs built for people who want clarity and measurable outcomes, not just open-ended appointments. I built the full web presence across four interconnected pages: the Revive hub, the rTMS brain stimulation service page, and two flagship program pages.</p>',
      },
      {
        heading: 'Pages Built',
        content:
          '<ul><li><strong><a href="https://cpcclinics.ca/revive/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-glow)">CPC Revive Hub</a></strong> — Program overview, five-phase framework, program comparison, and entry CTAs</li><li><strong><a href="https://cpcclinics.ca/services/brain-stimulation-treatment-rtms-calgary/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-glow)">Brain Stimulation Treatment (rTMS)</a></strong> — Service page for EXOMIND rTMS: conditions treated, how it works, clinical stats</li><li><strong><a href="https://cpcclinics.ca/revive/executive-reset/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-glow)">Revive Executive Reset&trade;</a></strong> — Burnout recovery program for executives, founders, and healthcare professionals</li><li><strong><a href="https://cpcclinics.ca/revive/competitive-edge/" target="_blank" rel="noopener noreferrer" style="color:var(--accent-glow)">Revive Competitive Edge&trade;</a></strong> — Mental performance program for competitive athletes</li></ul>',
      },
      {
        heading: 'What I Built',
        content:
          '<ul><li>Designed and developed all four pages inside WordPress/Elementor, consistent with the existing CPC Clinics brand system</li><li>Structured each program page around a clear <strong>five-phase framework</strong> (Consultation, Brain-Based Support, Skills &amp; Strategy, Real-World Reinforcement, Maintenance Plan) to give prospective clients visible endpoints before enrolling</li><li>Built the rTMS service page to educate and pre-qualify leads — covering the EXOMIND technology, conditions treated (depression, burnout, ADHD, anxiety), session flow, and clinical evidence</li><li>Created tiered program structures (Starter 8wk / Pro 12wk / Elite 16wk+) with clear scope and inclusions for each tier, enabling transparent pricing conversations</li><li>Integrated targeted CTAs at each funnel stage — from awareness (rTMS page) to decision (program tier selection)</li><li>Optimized all pages for SEO: meta titles, descriptions, heading hierarchy, internal linking between the Revive hub, program pages, and the main CPC Clinics site</li></ul>',
      },
      {
        heading: 'rTMS Service Highlights',
        content:
          '<ul><li>Health Canada and FDA cleared non-invasive brain stimulation (no medication, no anesthesia)</li><li>Targets mood, focus, and emotional regulation circuits using brief magnetic pulses</li><li>Sessions under 30 minutes with no recovery time — walk in, walk out</li><li>Supported by 40+ years of peer-reviewed research and millions of treatments delivered worldwide</li></ul>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '4', label: 'Pages Built' },
          { big: '88%', label: 'Improved Well-Being (rTMS stat)' },
          { big: '2', label: 'Flagship Programs' },
          { big: '3', label: 'Program Tiers Each' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'WordPress',
          'Elementor',
          'SEO',
          'Yoast SEO',
          'rTMS / EXOMIND',
          'Copywriting',
          'UX Structure',
        ],
      },
    ],
  },

  leadcraft: {
    label: 'Project 04',
    title: 'LeadCraft IT Solutions',
    link: 'https://www.leadcraftit.com/',
    image: 'images/projects/leadcraft.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>LeadCraft IT Solutions is a full 5-page website I directed the development of for a US + Bangladesh ITES/BPO company serving enterprise clients. I led the technical implementation strategy — architecting the WordPress + Elementor foundation while directing the integration of WebGL shaders, GSAP ScrollTrigger animations, Lenis smooth scroll, Globe.gl visualization, and Swiper carousel into a unified, high-performance frontend.</p>',
      },
      {
        heading: 'Pages Built',
        content:
          '<ul><li><strong>Home</strong> — WebGL shader hero background, interactive Globe.gl world map visualization, Swiper 3D flip testimonials carousel, animated service stats, and full sticky navigation</li><li><strong>About</strong> — GSAP + Lenis parallax scroll hero with real office photography, Split Type text reveals, and dual-office (US + Bangladesh) team narrative</li><li><strong>Services</strong> — Four service lines with tabbed detail panels: Real Estate Asset Management &amp; BPO, Banking &amp; Financial Data Management, Virtually Managed Services, and Research &amp; Development</li><li><strong>Career</strong> — Live job listings grid with JavaScript category/type filter, expandable job detail cards, and application CTA</li><li><strong>Contact</strong> — Full form with front-end validation, dual-office address display, and Google Maps embed</li></ul>',
      },
      {
        heading: 'What I Built',
        content:
          '<ul><li>WordPress + Elementor integration with heavily customized JS/CSS layers on top of the builder</li><li><strong>GSAP ScrollTrigger</strong> animations across the About page: pinned sections, parallax hero image, staggered text reveals</li><li><strong>Lenis smooth scroll</strong> wired to GSAP for inertia-based scrolling throughout</li><li><strong>WebGL fragment shader</strong> background on the homepage hero — animated gradient noise running on the GPU</li><li><strong>Globe.gl</strong> interactive 3D globe visualization showing US and Bangladesh office locations with arc animations</li><li><strong>Swiper.js</strong> 3D flip testimonial carousel with autoplay and custom pagination</li><li><strong>Split Type</strong> character-level text entrance animations on headings</li><li>Schema.org markup (Organization, LocalBusiness, JobPosting) for SEO and rich results</li><li>Responsive hamburger nav with smooth open/close transitions</li></ul>',
      },
      {
        heading: 'Clients Served by LeadCraft',
        content:
          '<ul><li>MSI (Mortgage Servicing Intelligence)</li><li>Safeguard Properties</li><li>ServiceLink</li><li>National Field Representatives (NFR)</li><li>Mortgage Contracting Services (MCS)</li><li>Guardian Asset Management</li></ul>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '5', label: 'Pages Built' },
          { big: '6+', label: 'Enterprise Clients' },
          { big: '50+', label: 'Staff Showcased' },
          { big: '24/7', label: 'US Operations' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'WordPress',
          'Elementor',
          'GSAP',
          'Lenis',
          'WebGL Shaders',
          'Globe.gl',
          'Swiper.js',
          'Split Type',
          'Schema.org',
          'Barlow Condensed',
          'Outfit',
          'JavaScript',
          'CSS3',
        ],
      },
    ],
  },

  data: {
    label: 'Project 05',
    title: 'Customer Segmentation Engine',
    link: null,
    image: 'images/projects/data.jpeg',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>Budget Promotion needed a way to send targeted email campaigns to their 10,900+ contact database. The challenge: most contacts had minimal data, often just a name and personal email with no company info. I built a Python-based classification pipeline to segment every contact into one of 9 business sectors.</p>',
      },
      { heading: 'The 9 Sectors', content: '<p>Events, Trades, Camps, Schools, Sports, Non-Profits, Restaurants, Corporates, and Retail.</p>' },
      {
        heading: 'How It Works',
        content:
          '<ul><li><strong>Data Merging:</strong> Loaded 3 separate Mailchimp CSV exports (cleaned, subscribed, non-subscribed), standardized columns, resolved duplicated email fields, and deduplicated by primary email</li><li><strong>Feature Engineering:</strong> Built a classification_text field combining company name, contact name, email domain, tags, notes, and city, all normalized and cleaned</li><li><strong>Pass 1 (Rule-Based Classification):</strong> Used weighted keyword dictionaries per sector. Company name hits were weighted higher than tags. Campaign tags (e.g., "Back 2 School Clicks") were filtered out to prevent false signals</li><li><strong>Pass 2 (AI Fallback):</strong> For low-confidence rows (below 0.65), the system calls Claude via the Anthropic API with the classification_text for intelligent sector assignment</li><li><strong>Output:</strong> Master segmented spreadsheet with sector, confidence score, classification method, and a needs_review flag. Plus a separate review queue and sector summary</li></ul>',
      },
      {
        heading: 'Challenges & Solutions',
        content:
          "<ul><li><strong>Sparse Data:</strong> Around 7,200 contacts had only personal emails with no company or tag data. These default to \"Corporates\" as a catch-all and are flagged for AI review or manual classification</li><li><strong>Campaign Tag Contamination:</strong> Mailchimp engagement tags like \"Back 2 School Clicks\" and \"Clicked Black Friday\" were inflating the Schools sector. I built a tag filtering system to strip campaign-related tags before classification</li><li><strong>Tie Breaking:</strong> When two sectors had equal scores, I implemented a deterministic priority order to ensure consistent classification</li></ul>",
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '10.9K', label: 'Contacts Processed' },
          { big: '9', label: 'Business Sectors' },
          { big: '2-Pass', label: 'Rules + AI Pipeline' },
          { big: '5', label: 'Output Deliverables' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'Python',
          'Pandas',
          'TF-IDF Embeddings',
          'Cosine Similarity',
          'Anthropic Claude API',
          'Jupyter Notebook',
          'Mailchimp',
        ],
      },
    ],
  },

  cpc: {
    label: 'Project 06',
    title: 'CPC Clinics',
    link: 'https://cpcclinics.ca/',
    image: 'images/projects/cpc.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>CPC Clinics is a Calgary-based clinical psychology practice. I was responsible for a complete website overhaul, from redesigning the front-end and rebuilding the content architecture to resolving a critical security breach and driving the SEO score above 90.</p>',
      },
      {
        heading: 'Work Done',
        content:
          '<ul><li>Rebuilt and improved the homepage structure, messaging flow, CTAs, and internal linking for better user conversion</li><li>Created and optimized <strong>20+ service and workshop pages</strong> across Counselling Services (Anxiety, PTSD, Couples, Sports Psychology, OCD, etc.), Assessments (ADHD, Psychoeducational, Forensic, Autism, etc.), and Workshops (Workplace, Athletes, Teachers)</li><li>Revamped the About Us section including Our Story, Our Team, Our Space, FAQs, Partner With Us, and Blog pages</li><li>Published <strong>11 SEO-optimized blog posts</strong> targeting Calgary-relevant mental health topics</li><li>Rebuilt the Contact Us page with improved inquiry flow and service selection</li><li>Aligned the entire booking journey end-to-end, from homepage to service pages to the "Book a Free Consultation" pathway</li></ul>',
      },
      {
        heading: 'Security Remediation',
        content:
          '<p>The website had suffered a significant security breach. Here is what I addressed:</p><ul><li><strong>Unauthorized Access Recovery:</strong> An external entity ("SocialMore") gained backend access and changed admin passwords. I recovered the account through PHPmyAdmin on Hostinger, removed all unauthorized traces, and reclaimed control</li><li><strong>Japanese SEO Spam:</strong> The site was targeted with malicious Japanese-character spam appearing in Google results. I cleaned the corrupted Index.php backdoor, deleted the monarx-analyzer.php malware file, and submitted a security review through Google Search Console</li><li><strong>Core File Cleanup:</strong> The Functions.php was heavily compromised. I manually removed 395 lines of malicious code. I also sanitized the wp_options database table by deleting malicious entries that were redirecting traffic to spam sites</li><li><strong>Spam Post Removal:</strong> Removed <strong>10,000+ spam blog posts</strong> that had been injected through backdoors</li><li><strong>Brute Force Protection:</strong> Stopped 200+ brute force attacks by disabling XML-RPC, reducing login failure limits to 2 attempts, extending lockout duration to 2 months, and enabling immediate lockout for invalid usernames</li><li><strong>Bot Blocking:</strong> Enabled blocking of POST requests with blank User-Agent and Referer to prevent automated hacking scripts</li></ul>',
      },
      {
        heading: 'SEO & Performance',
        content:
          '<ul><li>Completed a full on-page SEO implementation using <strong>Yoast SEO</strong> across all pages: optimized meta titles, meta descriptions, URL slugs, keyphrase placement, heading hierarchy, internal linking, and image alt text</li><li>Achieved <strong>Yoast "green" status</strong> across all key SEO criteria for every page</li><li>Improved mobile responsiveness and spacing for a premium user experience</li></ul>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '90+', label: 'SEO Score' },
          { big: '1.23K', label: 'Organic Clicks (6mo)' },
          { big: '582K', label: 'Search Impressions' },
          { big: '20+', label: 'Pages Created' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'WordPress',
          'Elementor',
          'Yoast SEO',
          'Wordfence',
          'PHPmyAdmin',
          'Google Search Console',
          'PHP',
        ],
      },
    ],
  },

  bp: {
    label: 'Project 07',
    title: 'Budget Promotion',
    link: 'https://budgetpromotion.ca/',
    image: 'images/projects/bp.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          '<p>Budget Promotion is a Calgary-based promotional products company running on Shopify. I worked across the full stack: uploading products, fixing critical front-end and back-end bugs, building customization features, integrating with the Printavo fulfillment API, and driving performance scores above 95.</p>',
      },
      {
        heading: 'Work Done',
        content:
          '<ul><li>Managed bulk product uploads and organized catalog structure within Shopify</li><li>Built and refined the <strong>product customization modal</strong>, allowing customers to upload images, position designs on products via a canvas-based tool, and preview before ordering</li><li>Fixed cross-platform compatibility issues between Mac and Windows devices for the product customizer</li><li>Developed the <strong>AJAX cart system</strong> for smooth add-to-cart and checkout flows without page reloads</li><li>Integrated the Shopify backend with <strong>Printavo</strong> for automated print-on-demand fulfillment via webhook architecture</li><li>Implemented the custom quote system for bulk/corporate orders</li></ul>',
      },
      {
        heading: 'Challenges & Solutions',
        content:
          '<ul><li><strong>Customizer Cross-Platform Bugs:</strong> The product image customizer rendered differently on Mac vs Windows. I debugged canvas rendering logic, font rendering, and mouse event handling to ensure consistent behavior across platforms</li><li><strong>Performance Bottlenecks:</strong> The site had suboptimal load times due to unoptimized images, render-blocking scripts, and large Liquid template files. I implemented image compression, lazy loading, script deferral, and CSS optimization</li><li><strong>Printavo API Integration:</strong> Built a webhook-based architecture to automatically push order data from Shopify to Printavo, handling edge cases for custom orders with uploaded artwork</li></ul>',
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '90+', label: 'SEO Score' },
          { big: '95+', label: 'Load Speed Score' },
          { big: '100%', label: 'Cross-Platform Fix' },
          { big: 'Live', label: 'Printavo Integration' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'Shopify',
          'Liquid',
          'JavaScript',
          'AJAX',
          'Canvas API',
          'Printavo API',
          'Webhooks',
          'CSS',
        ],
      },
    ],
  },

  aurix: {
    label: 'Project 08',
    title: 'AurixLab SEO Optimization',
    link: 'https://www.aurixlab.com/',
    image: 'images/projects/aurix.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          "<p>AurixLab is a Calgary-based marketing agency specializing in Shopify customization, promotional products, and digital marketing. I was tasked with a comprehensive SEO overhaul to improve the site's visibility and performance in Calgary's competitive digital marketing landscape.</p>",
      },
      {
        heading: 'Work Done',
        content:
          '<ul><li>Conducted extensive <strong>keyword research</strong> targeting Calgary-specific digital marketing search terms</li><li>Optimized all page content: meta titles, meta descriptions, heading hierarchy, and internal linking structures</li><li>Implemented <strong>structured data / schema markup</strong> (JSON-LD) across the site for enhanced search result appearance, including Organization, LocalBusiness, and Service schemas</li><li>Identified and fixed performance bottlenecks: image optimization, render-blocking resource elimination, CLS/LCP improvements</li><li>Set up proper canonical URLs, sitemap, and robots.txt configuration</li></ul>',
      },
      {
        heading: 'Challenges & Solutions',
        content:
          "<ul><li><strong>Competitive Local Market:</strong> Calgary's digital marketing space is competitive. Extensive research was needed to identify high-value, low-competition keyword opportunities</li><li><strong>Schema Complexity:</strong> Implementing comprehensive structured data for a multi-service agency required careful mapping of service types to appropriate schema.org types and validation through Google's Rich Results Test</li></ul>",
      },
      {
        heading: 'Results',
        type: 'results',
        items: [
          { big: '90+', label: 'SEO Score' },
          { big: 'Faster', label: 'Load Times' },
          { big: 'Live', label: 'Schema Markup' },
          { big: 'Higher', label: 'Search Visibility' },
        ],
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: [
          'SEO',
          'Schema.org / JSON-LD',
          'Google Search Console',
          'PageSpeed Insights',
          'Keyword Research',
          'Core Web Vitals',
        ],
      },
    ],
  },

  resizer: {
    label: 'Project 09',
    title: 'Image Resizer Studio',
    link: 'https://ahnaf-image-resizer.netlify.app/',
    image: 'images/projects/resizer.png',
    imagePlaceholder: '',
    sections: [
      {
        heading: 'Overview',
        content:
          "<p>Image Resizer Studio is a standalone browser-based SaaS-style tool I built and launched independently to solve a real gap: no reliable, free, client-side image optimization tool existed without privacy trade-offs. Built as a zero-dependency single-file app with batch processing, Canvas API compression, and ZIP download — a product lab project demonstrating my ability to ideate, architect, and ship standalone tools end-to-end.</p>",
      },
      {
        heading: 'Work Done',
        content:
          "<ul><li>Built the entire application as a <strong>single-file HTML/CSS/JS</strong> solution with no frameworks, no backend, and fully portable</li><li>Implemented drag-and-drop file uploads with live preview thumbnails</li><li>Created pixel-level resizing with custom width, height, and aspect ratio lock controls</li><li>Added quality/compression sliders with real-time file size estimation</li><li>Built <strong>batch processing</strong> to process multiple images at once and download as a ZIP file using JSZip</li><li>All processing happens in the browser via the <strong>Canvas API</strong> so images never leave the user's device</li></ul>",
      },
      {
        heading: 'Challenges & Solutions',
        content:
          "<ul><li><strong>No Reliable Existing Tools:</strong> Most online image resizers either require server uploads (privacy concerns), are slow, or add watermarks. I needed a fast, private, no-nonsense tool for daily web development work</li><li><strong>Large File Handling:</strong> Processing very high-resolution images in the browser can cause memory issues. I implemented chunked rendering and optimized canvas operations to handle files up to 20MB smoothly</li></ul>",
      },
      {
        heading: 'Technologies',
        type: 'tech',
        tags: ['HTML5', 'CSS3', 'JavaScript', 'Canvas API', 'JSZip', 'Netlify'],
      },
    ],
  },
};

export const stripOrder: ProjectKey[] = [
  'notion',
  'scripting',
  'revive',
  'leadcraft',
  'data',
  'cpc',
  'bp',
  'aurix',
  'resizer',
];

export interface StripMeta {
  key: ProjectKey;
  num: string;
  tags: string[];
}

export const stripMeta: StripMeta[] = [
  { key: 'notion',   num: '01', tags: ['Next.js', 'Supabase', 'SaaS'] },
  { key: 'scripting',num: '02', tags: ['LangGraph', 'Gemini', 'Content OS'] },
  { key: 'revive',   num: '03', tags: ['WordPress', 'SEO', 'UX'] },
  { key: 'leadcraft',num: '04', tags: ['WordPress', 'GSAP', 'WebGL'] },
  { key: 'data',     num: '05', tags: ['Python', 'ML', 'Anthropic'] },
  { key: 'cpc',      num: '06', tags: ['WordPress', 'SEO', 'Security'] },
  { key: 'bp',       num: '07', tags: ['Shopify', 'API', 'Liquid'] },
  { key: 'aurix',    num: '08', tags: ['SEO', 'Schema', 'Core Web Vitals'] },
  { key: 'resizer',  num: '09', tags: ['HTML5', 'Canvas', 'Netlify'] },
];
