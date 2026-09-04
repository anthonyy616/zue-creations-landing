import { S3Client } from "@aws-sdk/client-s3";

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "";
export const R2_PUBLIC_MEDIA_URL = (
  process.env.R2_PUBLIC_MEDIA_URL ?? ""
).replace(/\/$/, "");

export function isR2Configured() {
  return Boolean(
    R2_ACCOUNT_ID &&
      R2_ACCESS_KEY_ID &&
      R2_SECRET_ACCESS_KEY &&
      R2_BUCKET_NAME &&
      R2_PUBLIC_MEDIA_URL
  );
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/** Public, cacheable URL for a stored object key served via the custom domain. */
export function publicMediaUrl(key: string): string {
  return `${R2_PUBLIC_MEDIA_URL}/${key}`;
}
