"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { info, warn, error } from "@/lib/log";

export async function reorderMedia(
  projectId: string,
  orderedIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdminSession())) {
    warn("reorderMedia: unauthorized", undefined, { operation: "media.reorder", context: { projectId }, status: 401 });
    return { ok: false, error: "Please log in to continue." };
  }

  const [project] = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    error("reorderMedia: project not found", undefined, { operation: "media.reorder", context: { projectId }, status: 404 });
    return { ok: false, error: "Project not found." };
  }

  const existing = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.id, orderedIds));
  const existingIds = new Set(existing.map((m) => m.id));
  if (existing.length !== orderedIds.length) {
    warn("reorderMedia: media list changed", undefined, {
      operation: "media.reorder",
      context: { projectId, expectedCount: orderedIds.length, foundCount: existing.length },
      status: 409,
    });
    return { ok: false, error: "The media list has changed since you loaded the page. Please refresh and try again." };
  }

  try {
    await db.transaction(async (tx) => {
      for (const [index, id] of orderedIds.entries()) {
        if (!existingIds.has(id)) continue;
        await tx
          .update(media)
          .set({ sortOrder: index })
          .where(eq(media.id, id));
      }
    });

    info("reorderMedia: order updated", { operation: "media.reorder", context: { projectId, mediaIds: orderedIds } });
    revalidateMediaForProject(project.slug, project.category);
    return { ok: true };
  } catch (err) {
    error("reorderMedia: database transaction failed", err, {
      operation: "media.reorder",
      context: { projectId, mediaIds: orderedIds },
    });
    return { ok: false, error: "Couldn't save the new order. Please try again." };
  }
}
