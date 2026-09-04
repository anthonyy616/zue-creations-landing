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
  /** Object key of the JPEG fallback, stored in the media row. */
  jpegKey: string;
}

export type VariantMap = { sm: Variant | null; md: Variant | null; lg: Variant | null };

/**
 * Deterministic variant key for an original key: <base-without-ext>-<width>.webp.
 * Phase 6's next/image loader derives variant URLs from this pattern, so it
 * must never change without updating the loader.
 */
export function variantKey(storageKey: string, width: number, format: "webp" | "jpeg"): string {
  const dot = storageKey.lastIndexOf(".");
  const base = dot === -1 ? storageKey : storageKey.slice(0, dot);
  return `${base}-${width}.${format === "webp" ? "webp" : "jpg"}`;
}

/**
 * Fetches the original from R2, generates <480/960/1920>px variants in WebP and
 * JPEG (never upscaling), uploads them back to R2, and returns the variant map
 * plus the original's dimensions.
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

  for (const width of effectiveWidths) {
    const baseImage = sharp(originalBuffer).resize({
      width,
      withoutEnlargement: true,
    });

    const webpKey = variantKey(storageKey, width, "webp");
    const jpegKey = variantKey(storageKey, width, "jpeg");

    // resolveWithObject gives the *output* dimensions of the resized image
    // (metadata() would report the original's instead).
    const [webpResult, jpegBuffer] = await Promise.all([
      baseImage.clone().webp({ quality: 78 }).toBuffer({ resolveWithObject: true }),
      baseImage.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    ]);
    const webpBuffer = webpResult.data;
    const resizedHeight = webpResult.info.height;

    await Promise.all([
      r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: webpKey,
          Body: webpBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      ),
      r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: jpegKey,
          Body: jpegBuffer,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        })
      ),
    ]);

    variants[nameByWidth[width]] = {
      width,
      height: resizedHeight,
      webpKey,
      jpegKey,
    };
  }

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
