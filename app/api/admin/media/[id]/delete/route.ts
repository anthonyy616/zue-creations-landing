import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { getMediaObjectKeys } from "@/lib/media";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { info, warn, error } from "@/lib/log";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

/**
 * Soft delete (plan Phase 15 / architecture.md §38):
 *  - Stream videos: mark DELETED (hidden publicly immediately). The Stream
 *    asset is NOT destroyed here — restoration stays possible and no
 *    provider API failure can block the delete. Hard provider cleanup is a
 *    separate, explicit admin action.
 *  - R2 media: keep the existing hard-delete behavior (objects + row) since
 *    images are cheap and re-uploads are trivial.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    warn("Media soft delete: unauthorized request", undefined, {
      operation: "media.softDelete",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({
      id: media.id,
      type: media.type,
      provider: media.provider,
      providerAssetId: media.providerAssetId,
      storageKey: media.storageKey,
      variants: media.variants,
      posterKey: media.posterKey,
      projectId: media.projectId,
      slug: projects.slug,
      category: projects.category,
    })
    .from(media)
    .innerJoin(projects, eq(media.projectId, projects.id))
    .where(eq(media.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  // ---- Stream video: soft delete only -------------------------------
  if (row.type === "video" && row.provider === "cloudflare_stream") {
    await db
      .update(media)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        deletedBy: session.userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(media.id, id));

    revalidateMediaForProject(row.slug, row.category);
    info("Media soft delete: stream video hidden", {
      operation: "media.softDelete",
      context: { mediaId: id, streamUid: row.providerAssetId },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  }

  // ---- R2 media: existing hard-delete behavior ----------------------
  const objects = row.storageKey
    ? getMediaObjectKeys(row.storageKey, row.variants)
    : [];
  if (row.posterKey) objects.push({ Key: row.posterKey });

  if (objects.length > 0) {
    try {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: objects, Quiet: true },
        })
      );
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      if (errObj.Code !== "MalformedXML") {
        error("Media soft delete: R2 object deletion failed", err, {
          operation: "media.softDelete",
          context: { mediaId: id },
        });
        return NextResponse.json(
          { error: "Couldn't delete the file from storage. Please try again." },
          { status: 500 }
        );
      }
    }
  }

  await db.delete(media).where(eq(media.id, id));
  revalidateMediaForProject(row.slug, row.category);
  return NextResponse.json({ ok: true, softDeleted: false });
}
