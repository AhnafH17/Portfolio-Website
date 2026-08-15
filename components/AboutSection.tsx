import { siNextdotjs, siShopify, siWordpress, siPython } from 'simple-icons';

const NODES = [
  { id: 'frontend', label: 'Frontend Standards', sub: 'Next.js · GSAP', x: 50, y: 13 },
  { id: 'client', label: 'Client Websites', sub: 'Shopify · WordPress', x: 15, y: 47 },
  { id: 'saas', label: 'Mission Control', sub: 'Internal SaaS PM', x: 85, y: 47 },
  { id: 'automation', label: 'Email Scraping', sub: 'Python', x: 24, y: 84 },
  { id: 'seo', label: 'SEO Systems', sub: '', x: 50, y: 92 },
  { id: 'team', label: 'Team Workflows', sub: '', x: 76, y: 84 },
];

const LOGOS = [
  { key: 'next', icon: siNextdotjs },
  { key: 'shopify', icon: siShopify },
  { key: 'wordpress', icon: siWordpress },
  { key: 'python', icon: siPython },
];

// Drawn from the tech actually tagged across lib/projects.ts, ordered by how
// often it appears there.
const SKILLS = [
  'WordPress', 'Next.js', 'TypeScript', 'Shopify', 'GSAP',
  'Supabase', 'LangGraph', 'Python', 'SEO',
];

const CARDS = [
  {
    id: 'journey', title: 'My Journey', items: [
      'Joined AurixLab in August 2025, rapidly advancing from technical specialist to leading the entire development function',
      'Architected Mission Control — a full-stack internal PM system used daily by all 11 team members',
      'Established frontend standards and boilerplates adopted across all client projects',
    ],
  },
  {
    id: 'drives', title: 'What Drives Me', items: [
      'Building systems that scale — tooling, workflows, and architectures that outlast any single project',
      'The intersection of engineering rigour and design quality',
    ],
  },
  {
    id: 'work', title: 'How I Work', items: [
      'Architecture-first: define the system before writing a line of code',
      'Lead by doing — from recovering hacked sites to directing GSAP pipelines',
      'Raise the floor, not just the ceiling: standards over heroic one-off fixes',
    ],
  },
];

// shorten a center→node vector so the arrowhead lands just before the node box
const end = (v: number) => 50 + (v - 50) * 0.78;

export default function AboutSection() {
  return (
    <section id="about" className="ab2">
      <div className="ab2-inner">
        {/* ── Left: bio ── */}
        <div className="ab2-left reveal">
          <p className="section-label">About Me</p>
          <h2 className="ab2-title">
            <span className="gold-glow">Technical leader by role,</span>
            <br />
            architect by craft.
          </h2>
          <div className="section-divider" />
          <p className="ab2-bio">
            Hi, I&apos;m <strong>Ahnaf Hussain</strong> — Head of Web Development at{' '}
            <strong>AurixLab</strong>. I lead a development team building high-performance websites,
            SaaS frontends, and data-driven digital products for clients across North America.
            Currently finishing my degree at <strong>BRAC University</strong> while running a
            professional engineering team full-time.
          </p>
          <p className="ab2-bio">
            My focus is on <strong>systems architecture</strong> — building internal boilerplates,
            component standards, and development workflows that let my team consistently deliver 90+
            SEO scores, GSAP-driven interactivity, and scalable frontend infrastructure at speed.
          </p>
          <div className="skills-wrap">
            {SKILLS.map((s) => (
              <span key={s} className="skill-tag">{s}</span>
            ))}
          </div>
        </div>

        {/* ── Right: architecture diagram + floating journey cards ── */}
        <div className="ab2-stage reveal">
          <div className="ab2-panel">
            <svg className="ab2-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="ab2arrow" markerWidth="3" markerHeight="3" refX="3" refY="1.5"
                  orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L3,1.5 L0,3 Z" className="ab2-arrowhead" />
                </marker>
              </defs>
              {NODES.map((n) => (
                <line
                  key={n.id}
                  x1="50" y1="50" x2={end(n.x)} y2={end(n.y)}
                  className="ab2-link" markerEnd="url(#ab2arrow)"
                />
              ))}
            </svg>

            <div className="ab2-core">
              <span>Core Systems</span>
              <span>Architecture</span>
            </div>

            {NODES.map((n, i) => (
              <div key={n.id} className="ab2-node" style={{ left: `${n.x}%`, top: `${n.y}%`, animationDelay: `${i * 0.55}s` }}>
                <span className="ab2-node-label">{n.label}</span>
                {n.sub && <span className="ab2-node-sub">{n.sub}</span>}
              </div>
            ))}

            <div className="ab2-logos">
              {LOGOS.map((l) => (
                <span key={l.key} className="ab2-logo">
                  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
                    <path d={l.icon.path} />
                  </svg>
                </span>
              ))}
            </div>
          </div>

          {CARDS.map((c, i) => (
            <div key={c.id} className={`ab2-card ab2-card--${c.id}`} style={{ animationDelay: `${0.4 + i * 0.3}s` }}>
              <h3>{c.title}</h3>
              <ul>
                {c.items.map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
