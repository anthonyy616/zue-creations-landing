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

/** All R2 object keys stored for one media item: original + generated variants. */
export function getMediaObjectKeys(
  storageKey: string,
  variants: string | null
): { Key: string }[] {
  const objects: { Key: string }[] = [{ Key: storageKey }];
  const parsed = parseVariants(variants);
  if (parsed) {
    for (const entry of Object.values(parsed)) {
      if (!entry) continue;
      objects.push({ Key: entry.webpKey }, { Key: entry.avifKey });
    }
  }
  return objects;
}

/** How the media list prefers to display an image: md, else sm, else lg, else original. */
export function pickDisplayVariant(variants: VariantMap | null) {
  if (!variants) return null;
  return variants.md ?? variants.sm ?? variants.lg;
}

export type MediaView = {
  id: string;
  type: "image" | "video";
  /** Preferred display URL (md variant for images, original for video). */
  url: string;
  /** Public URL of the original object (images only; for the image loader). */
  originalUrl: string;
  /** Widths (px) of the WebP variants that actually exist for this image. */
  variantWidths: number[];
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  altText: string | null;
  sortOrder: number;
  /** Processing status: "processing" | "ready" | "failed". */
  status: "processing" | "ready" | "failed";
  /** Inline base64 data URL for a tiny blurred placeholder. */
  lqipDataUrl: string | null;
};

/** Builds a client-friendly view with an absolute display URL resolved from stored keys. */
export function buildMediaView(row: Media): MediaView {
  const originalUrl = publicMediaUrl(row.storageKey);
  const status = (row.status as MediaView["status"]) ?? "ready";

  if (row.type === "video") {
    const view: MediaView = {
      id: row.id,
      type: "video",
      url: originalUrl,
      originalUrl,
      variantWidths: [],
      width: row.width,
      height: row.height,
      fileSizeBytes: row.fileSizeBytes,
      altText: row.altText,
      sortOrder: row.sortOrder ?? 0,
      status,
      lqipDataUrl: row.lqipDataUrl ?? null,
    };
    return view;
  }

  const variants = parseVariants(row.variants);
  const display = pickDisplayVariant(variants);
  const variantWidths = variants
    ? [variants.sm, variants.md, variants.lg]
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .map((v) => v.width)
        .sort((a, b) => a - b)
    : [];

  const view: MediaView = {
    id: row.id,
    type: "image",
    url: display ? publicMediaUrl(display.webpKey) : originalUrl,
    originalUrl,
    variantWidths,
    width: display?.width ?? row.width,
    height: display?.height ?? row.height,
    fileSizeBytes: row.fileSizeBytes,
    altText: row.altText,
    sortOrder: row.sortOrder ?? 0,
    status,
    lqipDataUrl: row.lqipDataUrl ?? null,
  };
  return view;
}
