import type { ProjectWithMedia, ProjectCard } from "@/lib/public";
import { ProjectRow, EmptyWork } from "./work-list";
import MediaScroller from "./media-scroller";
import { mediaToSlide } from "@/lib/media-slides";
import { FadeUp, StaggerItem, StaggerList } from "./motion";
import Counter from "./counter";
import SectionDivider from "./section-divider";

/**
 * A discipline landing page.
 *
 *  - header (title, blurb, project count)
 *  - a drifting film strip of EVERY published frame across the branch's
 *    projects — several projects sit side by side and you scroll/swipe/drag
 *    between them (see MediaScroller). The strip only appears once there are
 *    at least two frames to move between; single images just render as rows.
 *  - the full project index below (titles, dates, descriptions → open page).
 */
export default function CategoryView({
  title,
  blurb,
  projects,
}: {
  title: string;
  blurb: string;
  projects: ProjectWithMedia[];
}) {
  // Every frame in this branch, tagged with the project it belongs to.
  const slides = projects.flatMap((project) =>
    project.media.map((m) =>
      mediaToSlide(m, {
        label: project.title,
        href: `/work/${project.slug}`,
      })
    )
  );

  // Project rows need a single cover image each (image preferred over video).
  const rows: ProjectCard[] = projects.map((p) => ({
    ...p,
    cover: p.media.find((m) => m.type === "image") ?? p.media[0] ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6">
      <SectionDivider style="fade">
        <FadeUp>
          <header className="grid gap-6 border-b border-line py-14 sm:py-20 lg:grid-cols-12">
            <h1 className="font-display text-6xl font-black uppercase leading-[0.85] tracking-tight sm:text-8xl lg:col-span-9">
              {title}
            </h1>
            <div className="flex flex-col justify-end gap-4 lg:col-span-3">
              <p className="max-w-xs text-sm leading-relaxed text-muted">{blurb}</p>
              <div className="flex items-end justify-end gap-6">
                <Counter value={projects.length} label="projects" />
                {slides.length > projects.length && (
                  <Counter value={slides.length} label="frames" />
                )}
              </div>
            </div>
          </header>
        </FadeUp>
      </SectionDivider>

      {projects.length === 0 ? (
        <div className="py-12">
          <EmptyWork label={`${title} work is coming soon.`} />
        </div>
      ) : (
        <>
          {/* ---------------------------------------------------------- rail */}
          {slides.length >= 2 ? (
            <FadeUp className="border-b border-line py-10 sm:py-12">
              <div className="flex items-end justify-between gap-6 pb-5">
                <h2 className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
                  Contact<span className="text-accent"> sheet</span>
                </h2>
                <p className="mono-meta hidden pb-1 text-[10px] uppercase tracking-[0.22em] text-muted sm:block">
                  All frames · {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </p>
              </div>
              <div className="relative">
                {/* Meeting point glow — accent glow at the left edge of the rail */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-1 h-20 bg-accent rounded-full blur-xl opacity-40" />
                <MediaScroller slides={slides} mode="rail" />
              </div>
            </FadeUp>
          ) : null}

          {/* ---------------------------------------------------------- index */}
          <section className="pt-10">
            <FadeUp>
              <header className="flex items-baseline justify-between border-b border-line pb-3">
                <h2 className="font-display text-sm font-black uppercase tracking-[0.18em]">
                  Index
                </h2>
                <p className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
                  Open a project
                </p>
              </header>
            </FadeUp>
            <StaggerList>
              {rows.map((project, index) => (
                <StaggerItem
                  key={project.id}
                  className="border-b border-line last:border-b-0"
                >
                  <ProjectRow project={project} index={index} />
                </StaggerItem>
              ))}
            </StaggerList>
          </section>
        </>
      )}
    </div>
  );
}
