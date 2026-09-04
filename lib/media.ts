import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, type Media } from "@/db/schema";
import { publicMediaUrl } from "@/lib/r2";
import type { VariantMap } from "@/lib/image";

export async function getMediaByProject(projectId: string): Promise<Media[]> {
  return db
    .select()
    .from(media)
    .where(eq(media.projectId, projectId))
    .orderBy(asc(media.sortOrder), asc(media.createdAt));
}

export function parseVariants(raw: string | null): VariantMap | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VariantMap;
  } catch {
    return null;
  }
}

/** How the media list prefers to display an image: md, else sm, else lg, else original. */
export function pickDisplayVariant(variants: VariantMap | null) {
  if (!variants) return null;
  return variants.md ?? variants.sm ?? variants.lg;
}

export type MediaView = {
  id: string;
  type: "image" | "video";
  url: string;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  altText: string | null;
  sortOrder: number;
};

/** Builds a client-friendly view with an absolute display URL resolved from stored keys. */
export function buildMediaView(row: Media): MediaView {
  const originalUrl = publicMediaUrl(row.storageKey);

  if (row.type === "video") {
    const view: MediaView = {
      id: row.id,
      type: "video",
      url: originalUrl,
      width: row.width,
      height: row.height,
      fileSizeBytes: row.fileSizeBytes,
      altText: row.altText,
      sortOrder: row.sortOrder ?? 0,
    };
    return view;
  }

  const variants = parseVariants(row.variants);
  const display = pickDisplayVariant(variants);

  const view: MediaView = {
    id: row.id,
    type: "image",
    url: display ? publicMediaUrl(display.webpKey) : originalUrl,
    width: display?.width ?? row.width,
    height: display?.height ?? row.height,
    fileSizeBytes: row.fileSizeBytes,
    altText: row.altText,
    sortOrder: row.sortOrder ?? 0,
  };
  return view;
}
