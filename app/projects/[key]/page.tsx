import { notFound } from 'next/navigation';
import Link from 'next/link';
import { projectData, ProjectKey, stripMeta } from '@/lib/projects';

export function generateStaticParams() {
  return (Object.keys(projectData) as ProjectKey[]).map((key) => ({ key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const project = projectData[key as ProjectKey];
  if (!project) return {};
  return {
    title: `${project.title} — Ahnaf Hussain`,
    description: project.sections[0]?.content?.replace(/<[^>]+>/g, '').slice(0, 160),
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const project = projectData[key as ProjectKey];
  if (!project) notFound();

  const meta = stripMeta.find((m) => m.key === key);

  return (
    <div className="proj-page">
      {/* Back */}
      <Link href="/#showcase" className="proj-back">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={16} height={16}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to Projects
      </Link>

      <div className="proj-content">
        {/* Header */}
        <header className="proj-header">
          <p className="section-label">{project.label}</p>
          <h1 className="proj-title">{project.title}</h1>
          {meta && (
            <div className="proj-tags">
              {meta.tags.map((t) => (
                <span key={t} className="modal-tech-tag">{t}</span>
              ))}
            </div>
          )}
          {project.link && (
            <a href={project.link} target="_blank" rel="noopener noreferrer" className="proj-live-link">
              Visit Live Site
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          )}
        </header>

        {/* Image */}
        {project.image ? (
          <div className="proj-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/${project.image}`} alt={`${project.title} screenshot`} loading="eager" />
          </div>
        ) : (
          <div className="proj-image empty">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} width={40} height={40}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Sections */}
        {project.sections.map((s, idx) => (
          <div key={idx} className="modal-section">
            <h3>{s.heading}</h3>
            {s.type === 'results' && s.items && (
              <div className="modal-results-grid">
                {s.items.map((item, i) => (
                  <div key={i} className="modal-result-card">
                    <span className="big">{item.big}</span>
                    <span className="label">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
            {s.type === 'tech' && s.tags && (
              <div className="modal-tech-tags">
                {s.tags.map((tag, i) => (
                  <span key={i} className="modal-tech-tag">{tag}</span>
                ))}
              </div>
            )}
            {!s.type && s.content && (
              <div dangerouslySetInnerHTML={{ __html: s.content }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
