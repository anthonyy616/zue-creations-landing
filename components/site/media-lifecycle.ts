"use client";

/**
 * Centralized media lifecycle manager (architecture.md §23–24).
 *
 * One module owns the budgets so no component can run away with bandwidth:
 *
 *   Full video players : 1 concurrently
 *   Desktop previews   : 2 concurrently
 *   Mobile previews    : 1 concurrently
 *
 * States tracked per media element: DISTANT -> NEAR -> VISIBLE -> ACTIVE ->
 * OPENED, driven by a single shared IntersectionObserver and page-visibility
 * events. Reduced-motion and data-saver users never get automatic previews;
 * deliberate click-to-play always works (media-rules.md §10, §24).
 */

export type MediaDistance = "distant" | "near" | "visible";

export type LifecycleCallbacks = {
  onEnter?: () => void;
  onLeave?: () => void;
};

type Registration = {
  element: Element;
  distance: MediaDistance;
  callbacks: LifecycleCallbacks;
};

const NEAR_ROOT_MARGIN = "800px 0px";
const VISIBLE_ROOT_MARGIN = "0px 0px";

let observer: IntersectionObserver | null = null;
const registrations = new Map<Element, Registration>();

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Progressive enhancement only — never required for the page to work. */
export function shouldDisablePreviews(): boolean {
  if (typeof window === "undefined") return true;
  if (prefersReducedMotion()) return true;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /^(slow-2g|2g)$/.test(conn.effectiveType)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Shared IntersectionObserver                                         */
/* ------------------------------------------------------------------ */

function ensureObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    return null;
  }
  if (observer) return observer;

  // Observe with the generous "near" margin; entries report the widest
  // intersection ratio/margins the browser applies, so we classify each
  // element by re-checking geometry against both thresholds.
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const reg = registrations.get(entry.target);
        if (!reg) continue;
        const distance = classify(entry.target);
        if (distance !== reg.distance) {
          reg.distance = distance;
          if (distance === "visible") reg.callbacks.onEnter?.();
          if (distance === "distant") reg.callbacks.onLeave?.();
        }
      }
    },
    { rootMargin: NEAR_ROOT_MARGIN, threshold: 0 }
  );
  return observer;
}

function classify(element: Element): MediaDistance {
  const rect = element.getBoundingClientRect();
  const vh = window.innerHeight;
  // Visible: intersecting the actual viewport. Near: within the NEAR margin.
  const visible =
    rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < window.innerWidth;
  if (visible) return "visible";
  const nearMargin = 800;
  if (rect.bottom > -nearMargin && rect.top < vh + nearMargin) return "near";
  return "distant";
}

export function observeMedia(
  element: Element,
  callbacks: LifecycleCallbacks = {}
): () => void {
  const io = ensureObserver();
  const registration: Registration = {
    element,
    distance: io ? "distant" : classify(element),
    callbacks,
  };
  registrations.set(element, registration);
  io?.observe(element);

  if (!io) {
    // No IO support: treat everything as visible (progressive degradation,
    // media-rules.md §24 — the site still works).
    callbacks.onEnter?.();
  }

  return () => {
    registrations.delete(element);
    io?.unobserve(element);
  };
}

export function getMediaDistance(element: Element): MediaDistance {
  return registrations.get(element)?.distance ?? "distant";
}

/* ------------------------------------------------------------------ */
/* Preview budget                                                      */
/* ------------------------------------------------------------------ */

const activePreviews = new Set<string>();

export function previewBudget(): number {
  return isMobile() ? 1 : 2;
}

/** Returns true when a preview slot is available (budget not exhausted). */
export function tryAcquirePreviewSlot(id: string): boolean {
  if (shouldDisablePreviews()) return false;
  if (activePreviews.has(id)) return true;
  if (activePreviews.size >= previewBudget()) return false;
  activePreviews.add(id);
  return true;
}

export function releasePreviewSlot(id: string): void {
  activePreviews.delete(id);
}

/* ------------------------------------------------------------------ */
/* Full player exclusivity                                             */
/* ------------------------------------------------------------------ */

let activePlayer: string | null = null;

/** Registers the opened player; returns the previous one to stop (or null). */
export function claimFullPlayer(id: string): string | null {
  const previous = activePlayer;
  activePlayer = id;
  return previous;
}

export function releaseFullPlayer(id: string): void {
  if (activePlayer === id) activePlayer = null;
}

/* ------------------------------------------------------------------ */
/* Page visibility                                                     */
/* ------------------------------------------------------------------ */

type VisibilityHandler = () => void;
const visibilityHandlers = new Set<VisibilityHandler>();
let visibilityBound = false;

function bindVisibility(): void {
  if (visibilityBound || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    const hidden = document.hidden;
    for (const handler of visibilityHandlers) handler();
    if (hidden) {
      // Pause every registered preview when the tab hides (§24).
      for (const reg of registrations.values()) {
        reg.callbacks.onLeave?.();
      }
    }
  });
  visibilityBound = true;
}

export function onTabHidden(handler: VisibilityHandler): () => void {
  bindVisibility();
  visibilityHandlers.add(handler);
  return () => visibilityHandlers.delete(handler);
}
