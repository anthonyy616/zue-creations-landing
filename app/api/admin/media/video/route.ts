import { NextResponse } from "next/server";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { buildMediaView } from "@/lib/media";
import { isStreamPlaybackConfigured } from "@/lib/stream";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { info, warn } from "@/lib/log";

/**
 * MVP manual Stream video mode:
 *  1. Admin uploads the video in the Cloudflare Stream dashboard.
 *  2. Admin copies the video UID.
 *  3. Admin pastes it here. The UID is stored as providerAssetId and the
 *     poster/preview/embed URLs are derived from it — the app never calls
 *     the Stream upload API. The admin marks the video READY manually once
 *     Stream has finished processing (media PATCH, status field).
 */

const uidSchema = z.object({
  projectId: z.string().uuid(),
  // Stream UIDs are 32 lowercase hex chars; accept a pasted embed/preview URL
  // too and extract the UID from it, otherwise validate the raw UID shape.
  video: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .transform((value, ctx) => {
      // Accept a full Stream URL: .../<uid>/... or .../embed/<uid>
      const urlMatch = value.match(
        /^(?:https?:\/\/)?[a-z0-9-]+\.cloudflarestream\.com\/(?:embed\/)?([0-9a-f]{32})(?:[/?]|$)/i
      );
      const uid = (urlMatch?.[1] ?? value).toLowerCase();
      if (!/^[0-9a-f]{32}$/.test(uid)) {
        ctx.addIssue({
          code: "custom",
          message:
            "That doesn't look like a Stream video UID. Copy the 32-character ID (or the video URL) from the Cloudflare dashboard.",
        });
        return z.NEVER;
      }
      return uid;
    }),
  title: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Video add: unauthorized request", undefined, {
      operation: "media.video.add",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  if (!isStreamPlaybackConfigured()) {
    warn("Video add: Stream playback not configured", undefined, {
      operation: "media.video.add",
      status: 503,
    });
    return NextResponse.json(
      { error: "Video playback isn't configured yet (missing Stream subdomain). Please try again later." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = uidSchema.safeParse(body);
  if (!parsed.success) {
    warn("Video add: validation failed", undefined, {
      operation: "media.video.add",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { projectId, video: uid, title } = parsed.data;

  const [project] = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // One Stream video can only be referenced once.
  const [existing] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.providerAssetId, uid))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "That video UID has already been added." },
      { status: 409 }
    );
  }

  const [nextOrder] = await db
    .select({ value: max(media.sortOrder) })
    .from(media)
    .where(eq(media.projectId, projectId));
  const sortOrder = (nextOrder?.value ?? -1) + 1;

  const [row] = await db
    .insert(media)
    .values({
      projectId,
      type: "video",
      provider: "cloudflare_stream",
      providerAssetId: uid,
      storageKey: null,
      // Admin manually flips this to "ready" (or "published") once Stream
      // shows the video as ready in its dashboard.
      status: "processing",
      sortOrder,
      title: title || "Stream video",
    })
    .returning();

  revalidateMediaForProject(project.slug, project.category);

  info("Video add: manual Stream UID stored", {
    operation: "media.video.add",
    context: { mediaId: row.id, streamUid: uid, projectId },
  });

  return NextResponse.json({ media: buildMediaView(row) });
}
