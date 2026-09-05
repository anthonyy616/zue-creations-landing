import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import type { ProjectCard } from "@/lib/public";
import type { MediaView } from "@/lib/media";
import { loaderSrc } from "@/lib/image-loader";
import AutoplayVideo from "./autoplay-video";

export const CATEGORY_LABELS: Record<string, string> = {
  photography: "Photography",
  cinematography: "Cinematography",
  branding: "Branding",
};

function CoverMedia({ media }: { media: MediaView }) {
  if (media.type === "video") {
    return (
      <AutoplayVideo
        src={media.url}
        label={media.altText ?? "Video preview"}
        className="h-full w-full object-cover"
      />
    );
  }
  if (media.status !== "ready" || !media.width || !media.height) {
    // While processing or on failure, show the LQIP placeholder — never
    // the raw original which can be up to 50 MB.
    if (media.lqipDataUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.lqipDataUrl}
          alt={media.altText ?? ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover blur-sm scale-110"
        />
      );
    }
    return (
      <div className="h-full w-full bg-white/[0.04]" />
    );
  }
  return (
    <Image
      src={loaderSrc(media.originalUrl, media.variantWidths)}
      alt={media.altText ?? ""}
      fill
      sizes="(min-width: 1024px) 640px, 92vw"
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
    />
  );
}

/**
 * One editorial project row. Rows alternate media width/offset for an
 * asymmetric magazine rhythm rather than a uniform grid.
 *
 * ProjectRow renders just the content so callers can wrap it in their own
 * <li> (e.g. an animated one). ProjectListRow is the ready-made bordered li.
 */
export function ProjectRow({
  project,
  index,
}: {
  project: ProjectCard;
  index: number;
}) {
  const number = String(index + 1).padStart(2, "0");
  const mediaOnLeft = index % 2 === 0;
  const year = format(project.date, "yyyy");

  const meta = (
    <>
      <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
        {CATEGORY_LABELS[project.category]} · {year}
      </span>
      <h3 className="font-display mt-3 text-2xl font-bold uppercase leading-[0.95] tracking-tight text-fg sm:text-3xl">
        {project.title}
      </h3>
      {project.description ? (
        <p className="mt-4 line-clamp-3 max-w-md text-sm leading-relaxed text-muted">
          {project.description}
        </p>
      ) : null}
      <span className="mt-5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
        View project <ArrowUpRight size={13} strokeWidth={1.5} />
      </span>
    </>
  );

  return (
    <Link
      href={`/work/${project.slug}`}
      data-cursor="view"
      className="group grid gap-6 py-10 outline-none lg:grid-cols-12 lg:items-center lg:gap-x-6 focus-visible:ring-2 focus-visible:ring-accent"
    >
        {/* Numeric index — a quiet running page number at the outer edge. */}
        <span
          aria-hidden="true"
          className={`mono-meta hidden text-sm text-muted lg:block ${
            mediaOnLeft
              ? "lg:col-start-1 lg:row-start-1"
              : "lg:col-start-12 lg:row-start-1 lg:text-right"
          }`}
        >
          {number}
        </span>

        <div
          className={`relative aspect-[4/3] w-full overflow-hidden bg-line lg:row-start-1 ${
            mediaOnLeft
              ? "lg:col-span-7 lg:col-start-2" // index (1) + media (2–8)
              : "lg:col-span-7 lg:col-start-5" // media (5–11) + index (12)
          }`}
        >
          {project.cover ? (
            <CoverMedia media={project.cover} />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-center">
              <span className="mono-meta text-[10px] uppercase tracking-[0.2em] text-muted">
                {CATEGORY_LABELS[project.category]} — {year}
              </span>
            </div>
          )}
          {/* Subtle editorial number overlay */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 bottom-4 text-[10px] font-bold tracking-[0.2em] text-fg/20 transition-colors duration-500 group-hover:text-accent/40"
          >
            {number}
          </span>
        </div>

        <div
          className={`lg:row-start-1 ${
            mediaOnLeft
              ? "lg:col-span-4 lg:col-start-9" // meta (9–12)
              : "lg:col-span-4 lg:col-start-1 lg:text-right" // meta (1–4)
          }`}
        >
          {meta}
        </div>
    </Link>
  );
}

export function ProjectListRow({
  project,
  index,
}: {
  project: ProjectCard;
  index: number;
}) {
  return (
    <li className="border-b border-line last:border-b-0">
      <ProjectRow project={project} index={index} />
    </li>
  );
}

export function EmptyWork({ label }: { label: string }) {
  return (
    <p className="border-y border-line py-16 text-center text-sm uppercase tracking-[0.2em] text-muted">
      {label}
    </p>
  );
}
