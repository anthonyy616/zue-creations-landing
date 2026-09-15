import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { buildMediaView } from "@/lib/media";
import { info, warn, error } from "@/lib/log";

const completeSchema = z.object({
  mediaId: z.string().uuid(),
  /** Optional Stream UID cross-check (guards against stale client state). */
  streamUid: z.string().min(10).max(100).optional(),
});

/**
 * Called by the CMS after the browser finished the TUS upload directly to
 * Cloudflare Stream. Moves the media from UPLOADING to PROCESSING. The
 * actual READY/FAILED transition happens via the Stream webhook — a
 * completed upload never means the video is playable yet.
 */
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Video complete: unauthorized request", undefined, {
      operation: "media.video.complete",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { mediaId, streamUid } = parsed.data;

  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row) {
    error("Video complete: media not found", undefined, {
      operation: "media.video.complete",
      context: { mediaId },
      status: 404,
    });
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (row.provider !== "cloudflare_stream" || !row.providerAssetId) {
    warn("Video complete: not a Stream asset", undefined, {
      operation: "media.video.complete",
      context: { mediaId, provider: row.provider },
      status: 400,
    });
    return NextResponse.json({ error: "This media is not a Stream video." }, { status: 400 });
  }

  if (streamUid && streamUid !== row.providerAssetId) {
    warn("Video complete: stream UID mismatch", undefined, {
      operation: "media.video.complete",
      context: { mediaId, expected: row.providerAssetId, received: streamUid },
      status: 409,
    });
    return NextResponse.json(
      { error: "Upload session mismatch. Please refresh and try again." },
      { status: 409 }
    );
  }

  // Idempotent: repeated "complete" calls are harmless.
  if (row.status !== "uploading") {
    info("Video complete: media not in uploading state (no-op)", {
      operation: "media.video.complete",
      context: { mediaId, status: row.status },
    });
    return NextResponse.json({ media: buildMediaView(row) });
  }

  const [updated] = await db
    .update(media)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(media.id, mediaId))
    .returning();

  const [project] = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);
  if (project) revalidateMediaForProject(project.slug, project.category);

  info("Video complete: status -> processing", {
    operation: "media.video.complete",
    context: { mediaId, streamUid: row.providerAssetId },
  });

  return NextResponse.json({ media: buildMediaView(updated!) });
}
