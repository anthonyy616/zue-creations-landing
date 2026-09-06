import type { MediaView } from "@/lib/media";

/**
 * Plain, serializable descriptor for one frame inside a MediaScroller. Built
 * server-side (this module has no client/server directive so both can use it)
 * and passed to the client component as props.
 */
export type MediaSlide = {
  key: string;
  kind: "image" | "video";
  /** Best display URL (a generated variant for images, original for video). */
  src: string;
  /** Original public URL (images only) — for the R2 variant loader. */
  originalUrl: string;
  /** Variant widths that actually exist for this image. */
  variantWidths: number[];
  alt: string | null;
  /** Project label (rail tiles) / fallback caption (pages). */
  label?: string | null;
  /** Where clicking a rail tile navigates. */
  href?: string;
  /** Processing status: "processing" | "ready" | "failed". */
  status: "processing" | "ready" | "failed";
  /** Inline base64 data URL for a tiny blurred placeholder. */
  lqipDataUrl: string | null;
  /** Poster URL for videos (the guaranteed visual fallback). */
  poster: string | null;
};

/** Builds a serializable slide from a MediaView, optionally tagged with its project. */
export function mediaToSlide(
  media: MediaView,
  meta?: { label?: string | null; href?: string }
): MediaSlide {
  return {
    key: media.id,
    kind: media.type,
    src: media.url,
    originalUrl: media.originalUrl,
    variantWidths: media.variantWidths,
    alt: media.altText,
    label: meta?.label,
    href: meta?.href,
    status: media.status,
    lqipDataUrl: media.lqipDataUrl,
    poster: media.posterUrl,
  };
}
