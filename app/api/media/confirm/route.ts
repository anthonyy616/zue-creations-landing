import { NextResponse } from "next/server";
import { after } from "next/server";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects, mediaTypeEnum } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { generateImageVariants, generateLQIP } from "@/lib/image";
import { buildMediaView } from "@/lib/media";

const confirmSchema = z.object({
  projectId: z.string().uuid(),
  key: z.string().regex(/^media\/.+/, "Invalid storage key"),
  type: z.enum(mediaTypeEnum.enumValues),
  fileSizeBytes: z.coerce.number().int().positive().max(50 * 1024 * 1024).optional(),
});

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
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
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
      console.error("LQIP generation failed (non-fatal)", err);
      // LQIP failure is non-fatal — we still insert the row.
    }
  }

  // --- Insert the row immediately with status: "processing" ---
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
    })
    .returning();

  revalidateMediaForProject(project[0].slug, project[0].category);

  // --- Kick off variant generation AFTER the response is sent ---
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

        revalidateMediaForProject(project[0].slug, project[0].category);
      } catch (err) {
        console.error("Variant generation failed", err);
        // Mark as failed so the admin can retry — never silently serve the
        // original as a permanent fallback.
        await db
          .update(media)
          .set({ status: "failed" })
          .where(eq(media.id, row.id));

        revalidateMediaForProject(project[0].slug, project[0].category);
      }
    });
  }

  return NextResponse.json({ media: buildMediaView(row) });
}
