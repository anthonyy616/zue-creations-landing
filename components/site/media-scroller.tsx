"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaSlide } from "@/lib/media-slides";
import { loaderSrc } from "@/lib/image-loader";
import AutoplayVideo from "./autoplay-video";

/* -------------------------------------------------------------------------- */
/* The scroller                                                               */
/* -------------------------------------------------------------------------- */

const AUTO_MS = 5200; // dwell per tile when drifting on its own
const SETTLE_MS = 4200; // after a manual interaction, stay quiet a moment

type Mode = "rail" | "pages";

function TileMedia({
  slide,
  mode,
  eager,
}: {
  slide: MediaSlide;
  mode: Mode;
  eager: boolean;
}) {
  if (slide.kind === "video") {
    // Use the poster URL if available — it's the guaranteed visual fallback
    return (
      <AutoplayVideo
        src={slide.src}
        poster={slide.poster ?? undefined}
        label={slide.alt ?? slide.label ?? "Video"}
        className="h-full w-full object-cover"
      />
    );
  }
  // While processing and we have an LQIP, show the LQIP placeholder.
  // While processing with no LQIP, fall back to the original so the frame
  // is still visible (the original exists in R2 even before variants land).
  // On failure with no LQIP, show a subtle placeholder.
  if (slide.status === "processing" && slide.lqipDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={slide.lqipDataUrl}
        alt={slide.alt ?? ""}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-cover blur-sm scale-110"
      />
    );
  }
  if (slide.status === "processing") {
    // No LQIP yet — show the original so the frame is not blank.
    return (
      <Image
        src={loaderSrc(slide.originalUrl, slide.variantWidths)}
        alt={slide.alt ?? ""}
        fill
        priority={eager}
        sizes={mode === "rail" ? "(min-width: 1024px) 520px, 82vw" : "100vw"}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
      />
    );
  }
  if (slide.status === "failed") {
    if (slide.lqipDataUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.lqipDataUrl}
          alt={slide.alt ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover blur-sm scale-110"
        />
      );
    }
    // No LQIP available either — show a subtle placeholder.
    return (
      <div className="h-full w-full bg-white/[0.04]" />
    );
  }
  return (
    <Image
      src={loaderSrc(slide.originalUrl, slide.variantWidths)}
      alt={slide.alt ?? ""}
      fill
      priority={eager}
      sizes={mode === "rail" ? "(min-width: 1024px) 520px, 82vw" : "100vw"}
      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
    />
  );
}

/**
 * Custom-JS horizontal media strip. Two behaviours:
 *
 *  - rail  — film-strip of every image in a category. Tiles sit side by side
 *            (so several projects' frames are visible at once) and the strip
 *            drifts forward on its own, pausing while you hover, touch, drag
 *            or scroll. Scroll (vertical wheel maps sideways), drag with mouse
 *            or finger, arrow keys and edge arrows all move between frames.
 *
 *  - pages — a project page gallery. Each media item fills one wide page you
 *            swipe/scroll between; captions sit under the frame.
 *
 * Reduced motion disables the autonomous drift and snaps instantly.
 */
export default function MediaScroller({
  slides,
  mode = "rail",
  auto = true,
  className = "",
}: {
  slides: MediaSlide[];
  mode?: Mode;
  /** Autonomous drift (rail only, ignored in pages mode). */
  auto?: boolean;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  // Interaction gates for the drift.
  const hovered = useRef(false);
  const pointerDown = useRef(false);
  const lastInteract = useRef(0);
  const inView = useRef(true);
  // Set the instant a drag ends so the browser-generated click (if any) can
  // be cancelled; disarmed on the next macrotask so later real clicks pass.
  const suppressNextClick = useRef(false);
  const dragDisarm = useRef<ReturnType<typeof setTimeout> | null>(null);

  const n = slides.length;
  const drift = auto && mode === "rail" && n > 1;

  // The active frame is the one sitting at the viewport's leading edge — for
  // tiles around half the viewport width, centre-distance heuristics pick the
  // wrong neighbour, so compare against the left edge instead.
  const indexOf = useCallback((): number => {
    const vp = viewportRef.current;
    if (!vp || n === 0) return 0;
    const sl = vp.scrollLeft;
    let best = 0;
    for (let i = 0; i < n; i++) {
      const el = slideRefs.current[i];
      if (!el) break;
      const left =
        el.getBoundingClientRect().left - vp.getBoundingClientRect().left + sl;
      if (left <= sl + 8) best = i;
      else break;
    }
    return best;
  }, [n]);


  const setActive = useCallback(() => {
    const i = indexOf();
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
    }
  }, [indexOf]);

  // Keep index in sync as the user scrolls (throttled to animation frames).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setActive();
      });
    };
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [setActive]);

  // Clear any pending drag-click suppression on unmount.
  useEffect(() => {
    return () => {
      if (dragDisarm.current) clearTimeout(dragDisarm.current);
    };
  }, []);

  // Horizontal wheel support (vertical wheel pans the strip).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || n <= 1) return;
    const onWheel = (e: WheelEvent) => {
      const max = vp.scrollWidth - vp.clientWidth;
      if (max <= 1) return;
      const amount = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!amount) return;
      const factor = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 32 : 1;
      const step = amount * factor;
      const atStart = vp.scrollLeft <= 1;
      const atEnd = vp.scrollLeft >= max - 1;
      if ((step > 0 && atEnd) || (step < 0 && atStart)) return; // page scrolls instead
      e.preventDefault();
      vp.scrollLeft += step;
      lastInteract.current = Date.now();
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [n]);

  // Pause the drift whenever the strip leaves the viewport.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        inView.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.1 }
    );
    io.observe(vp);
    return () => io.disconnect();
  }, []);

  // Autonomous drift — steps one frame ahead while nothing is happening.
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const goTo = useCallback(
    (target: number) => {
      const vp = viewportRef.current;
      const el = slideRefs.current[((target % n) + n) % n];
      if (!vp || !el) return;
      const left = el.getBoundingClientRect().left - vp.getBoundingClientRect().left + vp.scrollLeft;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      vp.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
      lastInteract.current = Date.now();
    },
    [n]
  );

  useEffect(() => {
    if (!drift || reducedMotion) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      timer = setTimeout(() => {
        const quiet =
          !hovered.current &&
          !pointerDown.current &&
          inView.current &&
          Date.now() - lastInteract.current > SETTLE_MS;
        if (quiet) goTo(indexRef.current + 1);
        schedule();
      }, AUTO_MS);
    };
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [drift, reducedMotion, goTo]);

  // Mouse/finger dragging (horizontal translate). Vertical page scroll keeps
  // working thanks to touch-action: pan-y on the viewport. Drag tracking runs
  // on window (no pointer capture) so dragging never retargets the browser's
  // click — links keep working after a drag.
  const dragState = useRef({
    id: -1,
    x: 0,
    startLeft: 0,
    moved: false,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || pointerDown.current) return;
    const vp = viewportRef.current;
    if (!vp) return;
    pointerDown.current = true;
    if (dragDisarm.current) clearTimeout(dragDisarm.current);
    suppressNextClick.current = false;
    dragState.current = {
      id: e.pointerId,
      x: e.clientX,
      startLeft: vp.scrollLeft,
      moved: false,
    };
    vp.style.scrollSnapType = "none"; // don't fight the drag
    setDragging(true);
    lastInteract.current = Date.now();
  };

  const endDrag = useCallback(() => {
    const vp = viewportRef.current;
    pointerDown.current = false;
    setDragging(false);
    if (dragState.current.moved) {
      // The browser fires a synthetic click right after this pointerup if the
      // down/up targets share an ancestor — cancel exactly that one.
      suppressNextClick.current = true;
      if (dragDisarm.current) clearTimeout(dragDisarm.current);
      dragDisarm.current = setTimeout(() => {
        suppressNextClick.current = false;
      }, 0);
    }
    if (vp) vp.style.scrollSnapType = "";
    lastInteract.current = Date.now();
  }, []);

  // Window-level drag tracking — added once, active only while pointerDown.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const vp = viewportRef.current;
      if (!pointerDown.current || !vp) return;
      if (e.pointerId !== dragState.current.id) return;
      const dx = e.clientX - dragState.current.x;
      if (Math.abs(dx) > 6) {
        dragState.current.moved = true;
      }
      if (dragState.current.moved) {
        vp.scrollLeft = dragState.current.startLeft - dx;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragState.current.id) return;
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endDrag]);

  const buttonsDisabled = n <= 1;

  const label = useMemo(() => {
    return slides.length > 1
      ? `Media gallery — frame ${index + 1} of ${slides.length}`
      : undefined;
  }, [index, slides.length]);

  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  return (
    <div className={className}>
      {/* ------------------------------------------------ viewport + track */}
      <div
        ref={viewportRef}
        role="region"
        aria-label={label ?? "Media gallery"}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          // A drag that ended over a link must not navigate.
          if (suppressNextClick.current) {
            suppressNextClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            prev();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            next();
          }
        }}
        onMouseEnter={() => {
          hovered.current = true;
        }}
        onMouseLeave={() => {
          hovered.current = false;
        }}
        onFocus={() => {
          hovered.current = true;
        }}
        onBlur={() => {
          hovered.current = false;
        }}
        onDragStart={(e) => e.preventDefault()}
        className={`no-scrollbar group/scroller relative cursor-grab overflow-x-auto outline-none snap-x snap-proximity focus-visible:ring-2 focus-visible:ring-accent ${
          mode === "pages" ? "snap-mandatory" : ""
        } ${dragging ? "cursor-grabbing" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        <div className={`flex ${mode === "rail" ? "items-stretch gap-4 sm:gap-5" : "items-center gap-0"}`}>
          {slides.map((slide, i) => {
            const slideRef = (el: HTMLElement | null) => {
              slideRefs.current[i] = el;
            };

            if (mode === "pages") {
              return (
                <figure
                  key={slide.key}
                  ref={slideRef}
                  className="flex w-full shrink-0 snap-start flex-col"
                >
                  <div className="relative flex h-[clamp(300px,58vh,640px)] w-full select-none items-center justify-center overflow-hidden bg-white/[0.04] transition-transform duration-700 ease-out hover:scale-[1.02]">
                    {slide.kind === "video" ? (
                      <AutoplayVideo
                        src={slide.src}
                        label={slide.alt ?? slide.label ?? "Video"}
                        className="h-full w-full object-contain"
                      />
                    ) : slide.status === "processing" && slide.lqipDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.lqipDataUrl}
                        alt={slide.alt ?? ""}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                        className="max-h-full w-auto max-w-full object-contain blur-sm scale-110 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    ) : slide.status === "processing" ? (
                      <Image
                        src={loaderSrc(slide.originalUrl, slide.variantWidths)}
                        alt={slide.alt ?? ""}
                        fill
                        priority={i === 0}
                        sizes="100vw"
                        className="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    ) : slide.status === "failed" ? (
                      slide.lqipDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.lqipDataUrl}
                          alt={slide.alt ?? ""}
                          loading={i === 0 ? "eager" : "lazy"}
                          decoding="async"
                          className="max-h-full w-auto max-w-full object-contain blur-sm scale-110 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="max-h-full w-auto max-w-full bg-white/[0.04]" />
                      )
                    ) : (
                      <Image
                        src={loaderSrc(slide.originalUrl, slide.variantWidths)}
                        alt={slide.alt ?? ""}
                        fill
                        priority={i === 0}
                        sizes="100vw"
                        className="object-contain transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  {slide.alt ? (
                    <figcaption className="mono-meta mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
                      {slide.alt}
                    </figcaption>
                  ) : null}
                </figure>
              );
            }

            // ---- rail tile -------------------------------------------------
            const inner = (
              <div className="relative aspect-[4/3] h-full w-full select-none overflow-hidden bg-white/[0.04]">
                <TileMedia slide={slide} mode={mode} eager={i === 0} />
                {slide.label ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3 pt-10 transition-opacity duration-500 sm:p-4">
                    <span className="font-display text-[13px] font-bold uppercase tracking-tight text-white">
                      {slide.label}
                    </span>
                    <ChevronRight
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-white/80 transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-accent group-hover:opacity-100 opacity-70"
                    />
                  </span>
                ) : null}
              </div>
            );

            return (
              <div
                key={slide.key}
                ref={slideRef}
                className="group h-full w-[clamp(260px,74vw,540px)] shrink-0 snap-start select-none"
              >
                {slide.href ? (
                  <Link
                    href={slide.href}
                    aria-label={`${slide.label ?? "Project"} — open project`}
                    className="group block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    draggable={false}
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ controls */}
      {slides.length > 1 ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-4">
            <p className="mono-meta hidden text-[10px] uppercase tracking-[0.22em] text-muted sm:block">
              {mode === "rail"
                ? "Drag, scroll or wait — frames drift on their own"
                : "Scroll, swipe or use the arrows"}
            </p>
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted" aria-live="polite">
                {String(index + 1).padStart(2, "0")}
                <span className="mx-1 opacity-60">/</span>
                {String(slides.length).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prev}
                  disabled={buttonsDisabled}
                  aria-label="Previous frame"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line text-fg outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-30 active:scale-95"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={buttonsDisabled}
                  aria-label="Next frame"
                  className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-line text-fg outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-30 active:scale-95"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
          {/* hairline progress */}
          <div className="mt-3 h-px w-full bg-line">
            <div
              className="h-px bg-accent transition-[width] duration-500 ease-out"
              style={{
                width: `${n > 1 ? (index / (n - 1)) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
