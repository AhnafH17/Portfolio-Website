'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Project, StripMeta } from '@/lib/projects';

// Simple Icons CDN slug mapping — https://simpleicons.org
const ICONS: Record<string, string> = {
  'Next.js': 'nextdotjs', 'Next.js 14': 'nextdotjs',
  'TypeScript': 'typescript',
  'Prisma ORM': 'prisma',
  'PostgreSQL / Supabase': 'supabase', 'Supabase': 'supabase', 'PostgreSQL': 'postgresql',
  'TanStack Query': 'reactquery',
  'Tailwind CSS': 'tailwindcss',
  'Claude Haiku API': 'anthropic', 'Anthropic Claude API': 'anthropic', 'MCP': 'anthropic',
  'Resend': 'resend',
  'Vercel Cron': 'vercel', 'Vercel': 'vercel',
  'JWT Auth': 'jsonwebtokens',
  'WordPress': 'wordpress', 'Elementor': 'elementor',
  'Yoast SEO': 'yoast', 'Wordfence': 'wordfence',
  'GSAP': 'greensock',
  'Swiper.js': 'swiper',
  'JavaScript': 'javascript', 'CSS3': 'css3', 'HTML5': 'html5',
  'Python': 'python', 'Pandas': 'pandas',
  'Jupyter Notebook': 'jupyter',
  'Mailchimp': 'mailchimp',
  'PHP': 'php', 'PHPmyAdmin': 'phpmyadmin',
  'Google Search Console': 'googlesearchconsole',
  'PageSpeed Insights': 'pagespeedinsights',
  'Shopify': 'shopify',
  'Netlify': 'netlify',
  'WebGL Shaders': 'webgl',
  'Liquid': 'shopify',
  'AJAX': 'javascript',
  'Canvas API': 'html5', 'JSZip': 'javascript',
  'GitHub': 'github',
  'bcryptjs': 'javascript',
  'TF-IDF Embeddings': 'python', 'Cosine Similarity': 'python',
  'Core Web Vitals': 'googlesearchconsole',
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
} as const;

const sectionVariant = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
} as const;

interface Props {
  project: Project;
  meta: StripMeta | undefined;
}

export default function ProjectPageContent({ project, meta }: Props) {
  const router = useRouter();
  const resultsSection = project.sections.find((s) => s.type === 'results');
  const techSection = project.sections.find((s) => s.type === 'tech');
  const contentSections = project.sections.filter((s) => s.type !== 'results' && s.type !== 'tech');

  // Scroll to top instantly before the slide-in animation plays
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const goBack = () => router.push('/');

  return (
    <div className="proj-page">

      {/* ── HERO ── */}
      <div className="proj-hero">
        {project.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/${project.image}`} alt={project.title} className="proj-hero-img" />
        ) : (
          <div className="proj-hero-empty">
            <svg viewBox="0 0 120 80" fill="none" width="120" opacity={0.08}>
              <rect x="2" y="2" width="116" height="76" rx="8" stroke="#cc182c" strokeWidth="1.5"/>
              <circle cx="35" cy="30" r="12" stroke="#cc182c" strokeWidth="1.5"/>
              <path d="M2 55l28-18 24 16 20-14 44 19" stroke="#cc182c" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        <div className="proj-hero-overlay" />

        <button onClick={goBack} className="proj-back">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </button>

        <motion.div
          className="proj-hero-content"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <p className="section-label">{project.label}</p>
          <h1 className="proj-title">{project.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {meta?.tags.map((t) => (
              <span key={t} className="modal-tech-tag" style={{ fontSize: '.7rem', opacity: 0.7 }}>{t}</span>
            ))}
            {project.link && (
              <a href={project.link} target="_blank" rel="noopener noreferrer" className="proj-live-link">
                Visit Live Site
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── STATS STRIP ── */}
      {resultsSection?.items && (
        <motion.div
          className="proj-stats"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {resultsSection.items.map((item, i) => (
            <motion.div
              key={i}
              className="proj-stat"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
            >
              <span className="proj-stat-big">{item.big}</span>
              <span className="proj-stat-label">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── BODY ── */}
      <div className="proj-body">
        <motion.div
          className="proj-sections"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {contentSections.map((s, idx) => (
            <motion.div key={idx} className="proj-section" variants={sectionVariant}>
              <h2 className="proj-section-heading">{s.heading}</h2>
              {s.content && (
                <div className="proj-section-content" dangerouslySetInnerHTML={{ __html: s.content }} />
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* ── TECH STACK ── */}
        {techSection?.tags && (
          <motion.div
            className="proj-tech-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <h2 className="proj-section-heading">Technologies</h2>
            <div className="proj-tech-grid">
              {techSection.tags.map((tag, i) => {
                const slug = ICONS[tag];
                return (
                  <motion.div
                    key={i}
                    className="proj-tech-item"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 + i * 0.04 }}
                  >
                    {slug && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://cdn.simpleicons.org/${slug}/cc182c`}
                        alt=""
                        width={18}
                        height={18}
                        aria-hidden="true"
                      />
                    )}
                    {tag}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
