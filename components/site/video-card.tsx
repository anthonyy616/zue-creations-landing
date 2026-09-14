"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { MediaView } from "@/lib/media";
import {
  observeMedia,
  tryAcquirePreviewSlot,
  releasePreviewSlot,
  claimFullPlayer,
  releaseFullPlayer,
  getMediaDistance,
  shouldDisablePreviews,
  onTabHidden,
} from "./media-lifecycle";
import FullVideoViewer from "./full-video-viewer";

/**
 * Public video card (architecture.md §15–17, media-rules.md §5–8):
 *
 *   1. Poster renders immediately — never a blank/black box.
 *   2. Short muted preview on hover/focus (desktop) or when meaningfully
 *      visible (mobile), subject to the shared preview budget.
 *   3. Full Stream player mounts ONLY after an explicit click, inside
 *      FullVideoViewer. One full player exists at any time.
 *
 * Aspect ratio is always reserved to avoid layout shift (media-rules.md §22).
 */

export default function VideoCard({
  media,
  projectTitle,
  className = "",
}: {
  media: MediaView;
  projectTitle: string;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(false);

  const isStream = media.provider === "cloudflare_stream" && media.streamEmbedUrl;
  const previewSrc = media.streamPreviewUrl;
  const canPreview = Boolean(
    media.previewEnabled && media.previewDurationSeconds > 0 && isStream && previewSrc
  );

  // Lifecycle: track visibility so the preview only activates when meaningful.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !canPreview) return;
    return observeMedia(el, {
      onEnter: () => setVisible(true),
      onLeave: () => {
        setVisible(false);
        stopPreview();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPreview]);

  // Pause previews when the tab hides.
  useEffect(() => {
    if (!canPreview) return;
    return onTabHidden(() => stopPreview());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPreview]);

  function stopPreview() {
    setPreviewing(false);
    releasePreviewSlot(media.id);
    previewRef.current?.pause();
  }

  function startPreview() {
    if (!canPreview || opened) return;
    if (getMediaDistance(cardRef.current!) === "distant") return;
    if (!tryAcquirePreviewSlot(media.id)) return; // budget full — poster stays
    setPreviewing(true);
  }

  function handleOpen() {
    stopPreview();
    const previous = claimFullPlayer(media.id);
    if (previous && previous !== media.id) {
      // Another full player was open — its own onClosed hook will unmount it.
      window.dispatchEvent(new CustomEvent("media:close-player", { detail: previous }));
    }
    setOpened(true);
  }

  function handleClosed() {
    releaseFullPlayer(media.id);
    setOpened(false);
  }

  const aspect =
    media.aspectRatio && /^\d+:\d+$/.test(media.aspectRatio)
      ? media.aspectRatio.replace(":", " / ")
      : media.width && media.height
        ? `${media.width} / ${media.height}`
        : "16 / 9";

  return (
    <>
      <div
        ref={cardRef}
        className={`group relative overflow-hidden bg-white/[0.04] ${className}`}
        style={{ aspectRatio: aspect }}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
        onFocus={startPreview}
        onBlur={stopPreview}
      >
        {/* Poster — always present, loads like a normal image. */}
        {media.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.posterUrl}
            alt={media.altText ?? `${projectTitle} video`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              previewing ? "opacity-0" : "opacity-100"
            }`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-white/[0.04]">
            <Play size={22} className="text-muted" aria-hidden="true" />
          </div>
        )}

        {/* Short muted motion preview (only while budgeted + visible). */}
        {previewing && visible && !shouldDisablePreviews() ? (
          <video
            ref={previewRef}
            src={previewSrc ?? undefined}
            muted
            loop
            playsInline
            autoPlay
            preload="none"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => stopPreview()}
          />
        ) : null}

        {/* Play affordance + accessible label. */}
        <button
          type="button"
          onClick={handleOpen}
          aria-label={`Play video: ${projectTitle}`}
          className="absolute inset-0 grid place-items-center outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110">
            <Play size={18} className="translate-x-[1px]" aria-hidden="true" />
          </span>
        </button>
      </div>

      {opened ? (
        <FullVideoViewer
          media={media}
          projectTitle={projectTitle}
          onClosed={handleClosed}
        />
      ) : null}
    </>
  );
}
