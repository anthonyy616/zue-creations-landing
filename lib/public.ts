import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects, type Project, type ProjectCategory } from "@/db/schema";
import { buildMediaView, type MediaView } from "@/lib/media";

/**
 * Public media visibility rule (media-rules.md §15, plan Phase 10/16):
 * only ready/published media ever reaches the public frontend. Processing,
 * uploading, failed, unpublished and deleted rows are excluded here — the
 * single enforcement point for every public query.
 */
const PUBLIC_MEDIA_STATUSES = ["ready", "published"] as const;

function publicMediaWhere(projectId: string) {
  return and(
    eq(media.projectId, projectId),
    inArray(media.status, [...PUBLIC_MEDIA_STATUSES]),
    isNull(media.deletedAt)
  );
}



export type ProjectCard = Project & { cover: MediaView | null };

/** A project row plus every published media item, in display order. */
export type ProjectWithMedia = Project & { media: MediaView[] };

const MAX_HOME_PROJECTS = 6;

/** All public media rows for a set of project ids, grouped and ordered. */
async function mediaByProject(ids: string[]): Promise<Map<string, MediaView[]>> {
  const map = new Map<string, MediaView[]>();
  if (ids.length === 0) return map;
  const mediaRows = await db
    .select()
    .from(media)
    .where(
      and(
        inArray(media.projectId, ids),
        inArray(media.status, [...PUBLIC_MEDIA_STATUSES]),
        isNull(media.deletedAt)
      )
    )
    .orderBy(asc(media.sortOrder), asc(media.createdAt));
  for (const row of mediaRows) {
    const list = map.get(row.projectId);
    const view = buildMediaView(row);
    if (list) list.push(view);
    else map.set(row.projectId, [view]);
  }
  return map;
}

/** First media item per project (images preferred over videos). */
async function attachCovers(rows: Project[]): Promise<ProjectCard[]> {
  const byProject = await mediaByProject(rows.map((p) => p.id));
  return rows.map((project) => {
    const items = byProject.get(project.id);
    let cover: MediaView | null = null;
    if (items && items.length > 0) {
      cover = items.find((m) => m.type === "image") ?? items[0];
    }
    return { ...project, cover };
  });
}

/** All projects in a category, each with its complete media list. */
export const getCategoryProjectsWithMedia = cache(
  async (category: ProjectCategory): Promise<ProjectWithMedia[]> => {
    const rows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.category, category), eq(projects.published, true)))
      .orderBy(asc(projects.sortOrder), desc(projects.date), desc(projects.createdAt));
    const byProject = await mediaByProject(rows.map((p) => p.id));
    return rows.map((project) => ({
      ...project,
      media: byProject.get(project.id) ?? [],
    }));
  }
);

/** Projects for the home "Selected work" list: featured first, then order/date. */
export const getHomeProjects = cache(async (): Promise<ProjectCard[]> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.published, true))
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
      .where(and(eq(projects.category, category), eq(projects.published, true)))
      .orderBy(asc(projects.sortOrder), desc(projects.date), desc(projects.createdAt));
    return attachCovers(rows);
  }
);

/** Full project row by slug — published projects only (deduped per request). */
export const getPublicProject = cache(async (slug: string): Promise<Project | null> => {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.published, true)))
    .limit(1);
  return rows[0] ?? null;
});

/** Ordered public media views for a project (deduped per request). */
export const getProjectMediaViews = cache(
  async (projectId: string): Promise<MediaView[]> => {
    const rows = await db
      .select()
      .from(media)
      .where(publicMediaWhere(projectId))
      .orderBy(asc(media.sortOrder), asc(media.createdAt));
    return rows.map(buildMediaView);
  }
);

/** Public slugs only — used by generateStaticParams and the sitemap. */
export const getAllProjectSlugs = cache(async (): Promise<string[]> => {
  const rows = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.published, true));
  return rows.map((r) => r.slug);
});
