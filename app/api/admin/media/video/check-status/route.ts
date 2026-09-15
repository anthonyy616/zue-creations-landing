import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects, type ProjectCategory } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { buildMediaView } from "@/lib/media";
import { getVideoStatus, isStreamConfigured, StreamConfigError } from "@/lib/stream";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { info, warn, error as logError } from "@/lib/log";

/**
 * No-webhook MVP: the backend polls Cloudflare's video details endpoint
 * (GET /accounts/{id}/stream/{uid}) for `readyToStream` instead of receiving
 * webhooks. Called by the admin "Check status" button and by automatic
 * polling from the admin screen while a video is processing.
 *
 * Transitions:
 *  - readyToStream === true            -> status READY + save duration/size
 *  - status.state === "error"          -> status FAILED
 *  - otherwise                         -> remain PROCESSING (no change)
 *
 * Idempotent: terminal states (ready/published/failed) are never overwritten;
 * the endpoint is safe to hit repeatedly.
 */

const checkSchema = z.object({
  /** Specific media ids to check; omitted = all uploading/processing videos. */
  mediaIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

function aspectRatio(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Video check-status: unauthorized request", undefined, {
      operation: "media.video.checkStatus",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  if (!isStreamConfigured()) {
    logError("Video check-status: Stream not configured", undefined, {
      operation: "media.video.checkStatus",
      status: 503,
    });
    return NextResponse.json(
      { error: "Video status checks aren't available right now. Please try again later." },
      { status: 503 }
    );
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Candidates: explicitly requested ids, or every pending Stream video.
  const where = parsed.data.mediaIds
    ? and(
        eq(media.provider, "cloudflare_stream"),
        inArray(media.id, parsed.data.mediaIds)
      )
    : and(
        eq(media.provider, "cloudflare_stream"),
        inArray(media.status, ["uploading", "processing"])
      );

  const rows = await db
    .select({
      id: media.id,
      providerAssetId: media.providerAssetId,
      status: media.status,
      projectId: media.projectId,
      slug: projects.slug,
      category: projects.category,
    })
    .from(media)
    .innerJoin(projects, eq(media.projectId, projects.id))
    .where(where);

  if (rows.length === 0) {
    return NextResponse.json({ media: [] });
  }

  const updated: ReturnType<typeof buildMediaView>[] = [];
  const projectRevalidations = new Map<
    string,
    { slug: string; category: ProjectCategory }
  >();

  for (const row of rows) {
    const uid = row.providerAssetId;
    if (!uid) continue;

    // Terminal states are never re-checked (idempotency).
    if (row.status === "ready" || row.status === "published" || row.status === "failed") {
      continue;
    }

    try {
      const video = await getVideoStatus(uid);
      const succeeded = video.readyToStream === true || video.status?.state === "ready";
      const errored = video.status?.state === "error";

      if (succeeded) {
        const [updatedRow] = await db
          .update(media)
          .set({
            status: "ready",
            durationSeconds: video.duration ? Math.round(video.duration) : undefined,
            width: video.input?.width ?? undefined,
            height: video.input?.height ?? undefined,
            aspectRatio: aspectRatio(video.input?.width, video.input?.height) ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(media.id, row.id))
          .returning();
        updated.push(buildMediaView(updatedRow!));
        projectRevalidations.set(row.projectId, {
          slug: row.slug,
          category: row.category as ProjectCategory,
        });
        info("Video check-status: ready", {
          operation: "media.video.checkStatus",
          context: { mediaId: row.id, streamUid: uid, duration: video.duration },
        });
      } else if (errored) {
        const [updatedRow] = await db
          .update(media)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(media.id, row.id))
          .returning();
        updated.push(buildMediaView(updatedRow!));
        projectRevalidations.set(row.projectId, {
          slug: row.slug,
          category: row.category as ProjectCategory,
        });
        logError("Video check-status: processing failed", undefined, {
          operation: "media.video.checkStatus",
          context: {
            mediaId: row.id,
            streamUid: uid,
            reasonCode: video.status?.errorReasonCode,
            reasonText: video.status?.errorReasonText,
          },
        });
      } else {
        // Still processing — report current state without changing the row.
        const [current] = await db.select().from(media).where(eq(media.id, row.id)).limit(1);
        if (current) updated.push(buildMediaView(current));
      }
    } catch (err) {
      if (err instanceof StreamConfigError) throw err;
      // Single-video Cloudflare failure shouldn't abort the batch — report
      // and continue with the rest.
      logError("Video check-status: Cloudflare request failed", err, {
        operation: "media.video.checkStatus",
        context: { mediaId: row.id, streamUid: uid },
      });
    }
  }

  for (const { slug, category } of projectRevalidations.values()) {
    revalidateMediaForProject(slug, category);
  }

  return NextResponse.json({
    media: updated,
    checked: rows.length,
  });
}
