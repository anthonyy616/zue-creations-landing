import { NextResponse } from "next/server";
import { max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import {
  createDirectUploadUrl,
  isStreamConfigured,
  StreamConfigError,
} from "@/lib/stream";
import { buildMediaView } from "@/lib/media";
import { info, warn, error } from "@/lib/log";
import { revalidateMediaForProject } from "@/lib/revalidate";

const MAX_DURATION_SECONDS = 4 * 60 * 60; // 4h — generous creative cap (Stream allows up to 12h)

const uploadUrlSchema = z.object({
  projectId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileSizeBytes: z.coerce.number().int().positive(),
  fileType: z
    .string()
    .trim()
    .regex(/^video\/(mp4|webm|quicktime|x-matroska|x-msvideo)$/, "Unsupported video format. Use MP4, WebM, MOV, MKV or AVI."),
});

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Video upload-url: unauthorized request", undefined, {
      operation: "media.video.uploadUrl",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  if (!isStreamConfigured()) {
    error("Video upload-url: Stream not configured", undefined, {
      operation: "media.video.uploadUrl",
      status: 503,
    });
    return NextResponse.json(
      { error: "Video uploads aren't available right now. Please try again later." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    warn("Video upload-url: validation failed", undefined, {
      operation: "media.video.uploadUrl",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { projectId, fileName, fileSizeBytes } = parsed.data;

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eqProject(projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    // 1. Ask Cloudflare Stream for a one-time direct upload session.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const direct = await createDirectUploadUrl({
      maxDurationSeconds: MAX_DURATION_SECONDS,
      creator: projectId,
      fileName,
      allowedOrigins: siteUrl ? [siteUrl.replace(/^https?:\/\//, "")] : undefined,
      requireSignedURLs: false,
    });

    // 2. Record the media row. providerAssetId = stable Stream UID.
    //    The temporary uploadURL is returned to the browser once but never stored.
    const [nextOrder] = await db
      .select({ value: max(media.sortOrder) })
      .from(media)
      .where(eqProjectMedia(projectId));
    const sortOrder = (nextOrder?.value ?? -1) + 1;

    const [row] = await db
      .insert(media)
      .values({
        projectId,
        type: "video",
        provider: "cloudflare_stream",
        providerAssetId: direct.uid,
        storageKey: null,
        status: "uploading",
        sortOrder,
        fileSizeBytes,
        title: fileName,
      })
      .returning();

    revalidateMediaForProject(project.slug, project.category);

    info("Video upload-url: session created", {
      operation: "media.video.uploadUrl",
      context: { mediaId: row.id, streamUid: direct.uid, projectId },
    });

    return NextResponse.json({
      media: buildMediaView(row),
      mediaId: row.id,
      streamUid: direct.uid,
      uploadUrl: direct.uploadURL,
    });
  } catch (err) {
    if (err instanceof StreamConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    error("Video upload-url: Cloudflare request failed", err, {
      operation: "media.video.uploadUrl",
      context: { projectId, fileName },
    });
    return NextResponse.json(
      { error: "Couldn't start the video upload. Please try again." },
      { status: 502 }
    );
  }
}

/* Local helpers keep the drizzle imports minimal. */
import { eq } from "drizzle-orm";
function eqProject(id: string) {
  return eq(projects.id, id);
}
function eqProjectMedia(projectId: string) {
  return eq(media.projectId, projectId);
}
