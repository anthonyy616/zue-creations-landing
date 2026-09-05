import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  media,
  projects,
  type Project,
  type ProjectCategory,
} from "@/db/schema";

export async function getProjectsForAdmin(): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .orderBy(asc(projects.sortOrder), asc(projects.createdAt));
}

export async function getProjectById(id: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export interface AdminDashboardStats {
  totalProjects: number;
  totalMedia: number;
  perCategory: Record<ProjectCategory, number>;
  mediaPerProject: Record<string, number>;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [categoryRows, mediaRows, mediaPerProjectRows, projectRows] =
    await Promise.all([
      db
        .select({ category: projects.category, value: count() })
        .from(projects)
        .groupBy(projects.category),
      db.select({ value: count() }).from(media),
      db
        .select({ projectId: media.projectId, value: count() })
        .from(media)
        .groupBy(media.projectId),
      db.select({ value: count() }).from(projects),
    ]);

  const perCategory = { photography: 0, cinematography: 0, branding: 0 };
  for (const row of categoryRows) {
    perCategory[row.category] = row.value;
  }

  const mediaPerProject: Record<string, number> = {};
  for (const row of mediaPerProjectRows) {
    mediaPerProject[row.projectId] = row.value;
  }

  return {
    totalProjects: projectRows[0]?.value ?? 0,
    totalMedia: mediaRows[0]?.value ?? 0,
    perCategory,
    mediaPerProject,
  };
}
