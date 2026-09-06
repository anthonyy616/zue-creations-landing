"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/**
 * A number that counts up from 0 to its target value when it scrolls into view.
 * Uses requestAnimationFrame for smooth animation. Respects prefers-reduced-motion
 * (shows the final value instantly).
 */
export default function Counter({
  value,
  label,
  suffix = "",
  duration = 1800,
  className = "",
}: {
  value: number;
  label?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px 0px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setCount(value);
      return;
    }

    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      setCount(Math.round(value * eased));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    }

    requestAnimationFrame(step);
  }, [inView, value, duration]);

  return (
    <div ref={ref} className={className}>
      <motion.span
        className="font-display text-3xl font-black text-fg sm:text-4xl"
        initial={false}
        animate={{ opacity: inView ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {count}
        {suffix}
      </motion.span>
      {label && (
        <motion.p
          className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted"
          initial={false}
          animate={{ opacity: inView ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
