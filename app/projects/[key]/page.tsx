import { notFound } from 'next/navigation';
import { projectData, ProjectKey, stripMeta } from '@/lib/projects';
import ProjectPageContent from '@/components/ProjectPageContent';

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

  return <ProjectPageContent project={project} meta={meta} />;
}
