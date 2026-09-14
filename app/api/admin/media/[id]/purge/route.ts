import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { deleteVideo } from "@/lib/stream";
import { info, warn, error } from "@/lib/log";

/**
 * Explicit provider hard delete (plan Phase 15 / architecture.md §38.3).
 * Destroys the Cloudflare Stream asset AND the media row. Only reachable
 * through an explicit admin confirmation — never called automatically.
 * media-rules.md §18: don't pay indefinitely for unused media.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminSession())) {
    warn("Media purge: unauthorized request", undefined, {
      operation: "media.purge",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({
      id: media.id,
      providerAssetId: media.providerAssetId,
      provider: media.provider,
      slug: projects.slug,
      category: projects.category,
    })
    .from(media)
    .innerJoin(projects, eq(media.projectId, projects.id))
    .where(eq(media.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (row.provider === "cloudflare_stream" && row.providerAssetId) {
    try {
      await deleteVideo(row.providerAssetId);
    } catch (err) {
      // Provider delete failed: don't lose the row — admin can retry purge.
      error("Media purge: Stream delete failed", err, {
        operation: "media.purge",
        context: { mediaId: id, streamUid: row.providerAssetId },
      });
      return NextResponse.json(
        { error: "Couldn't delete the video from the CDN. Please try again." },
        { status: 502 }
      );
    }
  }

  await db.delete(media).where(eq(media.id, id));

  revalidateMediaForProject(row.slug, row.category);
  info("Media purge: stream asset destroyed and row removed", {
    operation: "media.purge",
    context: { mediaId: id, streamUid: row.providerAssetId },
  });

  return NextResponse.json({ ok: true });
}
