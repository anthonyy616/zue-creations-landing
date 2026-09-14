import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { media } from "@/db/schema";
import { requireAdminSession } from "@/lib/session";
import { buildMediaView } from "@/lib/media";
import { warn } from "@/lib/log";

const statusSchema = z.object({
  mediaIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * CMS polling endpoint: returns current media rows so upload/processing
 * states stay fresh without a full page reload. Admin-only; safe fields only.
 */
export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    warn("Video status: unauthorized request", undefined, {
      operation: "media.video.status",
      status: 401,
    });
    return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(media)
    .where(inArray(media.id, parsed.data.mediaIds));

  return NextResponse.json({ media: rows.map(buildMediaView) });
}
