/**
 * Server-side Cloudflare Stream API helper.
 *
 * Security rules (media-rules.md §3):
 *  - CLOUDFLARE_STREAM_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are read from env
 *    only. They must never appear in NEXT_PUBLIC_* vars, client bundles, or
 *    API responses.
 *  - The browser only ever receives the temporary one-time direct-upload URL.
 *
 * All functions throw StreamConfigError when configuration is missing so
 * routes can return a clean 503 instead of leaking details.
 */

const STREAM_API_BASE = "https://api.cloudflare.com/client/v4";

export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
export const CLOUDFLARE_STREAM_API_TOKEN =
  process.env.CLOUDFLARE_STREAM_API_TOKEN ?? "";
export const CLOUDFLARE_STREAM_WEBHOOK_SECRET =
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET ?? "";

export class StreamConfigError extends Error {
  constructor() {
    super("Video uploads are not configured. Ask the site owner to enable them.");
    this.name = "StreamConfigError";
  }
}

export function isStreamConfigured(): boolean {
  return Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_STREAM_API_TOKEN);
}

function assertConfigured(): void {
  if (!isStreamConfigured()) throw new StreamConfigError();
}

/** Core JSON call against the Stream API with bearer auth. */
async function streamApi<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertConfigured();
  const res = await fetch(`${STREAM_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => null)) as {
    success?: boolean;
    errors?: { code?: number; message?: string }[];
    result?: T;
  } | null;

  if (!res.ok || !payload?.success) {
    const message =
      payload?.errors?.[0]?.message ?? `Cloudflare Stream request failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return payload.result as T;
}

/* ------------------------------------------------------------------ */
/* Direct Creator Upload                                               */
/* ------------------------------------------------------------------ */

export type DirectUploadResult = {
  /** Stream UID assigned to the video. */
  uid: string;
  /** One-time TUS upload URL for the browser. Never store as permanent id. */
  uploadURL: string;
};

/**
 * Creates a Direct Creator Upload session.
 *
 * The returned uploadURL is one-time and expires; the browser uploads the
 * file straight to Cloudflare Stream with it (TUS protocol — required for
 * resumability and files over 200 MB).
 */
export async function createDirectUploadUrl(options: {
  maxDurationSeconds?: number;
  creator?: string;
  /** Optional human name kept in Stream's metadata. */
  fileName?: string;
  /** Restrict where the completed upload may be embedded/played. */
  allowedOrigins?: string[];
  requireSignedURLs?: boolean;
}): Promise<DirectUploadResult> {
  const body: Record<string, unknown> = {
    maxDurationSeconds: options.maxDurationSeconds ?? 3600,
  };
  if (options.creator) body.creator = options.creator;
  if (options.fileName) {
    body.meta = { name: options.fileName };
  }
  if (options.allowedOrigins && options.allowedOrigins.length > 0) {
    body.allowedOrigins = options.allowedOrigins;
  }
  if (options.requireSignedURLs !== undefined) {
    body.requireSignedURLs = options.requireSignedURLs;
  }

  const result = await streamApi<DirectUploadResult>("/stream/direct_upload", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* Asset status / deletion                                             */
/* ------------------------------------------------------------------ */

export type StreamVideoStatus = {
  uid: string;
  readyToStream: boolean;
  status: { state: string; pctComplete?: string; errorReasonCode?: string; errorReasonText?: string };
  duration?: number;
  input?: { width?: number; height?: number };
  thumbnail?: string;
  created?: string;
  modified?: string;
};

export async function getVideoStatus(uid: string): Promise<StreamVideoStatus> {
  return streamApi<StreamVideoStatus>(`/stream/${uid}`);
}

/**
 * Deletes the Stream asset. Only called from authorized admin flows or a
 * future cleanup job — never from the public frontend (media-rules.md §38.5).
 */
export async function deleteVideo(uid: string): Promise<void> {
  await streamApi(`/stream/${uid}`, { method: "DELETE" });
}

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
/* Webhook verification                                                */
/* ------------------------------------------------------------------ */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the Webhook-Signature header Cloudflare Stream sends:
 *   Webhook-Signature: time=1230811200,sig1=60493…
 * sig1 = HMAC-SHA256(secret, `${time}.${rawBody}`) hex-encoded.
 * Rejects timestamps older than 5 minutes to deter replay.
 */
export function verifyStreamWebhook(
  signatureHeader: string | null,
  rawBody: string
): boolean {
  if (!CLOUDFLARE_STREAM_WEBHOOK_SECRET || !signatureHeader) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const time = parts["time"];
  const sig = parts["sig1"];
  if (!time || !sig) return false;

  // Replay protection: 5 minutes.
  const timestamp = Number(time);
  if (!Number.isFinite(timestamp)) return false;
  const skewMs = Math.abs(Date.now() - timestamp * 1000);
  if (skewMs > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", CLOUDFLARE_STREAM_WEBHOOK_SECRET)
    .update(`${time}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
