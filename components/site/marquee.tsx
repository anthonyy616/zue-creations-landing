"use client";

import { useReducedMotion } from "framer-motion";

/**
 * A seamless horizontal marquee that loops text endlessly.
 * Pauses on hover, respects prefers-reduced-motion.
 * Used for editorial flavour strips between sections.
 */
export default function Marquee({
  text = "PHOTOGRAPHY · CINEMATOGRAPHY · CREATIVE DIRECTION ·",
  speed = 38,
  className = "",
}: {
  text?: string;
  /** Seconds for one full loop. */
  speed?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  // We duplicate the text enough times that the strip is always wider than the
  // viewport, then translate it by exactly one copy width for a seamless loop.
  const repeats = 6;

  if (reduced) {
    return (
      <div
        className={`overflow-hidden border-y border-line ${className}`}
        aria-hidden="true"
      >
        <p className="py-4 text-center text-[11px] uppercase tracking-[0.24em] text-muted">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`marquee-track overflow-hidden border-y border-line ${className}`}
      aria-hidden="true"
    >
      <div
        className="marquee-inner flex w-max gap-x-0 will-change-transform"
        style={{ animationDuration: `${speed}s` }}
      >
        {Array.from({ length: repeats }).map((_, i) => (
          <span
            key={i}
            className="shrink-0 py-4 pr-0 text-[11px] uppercase tracking-[0.24em] text-muted"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
