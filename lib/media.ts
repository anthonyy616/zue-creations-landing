import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, type Media } from "@/db/schema";
import { publicMediaUrl } from "@/lib/r2";
import { streamThumbnailUrl, streamEmbedUrl } from "@/lib/stream";
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
  /** "r2" | "cloudflare_stream". */
  provider: "r2" | "cloudflare_stream";
  /** Stable Stream UID for Stream videos; R2 object key conceptually for images. */
  providerAssetId: string | null;
  /** Preferred display URL (md variant for images, original for legacy R2 video). */
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
  /** Lifecycle status (see db/schema.ts media_status enum). */
  status: "processing" | "ready" | "failed" | "uploading" | "published" | "unpublished" | "deleted";
  /** Inline base64 data URL for a tiny blurred placeholder. */
  lqipDataUrl: string | null;
  /** Public URL of the generated poster frame (legacy R2 videos; null if not generated). */
  posterUrl: string | null;
  /* --- video-only fields --- */
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  previewEnabled: boolean;
  previewStartSeconds: number;
  previewDurationSeconds: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  customPosterUrl: string | null;
  /** Derived Stream thumbnail (client-safe; built server-side from env). */
  streamThumbnailUrl: string | null;
  /** Derived Stream embed URL (only mounted after explicit click). */
  streamEmbedUrl: string | null;
};

/** Public-safe display fields shared by every media view. */
function baseViewFields(row: Media, status: MediaView["status"]) {
  return {
    width: row.width,
    height: row.height,
    fileSizeBytes: row.fileSizeBytes,
    altText: row.altText,
    sortOrder: row.sortOrder ?? 0,
    status,
    lqipDataUrl: row.lqipDataUrl ?? null,
    title: row.title,
    description: row.description,
    durationSeconds: row.durationSeconds,
    aspectRatio: row.aspectRatio,
    previewEnabled: row.previewEnabled,
    previewStartSeconds: row.previewStartSeconds,
    previewDurationSeconds: row.previewDurationSeconds,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
  };
}

/** Builds a client-friendly view with an absolute display URL resolved from stored keys. */
export function buildMediaView(row: Media): MediaView {
  const storageKey = row.storageKey ?? "";
  const originalUrl = storageKey ? publicMediaUrl(storageKey) : "";
  const status = (row.status as MediaView["status"]) ?? "ready";

  if (row.type === "video") {
    const customPosterUrl = row.customPosterKey ? publicMediaUrl(row.customPosterKey) : null;
    const legacyPosterUrl = row.posterKey ? publicMediaUrl(row.posterKey) : null;

    if (row.provider === "cloudflare_stream" && row.providerAssetId) {
      const view: MediaView = {
        id: row.id,
        type: "video",
        provider: "cloudflare_stream",
        providerAssetId: row.providerAssetId,
        url: "",
        originalUrl: "",
        variantWidths: [],
        ...baseViewFields(row, status),
        posterUrl: customPosterUrl ?? legacyPosterUrl,
        customPosterUrl,
        streamThumbnailUrl: streamThumbnailUrl(row.providerAssetId, {
          time: row.previewStartSeconds || undefined,
        }),
        streamEmbedUrl: streamEmbedUrl(row.providerAssetId),
      };
      return view;
    }

    // Legacy R2-hosted video (existing uploads keep working).
    const view: MediaView = {
      id: row.id,
      type: "video",
      provider: "r2",
      providerAssetId: storageKey || null,
      url: originalUrl,
      originalUrl,
      variantWidths: [],
      ...baseViewFields(row, status),
      posterUrl: customPosterUrl ?? legacyPosterUrl,
      customPosterUrl,
      streamThumbnailUrl: null,
      streamEmbedUrl: null,
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
    provider: "r2",
    providerAssetId: storageKey || null,
    url: display ? publicMediaUrl(display.webpKey) : originalUrl,
    originalUrl,
    variantWidths,
    ...baseViewFields(row, status),
    posterUrl: null,
    customPosterUrl: null,
    streamThumbnailUrl: null,
    streamEmbedUrl: null,
  };
  return view;
}
