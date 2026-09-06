import { NextResponse } from "next/server";
import { after } from "next/server";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects, mediaTypeEnum } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { generateImageVariants, generateLQIP } from "@/lib/image";
import { generateVideoPoster } from "@/lib/video-poster";
import { buildMediaView } from "@/lib/media";
import { info, warn, error } from "@/lib/log";

const confirmSchema = z.object({
  projectId: z.string().uuid(),
  key: z.string().regex(/^media\/.+/, "Invalid storage key"),
  type: z.enum(mediaTypeEnum.enumValues),
  fileSizeBytes: z.coerce.number().int().positive().max(50 * 1024 * 1024).optional(),
});

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Media confirm: unauthorized request", undefined, {
      operation: "media.confirm",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    error("Media confirm: failed to parse request body", undefined, {
      operation: "media.confirm",
      status: 400,
    });
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    warn("Media confirm: validation failed", undefined, {
      operation: "media.confirm",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { projectId, key, type, fileSizeBytes } = parsed.data;

  const project = await db
    .select({ id: projects.id, slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project[0]) {
    error("Media confirm: project not found", undefined, {
      operation: "media.confirm",
      context: { projectId },
      status: 404,
    });
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const [nextOrder] = await db
    .select({ value: max(media.sortOrder) })
    .from(media)
    .where(eq(media.projectId, projectId));
  const sortOrder = (nextOrder?.value ?? -1) + 1;

  // --- LQIP: generate synchronously (near-instant, ~20px thumbnail) ---
  let lqipDataUrl: string | null = null;
  if (type === "image") {
    try {
      lqipDataUrl = await generateLQIP(key);
    } catch (err) {
      warn("Media confirm: LQIP generation failed (non-fatal)", err, {
        operation: "media.confirm",
        context: { projectId, key },
      });
      // LQIP failure is non-fatal — we still insert the row.
    }
  }

  // --- Insert the row immediately with status: "processing" (images) or "ready" (videos) ---
  // Videos start as "ready" since no processing is needed; posters are generated async.
  const [row] = await db
    .insert(media)
    .values({
      projectId,
      type,
      storageKey: key,
      variants: null,
      sortOrder,
      fileSizeBytes: fileSizeBytes ?? null,
      width: null,
      height: null,
      status: type === "image" ? "processing" : "ready",
      lqipDataUrl,
      posterKey: null,
    })
    .returning();

  revalidateMediaForProject(project[0].slug, project[0].category);

  // --- Kick off processing AFTER the response is sent ---
  if (type === "image") {
    after(async () => {
      try {
        const result = await generateImageVariants(key);
        await db
          .update(media)
          .set({
            width: result.width,
            height: result.height,
            variants: JSON.stringify(result.variants),
            status: "ready",
          })
          .where(eq(media.id, row.id));

        info("Media confirm: variant generation completed", {
          operation: "media.confirm",
          context: { mediaId: row.id, key },
        });
        revalidateMediaForProject(project[0].slug, project[0].category);
      } catch (err) {
        error("Media confirm: variant generation failed", err, {
          operation: "media.confirm",
          context: { mediaId: row.id, key, projectId },
        });
        // Mark as failed so the admin can retry — never silently serve the
        // original as a permanent fallback.
        await db
          .update(media)
          .set({ status: "failed" })
          .where(eq(media.id, row.id));

        revalidateMediaForProject(project[0].slug, project[0].category);
      }
    });
  } else if (type === "video") {
    // Generate poster for videos after the response is sent
    after(async () => {
      try {
        const generatedKey = await generateVideoPoster(key);
        if (generatedKey) {
          await db
            .update(media)
            .set({ posterKey: generatedKey })
            .where(eq(media.id, row.id));

          info("Media confirm: video poster generated", {
            operation: "media.confirm",
            context: { mediaId: row.id, key, posterKey: generatedKey },
          });
          revalidateMediaForProject(project[0].slug, project[0].category);
        } else {
          warn("Media confirm: video poster generation returned null", undefined, {
            operation: "media.confirm",
            context: { mediaId: row.id, key },
          });
        }
      } catch (err) {
        error("Media confirm: video poster generation failed", err, {
          operation: "media.confirm",
          context: { mediaId: row.id, key, projectId },
        });
        // Poster generation failure is non-fatal — video is still usable,
        // just without a dedicated poster. The frontend will use fallback.
      }
    });
  }

  return NextResponse.json({ media: buildMediaView(row) });
}
