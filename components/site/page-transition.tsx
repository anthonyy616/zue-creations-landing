"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Short, subtle cross-fade between public pages (including project-to-project
 * navigation). Keyed on the pathname inside AnimatePresence so the outgoing
 * page fades out before the incoming one fades in. Wrapped in MotionConfig so
 * prefers-reduced-motion users get instant swaps instead of motion.
 *
 * This is the only client wrapper around page content — individual pages stay
 * Server Components.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
