import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media, projects, mediaTypeEnum } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { generateImageVariants } from "@/lib/image";
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
    .select({ id: projects.id, slug: projects.slug })
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

  let width: number | null = null;
  let height: number | null = null;
  let variantsJson: string | null = null;

  if (type === "image") {
    try {
      const result = await generateImageVariants(key);
      width = result.width;
      height = result.height;
      variantsJson = JSON.stringify(result.variants);
    } catch (err) {
      console.error("Variant generation failed", err);
      // Original is stored regardless; variants stay null so the original
      // URL is used everywhere.
    }
  }

  const [row] = await db
    .insert(media)
    .values({
      projectId,
      type,
      storageKey: key,
      variants: variantsJson,
      sortOrder,
      fileSizeBytes: fileSizeBytes ?? null,
      width,
      height,
    })
    .returning();

  revalidatePath(`/work/${project[0].slug}`);
  revalidatePath("/");

  return NextResponse.json({ media: buildMediaView(row) });
}
