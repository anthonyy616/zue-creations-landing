"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateProjectPublic } from "@/lib/revalidate";
import { info, warn, error } from "@/lib/log";

export async function updateProjectSortOrder(
  orderedIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdminSession())) {
    warn("updateProjectSortOrder: unauthorized", undefined, { operation: "project.reorder", status: 401 });
    return { ok: false, error: "Please log in to continue." };
  }

  // Get the slug and category for each project to revalidate after update.
  const existing = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(inArray(projects.id, orderedIds));

  if (existing.length !== orderedIds.length) {
    warn("updateProjectSortOrder: project list changed", undefined, {
      operation: "project.reorder",
      context: { expectedCount: orderedIds.length, foundCount: existing.length },
      status: 409,
    });
    return { ok: false, error: "The project list has changed since you loaded the page. Please refresh and try again." };
  }

  try {
    await db.transaction(async (tx) => {
      for (const [index, id] of orderedIds.entries()) {
        await tx
          .update(projects)
          .set({ sortOrder: index })
          .where(eq(projects.id, id));
      }
    });

    info("updateProjectSortOrder: order updated", { operation: "project.reorder", context: { projectIds: orderedIds } });
    // Revalidate each project's public pages.
    for (const { slug, category } of existing) {
      revalidateProjectPublic(slug, category);
    }
    return { ok: true };
  } catch (err) {
    error("updateProjectSortOrder: database transaction failed", err, {
      operation: "project.reorder",
      context: { projectIds: orderedIds },
    });
    return { ok: false, error: "Couldn't save the new order. Please try again." };
  }
}
