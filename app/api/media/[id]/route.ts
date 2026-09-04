import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { parseVariants } from "@/lib/media";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({
      id: media.id,
      storageKey: media.storageKey,
      variants: media.variants,
      slug: projects.slug,
      category: projects.category,
    })
    .from(media)
    .innerJoin(projects, eq(media.projectId, projects.id))
    .where(eq(media.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const objects = [{ Key: row.storageKey }];
  const variants = parseVariants(row.variants);
  if (variants) {
    for (const entry of Object.values(variants)) {
      if (!entry) continue;
      objects.push({ Key: entry.webpKey }, { Key: entry.jpegKey });
    }
  }

  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: { Objects: objects },
      })
    );
  } catch (err) {
    console.error("R2 object deletion failed", err);
    return NextResponse.json(
      { error: "Failed to delete stored files" },
      { status: 500 }
    );
  }

  await db.delete(media).where(eq(media.id, id));
  revalidateMediaForProject(row.slug, row.category);

  return NextResponse.json({ ok: true });
}
