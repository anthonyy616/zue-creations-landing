"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateProjectPublic } from "@/lib/revalidate";
import { getMediaObjectKeys } from "@/lib/media";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
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
  revalidateProjectPublic(created.slug, created.category);
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

  revalidateProjectPublic(updated.slug, updated.category);
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

  // Remove stored R2 objects first so uploads aren't orphaned when the
  // project (and its cascaded media rows) is deleted.
  const mediaRows = await db
    .select({ storageKey: media.storageKey, variants: media.variants })
    .from(media)
    .where(eq(media.projectId, id));

  if (mediaRows.length > 0) {
    const objects = mediaRows.flatMap((row) =>
      getMediaObjectKeys(row.storageKey, row.variants)
    );
    try {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: objects, Quiet: true },
        })
      );
    } catch (err) {
      console.error("R2 object deletion failed for project", id, err);
      return { ok: false, error: "Failed to delete stored files" };
    }
  }

  await db.delete(projects).where(eq(projects.id, id));
  revalidateProjectPublic(existing.slug, existing.category);
  return { ok: true };
}

async function getProjectByIdForAction(id: string) {
  const rows = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}
