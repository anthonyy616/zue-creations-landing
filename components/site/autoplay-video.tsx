"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeText } from "@/lib/sanitize";

export default function AutoplayVideo({
  src,
  className = "",
  label,
  loop = true,
}: {
  src: string;
  className?: string;
  label?: string;
  loop?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              video.play().catch(() => {
                /* autoplay blocked or no data yet — stays on first frame */
              });
            } else {
              video.pause();
            }
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(video);
    } else {
      video.play().catch(() => {});
    }
    return () => observer?.disconnect();
  }, [reducedMotion]);

  // Clicking toggles between "play silently" and "paused with controls".
  const handleClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (pausedByUser) {
      setPausedByUser(false);
      video.play().catch(() => {});
    } else {
      setPausedByUser(true);
      video.pause();
    }
  };

  const showControls = reducedMotion || pausedByUser;

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop={loop}
      playsInline
      preload="metadata"
      controls={showControls}
      onClick={handleClick}
      aria-label={label != null ? sanitizeText(label) : undefined}
      className={className}
    />
  );
}
