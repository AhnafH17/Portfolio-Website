import type { MetadataRoute } from 'next';
import { projectData, type ProjectKey } from '@/lib/projects';
import { SITE_URL } from '@/lib/site';

// Stable lastmod dates: bump one by hand only when that page's content really
// changes. `new Date()` here stamped every URL with the build time, so each
// deploy told Google every page had changed, and Google learns to ignore that.
const HOME_UPDATED = '2026-10-03';
const PROJECTS_UPDATED_DEFAULT = '2026-10-03';
const PROJECT_UPDATED: Partial<Record<ProjectKey, string>> = {};

export default function sitemap(): MetadataRoute.Sitemap {
  const projects = (Object.keys(projectData) as ProjectKey[]).map((key) => ({
    url: `${SITE_URL}/projects/${key}`,
    lastModified: PROJECT_UPDATED[key] ?? PROJECTS_UPDATED_DEFAULT,
    priority: 0.8,
  }));
  return [{ url: SITE_URL, lastModified: HOME_UPDATED, priority: 1 }, ...projects];
}
