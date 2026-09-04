"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "black" | "olive";

const STORAGE_KEY = "site-theme";
const TRANSITION_MS = 560;

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "olive" || stored === "black" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Custom branded theme control — a small circular mark split between the two
 * accent worlds (yellow / olive). Clicking flips the mark and fades the whole
 * site into the other theme. The stored theme is applied before first paint
 * by an inline script in the root layout (no flash of the wrong theme).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = readStoredTheme();
    const fromDom = document.documentElement.dataset.theme as Theme | undefined;
    const resolved = stored ?? fromDom ?? "black";
    setTheme(resolved);
    if (!document.documentElement.dataset.theme) {
      document.documentElement.dataset.theme = resolved;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, []);

  function apply(next: Theme) {
    const root = document.documentElement;
    // Briefly flag the document so CSS cross-fades every color.
    root.classList.add("theme-transition");
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      root.classList.remove("theme-transition");
    }, TRANSITION_MS);
    root.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — the theme just won't persist */
    }
  }

  function toggle() {
    apply(theme === "olive" ? "black" : "olive");
  }

  const isOlive = theme === "olive";
  const label = isOlive ? "Switch to black theme" : "Switch to olive theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isOlive}
      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line text-fg outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Split yellow/olive disc — flips on every switch. */}
      <span
        aria-hidden="true"
        className="relative block h-4 w-4 overflow-hidden rounded-full transition-transform duration-500 ease-in-out"
        style={{ transform: isOlive ? "rotate(180deg)" : "rotate(0deg)" }}
      >
        <span
          className="absolute inset-0 bg-accent"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }}
        />
        <span
          className="absolute inset-0 bg-accent-2"
          style={{ clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)" }}
        />
      </span>
    </button>
  );
}
