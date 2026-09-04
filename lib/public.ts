import { cache } from "react";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects, type Project, type ProjectCategory } from "@/db/schema";
import { buildMediaView, type MediaView } from "@/lib/media";

export type ProjectCard = Project & { cover: MediaView | null };

const MAX_HOME_PROJECTS = 6;

/** First media item per project (images preferred over videos). */
async function attachCovers(rows: Project[]): Promise<ProjectCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const mediaRows = await db
    .select()
    .from(media)
    .where(inArray(media.projectId, ids))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));

  const byProject = new Map<string, MediaView[]>();
  for (const row of mediaRows) {
    const list = byProject.get(row.projectId);
    const view = buildMediaView(row);
    if (list) list.push(view);
    else byProject.set(row.projectId, [view]);
  }

  return rows.map((project) => {
    const items = byProject.get(project.id);
    let cover: MediaView | null = null;
    if (items && items.length > 0) {
      cover = items.find((m) => m.type === "image") ?? items[0];
    }
    return { ...project, cover };
  });
}

/** Projects for the home "Selected work" list: featured first, then order/date. */
export const getHomeProjects = cache(async (): Promise<ProjectCard[]> => {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(
      desc(projects.featured),
      asc(projects.sortOrder),
      desc(projects.date),
      desc(projects.createdAt)
    )
    .limit(MAX_HOME_PROJECTS);
  return attachCovers(rows);
});

/** Projects for a discipline page, ordered like the admin sort order. */
export const getCategoryProjects = cache(
  async (category: ProjectCategory): Promise<ProjectCard[]> => {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.category, category))
      .orderBy(asc(projects.sortOrder), desc(projects.date), desc(projects.createdAt));
    return attachCovers(rows);
  }
);

/** Full project row by slug (deduped with generateMetadata via React cache). */
export const getPublicProject = cache(async (slug: string): Promise<Project | null> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return rows[0] ?? null;
});

/** Ordered media views for a project (deduped per request). */
export const getProjectMediaViews = cache(
  async (projectId: string): Promise<MediaView[]> => {
    const rows = await db
      .select()
      .from(media)
      .where(eq(media.projectId, projectId))
      .orderBy(asc(media.sortOrder), asc(media.createdAt));
    return rows.map(buildMediaView);
  }
);

/** All slugs — used by generateStaticParams for /work/[slug]. */
export const getAllProjectSlugs = cache(async (): Promise<string[]> => {
  const rows = await db.select({ slug: projects.slug }).from(projects);
  return rows.map((r) => r.slug);
});
