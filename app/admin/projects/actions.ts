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
import { info, warn, error, logAndReturnError } from "@/lib/log";

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
    warn("createProject: unauthorized", undefined, { operation: "project.create", status: 401 });
    return { ok: false, error: "Please log in to continue." };
  }

  const parsed = projectFormSchema.safeParse(rawValues);
  if (!parsed.success) {
    warn("createProject: validation failed", undefined, {
      operation: "project.create",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please fix the form errors." };
  }

  const data = normalizeValues(parsed.data);

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, data.slug))
    .limit(1);
  if (existing[0]) {
    warn("createProject: duplicate slug", undefined, {
      operation: "project.create",
      context: { slug: data.slug },
      status: 400,
    });
    return { ok: false, error: "A project with this web address already exists. Try a different one." };
  }

  try {
    const [created] = await db.insert(projects).values(data).returning();
    info("createProject: project created", { operation: "project.create", context: { projectId: created.id, slug: created.slug } });
    revalidateProjectPublic(created.slug, created.category);
    redirect(`/admin/projects/${created.id}`);
  } catch (err) {
    error("createProject: database insert failed", err, {
      operation: "project.create",
      context: { slug: data.slug, title: data.title },
    });
    return { ok: false, error: "Couldn't create the project. Please try again." };
  }
}

export async function updateProject(
  id: string,
  rawValues: ProjectFormValues
): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    warn("updateProject: unauthorized", undefined, { operation: "project.update", context: { projectId: id }, status: 401 });
    return { ok: false, error: "Please log in to continue." };
  }

  const parsed = projectFormSchema.safeParse(rawValues);
  if (!parsed.success) {
    warn("updateProject: validation failed", undefined, {
      operation: "project.update",
      context: { projectId: id, issues: parsed.error.issues },
      status: 400,
    });
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please fix the form errors." };
  }

  const data = normalizeValues(parsed.data);

  const duplicate = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, data.slug))
    .limit(1);
  if (duplicate[0] && duplicate[0].id !== id) {
    warn("updateProject: duplicate slug", undefined, {
      operation: "project.update",
      context: { projectId: id, slug: data.slug },
      status: 400,
    });
    return { ok: false, error: "Another project already uses this web address. Try a different one." };
  }

  try {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      error("updateProject: project not found", undefined, {
        operation: "project.update",
        context: { projectId: id },
        status: 404,
      });
      return { ok: false, error: "Project not found." };
    }

    info("updateProject: project updated", { operation: "project.update", context: { projectId: id, slug: updated.slug } });
    revalidateProjectPublic(updated.slug, updated.category);
    return { ok: true };
  } catch (err) {
    error("updateProject: database update failed", err, {
      operation: "project.update",
      context: { projectId: id },
    });
    return { ok: false, error: "Couldn't save the changes. Please try again." };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    warn("deleteProject: unauthorized", undefined, { operation: "project.delete", status: 401 });
    return { ok: false, error: "Please log in to continue." };
  }

  const existing = await getProjectByIdForAction(id);
  if (!existing) {
    error("deleteProject: project not found", undefined, {
      operation: "project.delete",
      context: { projectId: id },
      status: 404,
    });
    return { ok: false, error: "Project not found." };
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
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      if (errObj.Code === "MalformedXML") {
        warn("deleteProject: R2 DeleteObjects returned MalformedXML (objects likely deleted)", err, {
          operation: "project.delete",
          context: { projectId: id, mediaCount: mediaRows.length },
        });
      } else {
        error("deleteProject: R2 object deletion failed", err, {
          operation: "project.delete",
          context: { projectId: id, mediaCount: mediaRows.length },
        });
        return { ok: false, error: "Couldn't delete the files from storage. Please try again." };
      }
    }
  }

  try {
    await db.delete(projects).where(eq(projects.id, id));
    info("deleteProject: project deleted", { operation: "project.delete", context: { projectId: id, slug: existing.slug } });
    revalidateProjectPublic(existing.slug, existing.category);
    return { ok: true };
  } catch (err) {
    error("deleteProject: database delete failed", err, {
      operation: "project.delete",
      context: { projectId: id, slug: existing.slug },
    });
    return { ok: false, error: "Couldn't delete the project. Please try again." };
  }
}

async function getProjectByIdForAction(id: string) {
  const rows = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return rows[0] ?? null;
}
