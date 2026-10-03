import { notFound } from 'next/navigation';
import { projectData, ProjectKey, stripMeta } from '@/lib/projects';
import ProjectPageContent from '@/components/ProjectPageContent';
import { projectSeo } from '@/lib/projectSeo';
import { projectGraph, jsonLd } from '@/lib/schema';

export function generateStaticParams() {
  return (Object.keys(projectData) as ProjectKey[]).map((key) => ({ key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const project = projectData[key as ProjectKey];
  if (!project) return {};
  const { title, description } = projectSeo[key as ProjectKey];
  const url = `/projects/${key}`;
  const image = `/${project.image}`;
  return {
    title,
    description,
    // Its own canonical: inheriting the homepage's folded every case study into it.
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article', images: [{ url: image, alt: project.title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const project = projectData[key as ProjectKey];
  if (!project) notFound();

  const meta = stripMeta.find((m) => m.key === key);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(projectGraph(key as ProjectKey)) }} />
      <ProjectPageContent project={project} meta={meta} />
    </>
  );
}
