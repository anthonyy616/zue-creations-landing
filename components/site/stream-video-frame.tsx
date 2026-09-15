"use client";

import { Play } from "lucide-react";
import type { MediaSlide } from "@/lib/media-slides";
import FullVideoViewer from "./full-video-viewer";
import { useState } from "react";

/**
 * Poster-first frame for a Stream-backed video inside a MediaScroller.
 * No video bytes load until the visitor clicks; the Stream embed mounts
 * only then (media-rules.md §4, §7). Falls back to a neutral placeholder
 * when no poster/thumbnail is available yet.
 *
 * If the admin enabled the motion preview, a lightweight animated preview
 * GIF (derived from the Stream UID) swaps in on hover — still no player.
 */
export default function StreamVideoFrame({
  slide,
  contain = false,
}: {
  slide: MediaSlide;
  mode?: "rail" | "pages";
  contain?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [hovered, setHovered] = useState(false);

  const poster = slide.poster;
  const embedUrl = slide.embedUrl;
  const showPreview =
    slide.previewEnabled && Boolean(slide.previewUrl) && !opened;

  const objectClass = contain ? "object-contain" : "object-cover";

  if (!embedUrl) {
    // No embed available (e.g. customer subdomain not configured yet):
    // degrade to the poster so the page never looks broken (media-rules.md §25).
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt={slide.alt ?? ""}
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${objectClass}`}
      />
    ) : (
      <div className="h-full w-full bg-white/[0.04]" />
    );
  }

  return (
    <>
      <div
        className="relative h-full w-full"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {showPreview && hovered ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.previewUrl ?? ""}
            alt={slide.alt ?? ""}
            loading="lazy"
            decoding="async"
            className={`h-full w-full ${objectClass}`}
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={slide.alt ?? ""}
            loading="lazy"
            decoding="async"
            className={`h-full w-full ${objectClass}`}
          />
        ) : (
          <div className="h-full w-full bg-white/[0.04]" />
        )}
        <button
          type="button"
          onClick={() => setOpened(true)}
          aria-label={`Play video: ${slide.alt ?? slide.label ?? "video"}`}
          className={`absolute inset-0 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            contain ? "bg-transparent" : "bg-black/0"
          }`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-sm transition-transform duration-300 hover:scale-110">
            <Play size={18} className="translate-x-[1px]" aria-hidden="true" />
          </span>
        </button>
      </div>

      {opened ? (
        <FullVideoViewer
          media={{
            id: slide.key,
            type: "video",
            provider: "cloudflare_stream",
            providerAssetId: slide.providerAssetId,
            url: "",
            originalUrl: "",
            variantWidths: [],
            width: null,
            height: null,
            fileSizeBytes: null,
            altText: slide.alt,
            sortOrder: 0,
            status: slide.status,
            lqipDataUrl: slide.lqipDataUrl,
            posterUrl: slide.poster,
            title: null,
            description: null,
            durationSeconds: null,
            aspectRatio: null,
            previewEnabled: slide.previewEnabled,
            previewStartSeconds: 0,
            previewDurationSeconds: 4,
            seoTitle: null,
            seoDescription: null,
            publishedAt: null,
            customPosterUrl: null,
            streamThumbnailUrl: slide.poster,
            streamEmbedUrl: embedUrl,
            streamPreviewUrl: slide.previewUrl,
          }}
          projectTitle={slide.alt ?? slide.label ?? "Video"}
          onClosed={() => setOpened(false)}
        />
      ) : null}
    </>
  );
}
