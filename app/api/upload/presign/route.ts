import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import slugify from "slugify";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET_NAME, isR2Configured } from "@/lib/r2";
import { requireAdminSession } from "@/lib/session";
import { info, warn, error } from "@/lib/log";

const ALLOWED_CONTENT_TYPES =
  /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Upload presign: unauthorized request", undefined, {
      operation: "upload.presign",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }
  if (!isR2Configured()) {
    error("Upload presign: R2 not configured", undefined, {
      operation: "upload.presign",
      status: 503,
    });
    return NextResponse.json(
      { error: "Uploads aren't available right now. Please try again later." },
      { status: 503 }
    );
  }

  let body: { filename?: string; contentType?: string };
  try {
    body = await request.json();
  } catch {
    error("Upload presign: failed to parse request body", undefined, {
      operation: "upload.presign",
      status: 400,
    });
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const filename = body.filename?.trim();
  const contentType = body.contentType?.trim();
  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_CONTENT_TYPES.test(contentType)) {
    warn("Upload presign: disallowed content type", undefined, {
      operation: "upload.presign",
      context: { contentType },
      status: 415,
    });
    return NextResponse.json(
      { error: "That file type isn't allowed. Please upload an image (JPEG, PNG, WebP, GIF, AVIF) or video (MP4, WebM, MOV)." },
      { status: 415 }
    );
  }
  if (filename.length > 200) {
    return NextResponse.json({ error: "Filename too long" }, { status: 400 });
  }

  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
  const base = slugify(dot === -1 ? filename : filename.slice(0, dot), {
    lower: true,
    strict: true,
  }).slice(0, 80);
  const key = `media/${randomUUID()}-${base || "file"}${ext ? `.${ext}` : ""}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 }
  );

  return NextResponse.json({ uploadUrl, key });
}
