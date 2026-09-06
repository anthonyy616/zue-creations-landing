import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { revalidateMediaForProject } from "@/lib/revalidate";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";
import { getMediaObjectKeys } from "@/lib/media";
import { info, warn, error } from "@/lib/log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdminSession())) {
    warn("Media delete: unauthorized request", undefined, {
      operation: "media.delete",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
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
    error("Media delete: media not found", undefined, {
      operation: "media.delete",
      context: { mediaId: id },
      status: 404,
    });
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const objects = getMediaObjectKeys(row.storageKey, row.variants);

  try {
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })), Quiet: true },
      })
    );
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown>;
    // R2 sometimes returns malformed XML for DeleteObjects even when the
    // objects were actually deleted. Treat MalformedXML as a non-fatal
    // warning — the media row is still removed from the DB below.
    if (errObj.Code === "MalformedXML") {
      warn("Media delete: R2 DeleteObjects returned MalformedXML (objects likely deleted)", err, {
        operation: "media.delete",
        context: { mediaId: id, storageKey: row.storageKey },
      });
    } else {
      error("Media delete: R2 object deletion failed", err, {
        operation: "media.delete",
        context: { mediaId: id, storageKey: row.storageKey },
      });
      return NextResponse.json(
        { error: "Couldn't delete the file from storage. Please try again." },
        { status: 500 }
      );
    }
  }

  await db.delete(media).where(eq(media.id, id));
  revalidateMediaForProject(row.slug, row.category);

  return NextResponse.json({ ok: true });
}
