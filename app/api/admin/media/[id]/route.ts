import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { buildMediaView } from "@/lib/media";
import { info, warn } from "@/lib/log";

const patchSchema = z.object({
  title: z.string().trim().max(200).optional(),
  /** Manual lifecycle marking (MVP Stream mode: admin flips to ready/failed
   *  after checking the Cloudflare dashboard; also used to hide/show). */
  status: z
    .enum(["processing", "ready", "failed", "unpublished"])
    .optional(),
  description: z.string().trim().max(2000).optional(),
  altText: z.string().trim().max(300).optional(),
  previewEnabled: z.boolean().optional(),
  previewStartSeconds: z.coerce.number().int().min(0).max(86399).optional(),
  previewDurationSeconds: z.coerce.number().int().min(1).max(30).optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  /** R2 key of an uploaded custom poster (already present in the bucket). */
  customPosterKey: z.string().regex(/^media\/.+/).max(500).optional(),
});

/**
 * PATCH /api/admin/media/:id — edit media metadata (title, description,
 * preview + poster settings, SEO fields). Admin-only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminSession())) {
    warn("Media patch: unauthorized request", undefined, {
      operation: "media.patch",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    warn("Media patch: validation failed", undefined, {
      operation: "media.patch",
      context: { issues: parsed.error.issues },
      status: 400,
    });
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const updates: Partial<typeof media.$inferInsert> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.status !== undefined) {
    updates.status = d.status;
    if (d.status === "ready" || d.status === "failed") {
      updates.publishedAt = row.publishedAt ?? new Date();
    }
  }
  if (d.description !== undefined) updates.description = d.description;
  if (d.altText !== undefined) updates.altText = d.altText;
  if (d.previewEnabled !== undefined) updates.previewEnabled = d.previewEnabled;
  if (d.previewStartSeconds !== undefined) updates.previewStartSeconds = d.previewStartSeconds;
  if (d.previewDurationSeconds !== undefined) updates.previewDurationSeconds = d.previewDurationSeconds;
  if (d.seoTitle !== undefined) updates.seoTitle = d.seoTitle;
  if (d.seoDescription !== undefined) updates.seoDescription = d.seoDescription;
  if (d.customPosterKey !== undefined) {
    updates.customPosterKey = d.customPosterKey;
    // Update the immutable derived thumbnail timestamp reference if present.
  }

  const [updated] = await db.update(media).set(updates).where(eq(media.id, id)).returning();

  const [project] = await db
    .select({ slug: projects.slug, category: projects.category })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .limit(1);
  if (project) revalidateMediaForProject(project.slug, project.category);

  info("Media patch: metadata updated", {
    operation: "media.patch",
    context: { mediaId: id, fields: Object.keys(d) },
  });

  return NextResponse.json({ media: buildMediaView(updated!) });
}
