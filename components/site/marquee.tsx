/**
 * A seamless horizontal marquee that loops text endlessly.
 * Pauses on hover, respects prefers-reduced-motion.
 * Used for editorial flavour strips between sections.
 *
 * Always renders the same DOM so there is no server/client hydration
 * mismatch. Reduced-motion is handled purely in CSS (the keyframe is
 * already disabled for prefers-reduced-motion in globals.css).
 *
 * This is a Server Component — all animation and hover behaviour is
 * pure CSS (globals.css), so no client JS is needed.
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
  // We duplicate the text enough times that the strip is always wider than the
  // viewport, then translate it by exactly one copy width for a seamless loop.
  const repeats = 6;

  return (
    <div
      className={`marquee-track overflow-hidden border-y border-line ${className}`}
      aria-hidden="true"
    >
      <div
        className="marquee-inner flex w-max gap-x-0"
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
