import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { verifyStreamWebhook } from "@/lib/stream";
import { info, warn, error } from "@/lib/log";

/**
 * Cloudflare Stream webhook — fires when processing finishes (success or error).
 *
 * Body shape (see architecture.md §11 / Cloudflare docs):
 * {
 *   uid, readyToStream, thumbnail, duration, input: { width, height },
 *   status: { state: "ready" | "error", pctComplete, errorReasonCode, ... },
 *   meta: { name, ... }, created, modified
 * }
 *
 * Rules (media-rules.md §16):
 *  - Idempotent: duplicate events must not corrupt state.
 *  - Never exposes admin behavior publicly: unauthenticated requests that
 *    fail verification get a generic 400.
 *  - Only READY/FAILED transitions happen here. Failed videos never render
 *    publicly (public queries filter by status).
 */

type StreamWebhookBody = {
  uid?: string;
  readyToStream?: boolean;
  thumbnail?: string;
  duration?: number;
  input?: { width?: number; height?: number };
  status?: {
    state?: string;
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: Record<string, string | null>;
  created?: string;
};

function aspectRatio(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("webhook-signature");

  if (!verifyStreamWebhook(signature, rawBody)) {
    warn("Stream webhook: signature verification failed", undefined, {
      operation: "stream.webhook",
      status: 400,
      context: { hasSignature: Boolean(signature) },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: StreamWebhookBody;
  try {
    body = JSON.parse(rawBody) as StreamWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const uid = body.uid;
  if (!uid) {
    warn("Stream webhook: missing uid", undefined, { operation: "stream.webhook", status: 400 });
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.providerAssetId, uid))
    .limit(1);

  if (!row) {
    // Not ours (or already hard-deleted). Acknowledge so Cloudflare stops retrying.
    info("Stream webhook: no media row for uid", {
      operation: "stream.webhook",
      context: { uid },
    });
    return NextResponse.json({ ok: true });
  }

  // Idempotency: terminal states are never overwritten by repeats.
  if (row.status === "ready" || row.status === "published" || row.status === "failed") {
    info("Stream webhook: media already in terminal state", {
      operation: "stream.webhook",
      context: { uid, status: row.status },
    });
    return NextResponse.json({ ok: true });
  }

  const state = body.status?.state;
  const succeeded = body.readyToStream === true || state === "ready";

  if (succeeded) {
    await db
      .update(media)
      .set({
        status: "ready",
        durationSeconds: body.duration ? Math.round(body.duration) : row.durationSeconds,
        width: body.input?.width ?? row.width,
        height: body.input?.height ?? row.height,
        aspectRatio: aspectRatio(body.input?.width, body.input?.height) ?? row.aspectRatio,
        updatedAt: new Date(),
      })
      .where(eq(media.id, row.id));

    info("Stream webhook: video ready", {
      operation: "stream.webhook",
      context: { uid, mediaId: row.id, duration: body.duration },
    });
  } else {
    await db
      .update(media)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(media.id, row.id));

    error("Stream webhook: video processing failed", undefined, {
      operation: "stream.webhook",
      context: {
        uid,
        mediaId: row.id,
        reasonCode: body.status?.errorReasonCode,
        reasonText: body.status?.errorReasonText,
      },
    });
  }

  // Revalidate the project's public pages so processing videos never linger
  // in rendered output (though public queries already filter by status).
  const [project] = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);
  if (project) revalidateMediaForProject(project.slug, project.category);

  return NextResponse.json({ ok: true });
}
