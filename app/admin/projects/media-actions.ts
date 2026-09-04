"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";

export async function reorderMedia(
  projectId: string,
  orderedIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAdminSession())) {
    return { ok: false, error: "Not authenticated" };
  }

  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, error: "Project not found" };

  const existing = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.id, orderedIds));
  const existingIds = new Set(existing.map((m) => m.id));
  if (existing.length !== orderedIds.length) {
    return { ok: false, error: "Media list changed; refresh and try again" };
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      if (!existingIds.has(id)) continue;
      await tx
        .update(media)
        .set({ sortOrder: index })
        .where(eq(media.id, id));
    }
  });

  revalidatePath(`/work/${project.slug}`);
  return { ok: true };
}
