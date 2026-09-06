import { NextResponse } from "next/server";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { generateImageVariants } from "@/lib/image";
import { buildMediaView } from "@/lib/media";
import { info, warn, error } from "@/lib/log";

const retrySchema = z.object({
  mediaId: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Media retry: unauthorized request", undefined, {
      operation: "media.retry",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    error("Media retry: failed to parse request body", undefined, {
      operation: "media.retry",
      status: 400,
    });
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    warn("Media retry: validation failed", undefined, {
      operation: "media.retry",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, parsed.data.mediaId))
    .limit(1);

  if (!row) {
    error("Media retry: media not found", undefined, {
      operation: "media.retry",
      context: { mediaId: parsed.data.mediaId },
      status: 404,
    });
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  if (row.type !== "image") {
    warn("Media retry: attempted on non-image media", undefined, {
      operation: "media.retry",
      context: { mediaId: parsed.data.mediaId, mediaType: row.type },
      status: 400,
    });
    return NextResponse.json({ error: "Only images can be retried." }, { status: 400 });
  }

  // Mark as processing immediately so the UI reflects the state.
  await db.update(media).set({ status: "processing" }).where(eq(media.id, row.id));

  const project = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);

  if (project[0]) {
    revalidateMediaForProject(project[0].slug, project[0].category);
  }

  // Kick off variant generation after the response.
  after(async () => {
    try {
      const result = await generateImageVariants(row.storageKey);
      await db
        .update(media)
        .set({
          width: result.width,
          height: result.height,
          variants: JSON.stringify(result.variants),
          status: "ready",
        })
        .where(eq(media.id, row.id));

      info("Media retry: variant generation completed", {
        operation: "media.retry",
        context: { mediaId: row.id, key: row.storageKey },
      });
    } catch (err) {
      error("Media retry: variant generation failed", err, {
        operation: "media.retry",
        context: { mediaId: row.id, key: row.storageKey },
      });
      await db.update(media).set({ status: "failed" }).where(eq(media.id, row.id));
    }

    if (project[0]) {
      revalidateMediaForProject(project[0].slug, project[0].category);
    }
  });

  // Re-fetch the row to return the updated view.
  const [updated] = await db.select().from(media).where(eq(media.id, row.id)).limit(1);
  return NextResponse.json({ media: buildMediaView(updated!) });
}
