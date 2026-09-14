"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { MediaView } from "@/lib/media";

/**
 * Full video viewer (architecture.md §18, media-rules.md §7–8):
 *
 *  - Opens only after an explicit click on a poster card.
 *  - Mounts the Cloudflare Stream embed iframe only now, never on page load.
 *  - Poster stays visible until the iframe reports it is playing.
 *  - Pause + unmount on close (Esc key, backdrop click, close button).
 *  - No sound autoplay: the Stream player starts with controls enabled and
 *    default muted=false only after this deliberate user action; browsers
 *    treat a click-initiated load as user-activated media.
 */
export default function FullVideoViewer({
  media,
  projectTitle,
  onClosed,
}: {
  media: MediaView;
  projectTitle: string;
  onClosed: () => void;
}) {
  const [playerReady, setPlayerReady] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes; focus lands on the close button for keyboard users.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClosed();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClosed]);

  // Listen for "another player opened" — close this one (single-player rule).
  useEffect(() => {
    const onClose = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && detail !== media.id) onClosed();
    };
    window.addEventListener("media:close-player", onClose);
    return () => window.removeEventListener("media:close-player", onClose);
  }, [media.id, onClosed]);

  if (!media.streamEmbedUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Play video: ${projectTitle}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClosed();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-5xl"
        style={{ aspectRatio: media.aspectRatio?.replace(":", " / ") ?? "16 / 9" }}
      >
        {/* Poster remains until the player signals readiness. */}
        {!playerReady && media.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full rounded object-cover"
          />
        ) : null}

        <iframe
          src={media.streamEmbedUrl}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          tabIndex={0}
          title={`${projectTitle} — video player`}
          onLoad={() => setPlayerReady(true)}
          className="absolute inset-0 h-full w-full rounded"
        />

        <button
          ref={closeRef}
          type="button"
          onClick={onClosed}
          aria-label="Close video"
          className="absolute -top-12 right-0 grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white outline-none transition-colors hover:border-white/60 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
