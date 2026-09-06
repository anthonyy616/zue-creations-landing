"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * A thin progress line fixed to the top of the viewport.
 * Fills from left to right as the user scrolls, with a subtle accent glow
 * that intensifies as you approach the bottom.
 *
 * Hidden on touch devices (no scroll indication needed) and for reduced motion.
 */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
    setIsVisible(true);
    return () => setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!isVisible || isTouch) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setProgress(0);
      return;
    }

    function update() {
      if (!ref.current) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const pct = docHeight > 0 ? scrollTop / docHeight : 0;
      setProgress(Math.min(Math.max(pct, 0), 1));
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [isVisible, isTouch]);

  if (!isVisible || isTouch || progress === 0) return null;

  const glowOpacity = Math.min(progress * 0.8, 0.8);

  return (
    <div className="fixed top-0 left-0 z-[9999] h-0.5 w-full overflow-hidden pointer-events-none">
      <motion.div
        className="h-full w-full bg-accent"
        style={{
          transformOrigin: "left center",
          opacity: 0.6,
          filter: "blur(1px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
      >
        <motion.div
          className="h-full bg-accent-2"
          style={{
            width: `${progress * 100}%`,
            transformOrigin: "left center",
            willChange: "width",
          }}
        />
      </motion.div>
      {/* Glow highlight at the leading edge */}
      <div
        className="fixed top-0 left-0 z-50 h-0.5 w-1 bg-accent rounded-full pointer-events-none"
        style={{
          opacity: glowOpacity,
          filter: "blur(4px)",
        }}
      />
    </div>
  );
}
