"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateProjectPublic } from "@/lib/revalidate";

export async function updateProjectSortOrder(
  orderedIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Not authenticated" };
  }

  // Get the slug and category for each project to revalidate after update.
  const existing = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(inArray(projects.id, orderedIds));

  const existingMap = new Map(existing.map((p) => [p.id, p]));
  if (existing.length !== orderedIds.length) {
    return { ok: false, error: "Project list changed; refresh and try again" };
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(projects)
        .set({ sortOrder: index })
        .where(eq(projects.id, id));
    }
  });

  // Revalidate each project's public pages.
  for (const { slug, category } of existing) {
    revalidateProjectPublic(slug, category);
  }

  return { ok: true };
}
