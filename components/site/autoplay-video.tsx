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
  const playAttemptedRef = useRef(false);
  const maxAttemptsReachedRef = useRef(false);
  
  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Attempt autoplay whenever the component mounts or when the user toggles play.
  // We retry a few times for transient timing issues, but respect browser autoplay
  // policies — if the browser rejects play() due to policy, we stop retrying.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || !poster) return;
    // Reset state for new mount/unmount cycles
    playAttemptedRef.current = false;
    maxAttemptsReachedRef.current = false;

    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const attemptPlay = () => {
      // Don't attempt if user paused, we've hit max attempts, or already playing
      if (pausedByUser || maxAttemptsReachedRef.current) return;
      
      // Only attempt if video is ready (has data)
      if (video.readyState < 2) {
        // Not ready yet, try again shortly
        timeoutId = setTimeout(attemptPlay, 100);
        return;
      }
      
      playAttemptedRef.current = true;
      video.play().then(() => {
        // Playing successfully — reset the max attempts flag since
        // we may want to retry if the video pauses later
        maxAttemptsReachedRef.current = false;
      }).catch((err) => {
        attempts++;
        // Distinguish between autoplay policy blocking (won't change with retries)
        // and transient errors (might succeed on retry)
        const isAutoplayBlocked = err.name === "NotAllowedError" || 
          (err.message && err.message.includes("autoplay"));
        
        if (isAutoplayBlocked || attempts >= MAX_ATTEMPTS) {
          // Browser policy or too many attempts — stop retrying
          // The poster remains visible as the fallback
          maxAttemptsReachedRef.current = true;
        } else {
          // Transient error — retry after a short delay
          timeoutId = setTimeout(attemptPlay, 300);
        }
      });
    };

    // Start playback attempt after a short delay to let metadata load
    timeoutId = setTimeout(attemptPlay, 150);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [reducedMotion, pausedByUser, poster]);

  // Intersection Observer controls playback, not media existence.
  // The poster remains visible regardless of observer state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !poster) return;

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !pausedByUser && !maxAttemptsReachedRef.current) {
              // Video entered viewport — attempt play if not already playing
              if (video.paused) {
                video.play().catch(() => {
                  // If blocked, mark that we've hit the limit so we don't
                  // keep retrying on every intersection
                  maxAttemptsReachedRef.current = true;
                });
              }
            } else if (!entry.isIntersecting) {
              // Video left viewport — pause to save resources
              video.pause();
            }
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(video);
    }
    return () => observer?.disconnect();
  }, [pausedByUser, poster]);

  const handleClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!userInteractedRef.current) {
      userInteractedRef.current = true;
      // First click — toggle play/pause
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      // Update pausedByUser state to keep UI in sync
      setPausedByUser(video.paused);
      return;
    }

    // Subsequent clicks also toggle
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    setPausedByUser(video.paused);
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
      poster={poster ?? undefined}
      controls={showControls}
      onClick={handleClick}
      aria-label={label != null ? sanitizeText(label) : undefined}
      className={className}
    />
  );
}
