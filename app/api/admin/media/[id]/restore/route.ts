import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { buildMediaView } from "@/lib/media";
import { info, warn } from "@/lib/log";

/**
 * Restore a soft-deleted Stream video (plan Phase 15). The row returns to
 * `ready` — never straight to `published` — so the admin consciously
 * re-publishes. R2 media is hard-deleted on delete and cannot be restored.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminSession())) {
    warn("Media restore: unauthorized request", undefined, {
      operation: "media.restore",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (row.status !== "deleted") {
    warn("Media restore: media not soft-deleted", undefined, {
      operation: "media.restore",
      context: { mediaId: id, status: row.status },
      status: 400,
    });
    return NextResponse.json(
      { error: "Only deleted videos can be restored." },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(media)
    .set({
      status: "ready",
      deletedAt: null,
      deletedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(media.id, id))
    .returning();

  const [project] = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);
  if (project) revalidateMediaForProject(project.slug, project.category);

  info("Media restore: stream video restored to ready", {
    operation: "media.restore",
    context: { mediaId: id, streamUid: row.providerAssetId },
  });

  return NextResponse.json({ media: buildMediaView(updated!) });
}
