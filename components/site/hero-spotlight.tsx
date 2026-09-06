"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ProjectCard } from "@/lib/public";
import SafeText from "./safe-text";
import { formatDateAsMonthYear } from "@/lib/format";

/**
 * Auto-rotating hero spotlight.
 *
 * Cross-fades between featured project covers/titles on a slow cycle.
 * Pauses on hover. Disabled for reduced motion (shows the first project only).
 *
 * Each frame shows:
 *  - A small cover image (decorative)
 *  - The project title and month/year
 */
export default function HeroSpotlight({
  projects,
  className = "",
}: {
  projects: ProjectCard[];
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [_isPaused, setIsPaused] = useState(false);
  const featured = projects.filter((p) => p.featured && p.cover);
  const display = featured.length > 0 ? featured : projects;

  useEffect(() => {
    if (display.length <= 1) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const cycle = () => {
      setActiveIndex((prev) => (prev + 1) % display.length);
    };

    const interval = setInterval(cycle, 7000);
    return () => clearInterval(interval);
  }, [display.length]);

  if (display.length === 0) return null;

  return (
    <div
      className={`relative h-24 sm:h-28 overflow-hidden rounded-full border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Static label */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
          Now featuring
        </span>
      </div>

      {/* Rotating content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3"
        >
          {display[activeIndex].cover && (
            <img
              src={display[activeIndex].cover.url}
              alt=""
              className="h-10 w-16 overflow-hidden rounded object-cover"
              loading="lazy"
            />
          )}
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
              {formatDateAsMonthYear(display[activeIndex].date)}
            </p>
            <p className="text-sm font-medium text-white">
              <SafeText>{display[activeIndex].title}</SafeText>
            </p>
          </div>
          <ArrowRight size={14} className="text-accent shrink-0" />
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {display.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`h-1 w-1 rounded-full transition-all duration-300 ${
              i === activeIndex ? "bg-accent w-2" : "bg-zinc-600"
            }`}
            aria-label={`Show project ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
