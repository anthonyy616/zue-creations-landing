import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";

/** Fixed widths generated for every uploaded image (mirrors the loader in Phase 6). */
export const VARIANT_WIDTHS = [480, 960, 1920] as const;

export interface Variant {
  width: number;
  /** Height of the resized variant (aspect preserved from the original). */
  height: number;
  /** Object key of the WebP file, stored in the media row. */
  webpKey: string;
  /** Object key of the AVIF file, stored in the media row. */
  avifKey: string;
}

export type VariantMap = { sm: Variant | null; md: Variant | null; lg: Variant | null };

/**
 * Deterministic variant key for an original key: <base-without-ext>-<width>.webp|avif.
 * Phase 6's next/image loader derives variant URLs from this pattern, so it
 * must never change without updating the loader.
 */
export function variantKey(
  storageKey: string,
  width: number,
  format: "webp" | "avif"
): string {
  const dot = storageKey.lastIndexOf(".");
  const base = dot === -1 ? storageKey : storageKey.slice(0, dot);
  return `${base}-${width}.${format}`;
}

/**
 * Generates a tiny blurred placeholder (LQIP) synchronously and cheaply —
 * a ~20px-wide, heavily-compressed WebP thumbnail, base64 inlined as a data
 * URL. Small enough to store directly in the DB row (no R2 round-trip).
 * Near-instant even on large originals.
 */
export async function generateLQIP(storageKey: string): Promise<string> {
  const originalBuffer = await sharpBufferFromR2(storageKey);
  const buf = await sharp(originalBuffer)
    .resize({ width: 20, withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

/**
 * Fetches the original from R2, generates <480/960/1920>px variants in WebP
 * and AVIF (never upscaling), uploads them back to R2, and returns the
 * variant map plus the original's dimensions.
 *
 * Widths are processed in parallel for maximum throughput.
 */
export async function generateImageVariants(
  storageKey: string
): Promise<{ variants: VariantMap; width: number | null; height: number | null }> {
  const originalBuffer = await sharpBufferFromR2(storageKey);
  const metadata = await sharp(originalBuffer).metadata();

  const effectiveWidths = VARIANT_WIDTHS.filter(
    (w) => !metadata.width || w < metadata.width
  );

  const variants: VariantMap = { sm: null, md: null, lg: null };
  const nameByWidth: Record<number, keyof VariantMap> = { 480: "sm", 960: "md", 1920: "lg" };

  // Process all widths in parallel (not sequentially).
  await Promise.all(
    effectiveWidths.map(async (width) => {
      const baseImage = sharp(originalBuffer).resize({
        width,
        withoutEnlargement: true,
      });

      const webpKey = variantKey(storageKey, width, "webp");
      const avifKey = variantKey(storageKey, width, "avif");

      const [webpResult, avifResult] = await Promise.all([
        baseImage.clone().webp({ quality: 78 }).toBuffer({ resolveWithObject: true }),
        baseImage.clone().avif({ quality: 50 }).toBuffer({ resolveWithObject: true }),
      ]);

      const resizedHeight = webpResult.info.height;

      await Promise.all([
        r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: webpKey,
            Body: webpResult.data,
            ContentType: "image/webp",
            CacheControl: "public, max-age=31536000, immutable",
          })
        ),
        r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: avifKey,
            Body: avifResult.data,
            ContentType: "image/avif",
            CacheControl: "public, max-age=31536000, immutable",
          })
        ),
      ]);

      variants[nameByWidth[width]] = {
        width,
        height: resizedHeight,
        webpKey,
        avifKey,
      };
    })
  );

  return { variants, width: metadata.width ?? null, height: metadata.height ?? null };
}

async function sharpBufferFromR2(storageKey: string): Promise<Buffer> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("Empty object returned from R2");
  return Buffer.from(bytes);
}
