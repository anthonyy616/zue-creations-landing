/**
 * Server-side Cloudflare Stream helper (MVP: manual UID mode).
 *
 * How videos get in for now:
 *  1. The admin uploads the video manually inside the Cloudflare Stream
 *     dashboard.
 *  2. The admin copies the video UID and pastes it into the CMS.
 *  3. The app stores the UID as providerAssetId and derives all playback
 *     URLs (thumbnail / preview / embed) from it — no extra API calls.
 *
 * Security rules (media-rules.md §3):
 *  - CLOUDFLARE_STREAM_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are read from env
 *    only. They must never appear in NEXT_PUBLIC_* vars, client bundles, or
 *    API responses. The browser only ever receives derived public URLs.
 *  - The API token is currently only used for hard-deleting Stream assets
 *    (admin purge + cleanup job). Direct Creator Uploads and webhook
 *    registration can be layered back in later without schema changes.
 */

/* ------------------------------------------------------------------ */
/* Derived URLs (no API call needed)                                   */
/* ------------------------------------------------------------------ */

/**
 * Public Stream customer subdomain, e.g. customer-xxxxxxxx.cloudflarestream.com.
 * Configured via env; used to derive thumbnails and embed URLs from the UID
 * without extra API calls (architecture.md §12: prefer UID over stored URLs).
 */
export const STREAM_CUSTOMER_SUBDOMAIN = (
  process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN ?? ""
).replace(/^https?:\/\//, "").replace(/\/$/, "");

export function isStreamPlaybackConfigured(): boolean {
  return Boolean(STREAM_CUSTOMER_SUBDOMAIN);
}

/** Automatically generated poster/thumbnail frame for a Stream video. */
export function streamThumbnailUrl(uid: string, opts?: { time?: number; width?: number }): string | null {
  if (!STREAM_CUSTOMER_SUBDOMAIN) return null;
  const params = new URLSearchParams();
  if (opts?.time !== undefined) params.set("time", `${opts.time}s`);
  if (opts?.width) params.set("width", String(opts.width));
  const qs = params.toString();
  return `https://${STREAM_CUSTOMER_SUBDOMAIN}/${uid}/thumbnails/thumbnail.jpg${qs ? `?${qs}` : ""}`;
}

/** Animated GIF preview derived from the UID — lightweight motion preview. */
export function streamPreviewUrl(uid: string, durationSeconds = 4): string | null {
  if (!STREAM_CUSTOMER_SUBDOMAIN) return null;
  return `https://${STREAM_CUSTOMER_SUBDOMAIN}/${uid}/previews/preview.gif?duration=${durationSeconds}s`;
}

/** Embed URL for the Stream player iframe (mounted only on click). */
export function streamEmbedUrl(uid: string): string | null {
  if (!STREAM_CUSTOMER_SUBDOMAIN) return null;
  return `https://${STREAM_CUSTOMER_SUBDOMAIN}/embed/${uid}`;
}

/* ------------------------------------------------------------------ */
/* Asset deletion (admin purge + cleanup job only)                     */
/* ------------------------------------------------------------------ */

const STREAM_API_BASE = "https://api.cloudflare.com/client/v4";

export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
export const CLOUDFLARE_STREAM_API_TOKEN =
  process.env.CLOUDFLARE_STREAM_API_TOKEN ?? "";

export function isStreamConfigured(): boolean {
  return Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_STREAM_API_TOKEN);
}

/**
 * Deletes the Stream asset. Only called from authorized admin flows (purge)
 * or the cleanup job — never from the public frontend (media-rules.md §38.5).
 * Throws on failure so callers can keep the row and retry.
 */
export async function deleteVideo(uid: string): Promise<void> {
  if (!isStreamConfigured()) {
    throw new Error(
      "Cloudflare Stream is not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN)."
    );
  }

  const res = await fetch(
    `${STREAM_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      errors?: { message?: string }[];
    } | null;
    throw new Error(
      payload?.errors?.[0]?.message ??
        `Cloudflare Stream delete failed (HTTP ${res.status})`
    );
  }
}
