'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Project, StripMeta } from '@/lib/projects';

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
  'Liquid': 'shopify', 'AJAX': 'javascript',
  'Canvas API': 'html5', 'JSZip': 'javascript',
  'GitHub': 'github',
  'bcryptjs': 'javascript',
  'TF-IDF Embeddings': 'python', 'Cosine Similarity': 'python',
  'Core Web Vitals': 'googlesearchconsole',
};

// Corner decoration marker
function Cross({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg
      width="6" height="6" viewBox="0 0 5 5" fill="none"
      className={`pp-cross pp-cross-${pos}`}
    >
      <path d="M3 2H5V3H3V5H2V3H0V2H2V0H3V2Z" fill="rgba(201,168,76,0.45)" />
    </svg>
  );
}

function Framed({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pp-framed ${className}`}>
      <Cross pos="tl" /><Cross pos="tr" /><Cross pos="bl" /><Cross pos="br" />
      {children}
    </div>
  );
}

const up = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } } as const;
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } } as const;

interface Props { project: Project; meta: StripMeta | undefined; }

export default function ProjectPageContent({ project, meta }: Props) {
  const results  = project.sections.find((s) => s.type === 'results');
  const tech     = project.sections.find((s) => s.type === 'tech');
  const content  = project.sections.filter((s) => !s.type);

  return (
    <div className="pp-root">

      {/* ── HERO ── */}
      <div className="pp-hero">
        {project.image
          ? <img src={`/${project.image}`} alt="" className="pp-hero-img" aria-hidden="true" />
          : <div className="pp-hero-fallback" />
        }
        <div className="pp-hero-overlay" />

        {/* big background number */}
        <span className="pp-hero-num" aria-hidden="true">{meta?.num ?? '00'}</span>

        <Link href="/#showcase" className="pp-back">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={13} height={13}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </Link>

        <motion.div className="pp-hero-content"
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75 }}
        >
          <p className="pp-label">{project.label}</p>
          <h1 className="pp-title">{project.title}</h1>
        </motion.div>
      </div>

      {/* ── META BAR ── */}
      <motion.div className="pp-meta-bar"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="pp-meta-left">
          <span className="pp-meta-num">{meta?.num ?? '—'}</span>
          {meta?.tags.map((t) => (
            <span key={t} className="pp-meta-tag">{t}</span>
          ))}
        </div>
        <div className="pp-meta-right">
          {project.link && (
            <a href={project.link} target="_blank" rel="noopener noreferrer" className="pp-live-btn">
              Visit Live Site
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={12} height={12}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          )}
        </div>
      </motion.div>

      {/* ── STATS ── */}
      {results?.items && (
        <motion.div className="pp-stats"
          variants={stagger} initial="hidden" animate="show"
        >
          {results.items.map((item, i) => (
            <motion.div key={i} className="pp-stat" variants={up}
              transition={{ duration: 0.45, delay: i * 0.07 }}
            >
              <span className="pp-stat-big">{item.big}</span>
              <span className="pp-stat-label">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── CONTENT ── */}
      <div className="pp-body">
        <motion.div className="pp-sections" variants={stagger} initial="hidden" animate="show">
          {content.map((s, i) => (
            <motion.div key={i} variants={up} transition={{ duration: 0.45 }}>
              <Framed className="pp-section">
                <h2 className="pp-section-h">{s.heading}</h2>
                {s.content && (
                  <div className="pp-section-body" dangerouslySetInnerHTML={{ __html: s.content }} />
                )}
              </Framed>
            </motion.div>
          ))}
        </motion.div>

        {/* ── TECH ── */}
        {tech?.tags && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
          >
            <Framed className="pp-tech-wrap">
              <h2 className="pp-section-h">Technologies</h2>
              <div className="pp-tech-grid">
                {tech.tags.map((tag, i) => {
                  const slug = ICONS[tag];
                  return (
                    <motion.span key={i} className="pp-tech-pill"
                      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, delay: 0.35 + i * 0.035 }}
                    >
                      {slug && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://cdn.simpleicons.org/${slug}/c9a84c`}
                          alt="" width={16} height={16} aria-hidden="true" />
                      )}
                      {tag}
                    </motion.span>
                  );
                })}
              </div>
            </Framed>
          </motion.div>
        )}
      </div>
    </div>
  );
}
