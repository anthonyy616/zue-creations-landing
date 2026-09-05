"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Custom cursor for desktop only — a small dot that follows the pointer with
 * slight lag, expanding into a "VIEW" badge when hovering project cards.
 * Disabled on touch / reduced-motion devices.
 */
export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Smooth spring for position lag.
  const springX = useSpring(cursorX, { stiffness: 380, damping: 32, mass: 0.4 });
  const springY = useSpring(cursorY, { stiffness: 380, damping: 32, mass: 0.4 });

  const hoveringRef = useRef(false);

  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none)").matches;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(isReduced);
    if (!isTouch && !isReduced) {
      setEnabled(true);
    }

    // Listen for hover targets.
    const onMove = (e: PointerEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);

      // Check if we're hovering over a project card.
      const target = e.target as HTMLElement;
      const card = target.closest("[data-cursor]");
      const isHovering = card?.getAttribute("data-cursor") === "view";
      if (isHovering !== hoveringRef.current) {
        hoveringRef.current = isHovering;
        setHovering(isHovering);
      }
    };

    if (!isTouch && !isReduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
    }
    return () => window.removeEventListener("pointermove", onMove);
  }, [cursorX, cursorY]);

  if (!enabled || reducedMotion) return null;

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[9999] flex items-center justify-center"
      style={{
        x: springX,
        y: springY,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <motion.div
        animate={{
          scale: hovering ? 1 : 0.35,
          opacity: hovering ? 1 : 0.6,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 24,
          mass: 0.3,
        }}
        className="flex items-center justify-center rounded-full bg-fg/90 text-bg"
        style={{
          minWidth: hovering ? 64 : 8,
          height: hovering ? 32 : 8,
          padding: hovering ? "0 14px" : 0,
        }}
      >
        {hovering && (
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-bg">
            VIEW
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
