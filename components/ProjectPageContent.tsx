'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, MotionConfig } from 'framer-motion';
import { Project, StripMeta, projectData } from '@/lib/projects';
import { CASE_STUDIES, CASE_STUDY_ORDER, type CaseImage, type CaseStudy } from '@/lib/caseStudies';
import { readAccent } from '@/lib/accent';

// Simple Icons CDN slug mapping — https://simpleicons.org
const ICONS: Record<string, string> = {
  'Next.js': 'nextdotjs', 'Next.js 14': 'nextdotjs',
  'Node.js': 'nodedotjs',
  'TypeScript': 'typescript',
  'React': 'react',
  'Vite': 'vite',
  'Prisma ORM': 'prisma',
  'PostgreSQL / Supabase': 'supabase', 'Supabase': 'supabase', 'PostgreSQL': 'postgresql',
  'TanStack Query': 'reactquery',
  'Tailwind CSS': 'tailwindcss',
  'Claude Haiku API': 'anthropic', 'Anthropic Claude API': 'anthropic', 'MCP': 'anthropic',
  'LangChain': 'langchain',
  'Gemini API': 'googlegemini',
  'Fastify': 'fastify',
  'Zod': 'zod',
  'Vitest': 'vitest',
  'Meta API': 'meta',
  'Resend': 'resend',
  'Vercel Cron': 'vercel', 'Vercel': 'vercel',
  'JWT Auth': 'jsonwebtokens',
  'WordPress': 'wordpress', 'Elementor': 'elementor',
  'Yoast SEO': 'yoast',   // Wordfence has no Simple Icons entry — renders text-only
  'GSAP': 'greensock',
  'Swiper.js': 'swiper',
  'JavaScript': 'javascript', 'CSS3': 'css', 'HTML5': 'html5',
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
  const resultsSection = project.sections.find((s) => s.type === 'results');
  const techSection = project.sections.find((s) => s.type === 'tech');
  const contentSections = project.sections.filter((s) => s.type !== 'results' && s.type !== 'tech');
  // The flagship projects tell the story first; the existing write-up moves
  // into "Technical detail" below it.
  const cs = meta ? CASE_STUDIES[meta.key] : undefined;
  const nextKey = cs && meta ? CASE_STUDY_ORDER[(CASE_STUDY_ORDER.indexOf(meta.key) + 1) % CASE_STUDY_ORDER.length] : null;

  // Tech-icon tint from the active palette (Simple Icons wants hex without #)
  const [iconColor, setIconColor] = useState('cc182c');

  // Scroll to top instantly before the slide-in animation plays
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setIconColor(readAccent().glow.replace('#', '') || 'cc182c');
  }, []);

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

        {/* A real link (crawlable, opens in a new tab), not a router.push button. */}
        <Link href="/" className="proj-back">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </Link>

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

      {cs && <CaseStudyBody cs={cs} />}

      {/* ── STATS STRIP ── */}
      {!cs && resultsSection?.items && (
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
        {cs ? (
          <details className="cx-more">
            <summary>Technical detail</summary>
            <div className="proj-sections">
              {contentSections.filter((s) => s.heading !== 'Overview').map((s, idx) => (
                <div key={idx} className="proj-section">
                  <h2 className="proj-section-heading">{s.heading}</h2>
                  {s.content && (
                    <div className="proj-section-content" dangerouslySetInnerHTML={{ __html: s.content }} />
                  )}
                </div>
              ))}
            </div>
          </details>
        ) : (
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
        )}

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
                        src={`https://cdn.simpleicons.org/${slug}/${iconColor}`}
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

        {nextKey && (
          <Link href={`/projects/${nextKey}`} className="cx-next">
            <span>Next case study</span>
            <strong>{projectData[nextKey].title}</strong>
          </Link>
        )}
      </div>
    </div>
  );
}

/** The story of a flagship project: problem and role, approach with real
    images, then the result in numbers. */
function CaseStudyBody({ cs }: { cs: CaseStudy }) {
  // Portrait images pair with the image before them.
  const rows: CaseImage[][] = [];
  for (const img of cs.gallery) {
    if (img.tall && rows.length) rows[rows.length - 1].push(img);
    else rows.push([img]);
  }
  const max = cs.chart ? Math.max(...cs.chart.rows.map((r) => r.value)) : 1;
  const reveal = { initial: { opacity: 0, y: 26 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.6, ease: 'easeOut' as const } };

  return (
    <MotionConfig reducedMotion="user">
      <div className="cx">
        <p className="cx-summary">{cs.summary}</p>

        <div className="cx-brief">
          <motion.section {...reveal}>
            <p className="section-label">The problem</p>
            <p>{cs.problem}</p>
          </motion.section>
          <motion.section {...reveal}>
            <p className="section-label">My role</p>
            <p>{cs.role}</p>
          </motion.section>
        </div>

        <section className="cx-approach">
          <p className="section-label">The approach</p>
          <ol>
            {cs.approach.map((step, i) => (
              <motion.li key={step.title} {...reveal}>
                <span className="cx-step" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {rows.map((row, r) => (
          <div key={r} className={`cx-row${row.length > 1 ? ' is-pair' : ''}`}>
            {row.map((img) => (
              <motion.figure key={img.src} className={img.tall ? 'is-tall' : undefined} {...reveal}>
                <Image
                  src={`/${img.src}`}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  sizes={row.length > 1 ? '(max-width: 768px) 100vw, 560px' : '(max-width: 768px) 100vw, 1100px'}
                />
                <figcaption>{img.caption}</figcaption>
              </motion.figure>
            ))}
          </div>
        ))}

        {cs.chart && (
          <motion.figure className="cx-chart" {...reveal}>
            <h2>{cs.chart.title}</h2>
            <ul>
              {cs.chart.rows.map((row) => (
                <li key={row.label} className={row.muted ? 'is-muted' : undefined}>
                  <span className="cx-bar-label">{row.label}</span>
                  <span className="cx-bar-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%` }} />
                  </span>
                  <span className="cx-bar-value">{row.value.toLocaleString('en-CA')}</span>
                </li>
              ))}
            </ul>
            <figcaption>{cs.chart.caption}</figcaption>
          </motion.figure>
        )}

        <section className="cx-result">
          <p className="section-label">The result</p>
          <motion.p className="cx-outcome" {...reveal}>{cs.outcome}</motion.p>
          <div className="cx-metrics">
            {cs.metrics.map((m) => (
              <motion.div key={m.label} {...reveal}>
                <strong>{m.big}</strong>
                <span>{m.label}</span>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
