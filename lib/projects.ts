import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, type Project } from "@/db/schema";

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
