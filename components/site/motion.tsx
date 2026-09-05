"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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

/**
 * Magnetic pull — the child drifts 3-8 px toward the cursor on hover.
 * Good for CTAs, nav links, social icons. Touch / reduced-motion get the
 * child straight, no drift.
 */
export function Magnetic({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 250, damping: 18, mass: 0.5 });

  useEffect(() => {
    setEnabled(window.matchMedia("(hover: hover)").matches);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    x.set(nx * max);
    y.set(ny * max);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (reduced || !enabled) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.div style={{ x: sx, y: sy }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Image that follows the pointer with subtle parallax displacement.
 * Used inside project cards for a depth effect.
 */
export function ImageParallax({
  children,
  className = "",
  max = 12,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 200, damping: 22, mass: 0.6 });

  useEffect(() => {
    setEnabled(window.matchMedia("(hover: hover)").matches);
  }, []);

  if (reduced || !enabled) return <div className={className}>{children}</div>;

  return (
    <div
      className={`overflow-hidden ${className}`}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        x.set(nx * max);
        y.set(ny * max);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div style={{ x: sx, y: sy }} className="size-full">
        {children}
      </motion.div>
    </div>
  );
}
