"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { projectFormSchema } from "./schema";

import type { ProjectFormValues, ActionResult } from "./schema";
/** Converts a YYYY-MM-DD form value into a local-midnight Date (avoids timezone drift). */
function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeValues(values: ProjectFormValues) {
  return {
    ...values,
    date: parseDateInput(values.date),
    description: values.description || null,
    location: values.location || null,
    instagramUrl: values.instagramUrl || null,
    featured: values.featured ?? false,
    sortOrder: values.sortOrder ?? 0,
  };
}

/** Revalidates every public route that can display a project. */
function revalidateProjectPaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/photography");
  revalidatePath("/cinematography");
  revalidatePath("/branding");
  if (slug) revalidatePath(`/work/${slug}`);
}

export async function createProject(
  rawValues: ProjectFormValues
): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = projectFormSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = normalizeValues(parsed.data);

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, data.slug))
    .limit(1);
  if (existing[0]) {
    return { ok: false, error: "A project with this slug already exists" };
  }

  const [created] = await db.insert(projects).values(data).returning();
  revalidateProjectPaths(created.slug);
  redirect(`/admin/projects/${created.id}`);
}

export async function updateProject(
  id: string,
  rawValues: ProjectFormValues
): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Not authenticated" };
  }

  const parsed = projectFormSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = normalizeValues(parsed.data);

  const duplicate = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, data.slug))
    .limit(1);
  if (duplicate[0] && duplicate[0].id !== id) {
    return { ok: false, error: "A project with this slug already exists" };
  }

  const [updated] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  if (!updated) {
    return { ok: false, error: "Project not found" };
  }

  revalidateProjectPaths(updated.slug);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Not authenticated" };
  }

  const existing = await getProjectByIdForAction(id);
  if (!existing) {
    return { ok: false, error: "Project not found" };
  }

  // Media rows cascade on delete. R2 object cleanup is handled in the
  // media pipeline (deleteMedia) before a project with media is removed.
  await db.delete(projects).where(eq(projects.id, id));
  revalidateProjectPaths(existing.slug);
  return { ok: true };
}

async function getProjectByIdForAction(id: string) {
  const rows = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}
