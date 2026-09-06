import { ReactNode } from "react";

/**
 * A section divider — an SVG wave or gradient fade that visually separates
 * major sections. Renders as a fixed-height decorative element.
 *
 * Two modes:
 *  - "wave": an SVG wave that curves across the bottom of the preceding
 *    section (looks like water/signal wave)
 *  - "fade": a gradient fade from the section background to transparent
 */
export default function SectionDivider({
  children,
  style = "wave",
  className = "",
}: {
  children?: ReactNode;
  /** "wave" for an SVG waveform, "fade" for a gradient fade */
  style?: "wave" | "fade";
  className?: string;
}) {
  if (style === "fade") {
    return (
      <div className={`relative overflow-hidden bg-bg ${className}`}>
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "80px",
            background:
              "linear-gradient(to bottom, transparent, var(--bg) 30%)",
          }}
        />
        {children}
      </div>
    );
  }

  // Wave style — SVG path that creates a gentle wave
  return (
    <div className={`relative overflow-hidden bg-bg ${className}`}>
      <svg
        className="pointer-events-none absolute bottom-0 left-0 w-full h-16"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <path
          d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
          fill="var(--bg)"
          opacity="0.95"
        />
        <path
          d="M0,35 C240,55 480,15 720,35 C960,55 1200,15 1440,35 L1440,60 L0,60 Z"
          fill="var(--bg)"
          opacity="0.6"
        />
      </svg>
      {children}
    </div>
  );
}
