"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeText } from "@/lib/sanitize";

export default function AutoplayVideo({
  src,
  className = "",
  label,
  loop = true,
  poster,
}: {
  src: string;
  className?: string;
  label?: string;
  loop?: boolean;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const userInteractedRef = useRef(false);
  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Attempt autoplay whenever the component mounts or when the user toggles play.
  // We retry a few times because some browsers (especially on refresh) block the
  // very first play attempt but allow a second one after a user gesture or delay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    const playNext = () => {
      if (pausedByUser || attempts >= MAX_ATTEMPTS) return;
      video.play().then(() => {
        /* playing */
      })      .catch(() => {
        attempts++;
        if (attempts < MAX_ATTEMPTS) {
          // Retry after a short delay — browsers sometimes allow play after
          // the first blocked attempt.
          setTimeout(playNext, 300);
        }
      });
    };

    // Start playback after a tiny delay to let the browser finish loading the
    // element.
    const timer = setTimeout(playNext, 100);
    return () => clearTimeout(timer);
  }, [reducedMotion, pausedByUser]);

  // Keep playing if the user scrolls it off-screen and back.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !pausedByUser) {
              video.play().catch(() => {});
            } else if (!entry.isIntersecting) {
              video.pause();
            }
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(video);
    }
    return () => observer?.disconnect();
  }, [pausedByUser]);

  const handleClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!userInteractedRef.current) {
      userInteractedRef.current = true;
      if (!pausedByUser) {
        setPausedByUser(true);
        video.pause();
      }
      return;
    }

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
      preload="auto"
      poster={poster ?? undefined}
      controls={showControls}
      onClick={handleClick}
      aria-label={label != null ? sanitizeText(label) : undefined}
      className={className}
    />
  );
}
