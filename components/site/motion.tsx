"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A single display line that rises in from below (one by one) inside a clipped
 * mask. After the entrance it keeps a slow, gentle "breath" via the
 * `.line-drift` CSS animation (staggered by `driftDelay`), so consecutive
 * lines wave through the sentence in sequence rather than sitting still.
 *
 * Mouse hover nudges the line up and tints it the accent color; touch gets the
 * same accent treatment through the active state.
 */
export function RevealLine({
  children,
  delay = 0,
  driftDelay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Entrance delay in seconds. */
  delay?: number;
  /** Delay (s) before this line's idle drift begins — stagger per line. */
  driftDelay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <span className={`block overflow-hidden ${className}`}>
      <motion.span
        className={`hover-lift block transition-colors duration-500 will-change-transform hover:text-accent active:text-accent ${
          reduced ? "" : "line-drift"
        }`}
        style={{ animationDelay: reduced ? undefined : `${driftDelay}s` }}
        initial={reduced ? false : { y: "115%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Simple scroll-into-view fade + rise. Used to animate whole sections in. */
export function FadeUp({
  children,
  delay = 0,
  y = 22,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Scroll-in reveal that lets each list item follow the previous one. */
export function StaggerList({
  children,
  stagger = 0.08,
  base = 0,
  className = "",
}: {
  children: ReactNode;
  stagger?: number;
  base?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <ul className={className}>{children}</ul>;

  return (
    <motion.ul
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: base } },
      }}
    >
      {children}
    </motion.ul>
  );
}

/**
 * One child of <StaggerList>. Place around each <li> row.
 */
export function StaggerItem({
  children,
  y = 26,
  className = "",
}: {
  children: ReactNode;
  y?: number;
  className?: string;
}) {
  return (
    <motion.li
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: EASE },
        },
      }}
    >
      {children}
    </motion.li>
  );
}

/**
 * Follows the pointer across an element and applies a small counter-shift to
 * its child — a subtle depth/parallax feel for blocks of type or imagery.
 * Disabled on touch devices (no hovering pointer) and for reduced motion.
 */
export function PointerTilt({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum translate in px. */
  max?: number;
}) {
  const reduced = useReducedMotion();
  const [style, setStyle] = useState<CSSProperties>({});
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.matchMedia("(hover: hover)").matches);
  }, []);

  if (reduced || !enabled) return <div className={className}>{children}</div>;

  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Normalised -1..1 offset from the element's centre.
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        setStyle({
          transform: `translate3d(${nx * max}px, ${ny * max}px, 0)`,
        });
      }}
      onPointerLeave={() => setStyle({})}
    >
      <div
        className="transition-transform duration-700 ease-out will-change-transform"
        style={{ ...style, transitionProperty: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
