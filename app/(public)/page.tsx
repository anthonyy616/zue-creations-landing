import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { getHomeProjects } from "@/lib/public";
import { ProjectRow, EmptyWork } from "@/components/site/work-list";
import {
  FadeUp,
  PointerTilt,
  RevealLine,
  StaggerItem,
  StaggerList,
} from "@/components/site/motion";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const DISCIPLINES = [
  {
    href: "/photography",
    title: "Photography",
    blurb: "Still frames, portraiture and visual essays.",
  },
  {
    href: "/cinematography",
    title: "Cinematography",
    blurb: "Motion, film and image-led storytelling.",
  },
  {
    href: "/branding",
    title: "Branding",
    blurb: "Identity, art direction and campaign work.",
  },
];

export default async function HomePage() {
  const projects = await getHomeProjects();

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Hero — magazine opening spread.                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <p className="mono-meta text-[11px] uppercase tracking-[0.24em] text-accent">
              Photography · Cinematography · Branding
            </p>
            <PointerTilt max={7} className="mt-6">
              <h1 className="font-display text-[13vw] font-black uppercase leading-[0.86] tracking-tight text-fg sm:text-7xl md:text-8xl">
                <RevealLine delay={0.05}>Pictures</RevealLine>
                <RevealLine delay={0.18} driftDelay={0.7}>that feel like</RevealLine>
                <RevealLine delay={0.31} driftDelay={1.4}>
                  <span className="font-accent-serif font-normal normal-case tracking-tight text-accent">
                    stories.
                  </span>
                </RevealLine>
              </h1>
            </PointerTilt>
          </div>

          <div className="flex flex-col justify-end gap-8 lg:col-span-4 lg:pb-2">
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              An independent visual practice working across still and moving
              image — selected projects, told one at a time.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href="/enquire"
                className="inline-flex items-center gap-2 border border-line px-5 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-fg transition-colors hover:border-accent hover:text-accent"
              >
                Start a project <ArrowUpRight size={14} strokeWidth={1.5} />
              </Link>
              <Link
                href="#work"
                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
              >
                Selected work <ArrowDown size={14} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Selected work                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-6">
        <FadeUp>
          <header className="flex items-end justify-between gap-6 pt-16">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
              Selected<span className="text-accent"> work</span>
            </h2>
            <p className="mono-meta pb-1 text-[10px] uppercase tracking-[0.22em] text-muted">
              {String(projects.length).padStart(2, "0")} projects
            </p>
          </header>
        </FadeUp>

        {projects.length === 0 ? (
          <div className="pt-8">
            <EmptyWork label="Selected work is coming soon." />
          </div>
        ) : (
          <StaggerList className="mt-4">
            {projects.map((project, index) => (
              <StaggerItem
                key={project.id}
                className="border-b border-line last:border-b-0"
              >
                <ProjectRow project={project} index={index} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Discipline index — browse by work type                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <FadeUp>
          <header className="pt-20">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
              Browse by<span className="text-accent"> discipline</span>
            </h2>
          </header>
        </FadeUp>
        <StaggerList className="mt-8 border-t border-line">
          {DISCIPLINES.map((d, index) => (
            <StaggerItem key={d.href} className="border-b border-line">
              <Link
                href={d.href}
                className="group flex items-center justify-between gap-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-x-1 sm:py-8"
              >
                <div className="flex items-baseline gap-5 sm:gap-8">
                  <span className="mono-meta hidden text-xs text-muted sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="font-display block text-3xl font-black uppercase leading-none tracking-tight transition-transform duration-500 ease-out group-hover:translate-x-2 sm:text-5xl md:text-6xl">
                      {d.title}
                    </span>
                    <span className="mt-2 hidden max-w-md text-sm text-muted sm:block">
                      {d.blurb}
                    </span>
                  </div>
                </div>
                <ArrowUpRight
                  size={28}
                  strokeWidth={1.25}
                  className="shrink-0 text-muted transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-accent group-active:translate-y-0 group-active:text-accent"
                />
              </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Enquiry CTA                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
          <FadeUp>
            <h2 className="font-display max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tight sm:text-6xl">
              Have a story
              <br />
              <span className="font-accent-serif font-normal normal-case text-accent">
                to tell?
              </span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.15} className="max-w-xs lg:text-right">
            <p className="text-sm leading-relaxed text-muted">
              Tell me about the project — a form, a few questions, and the
              right package for the work.
            </p>
            <Link
              href="/enquire"
              className="mt-6 inline-flex items-center gap-2 border border-line px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-fg transition-colors hover:border-accent hover:text-accent"
            >
              Start an enquiry <ArrowUpRight size={14} strokeWidth={1.5} />
            </Link>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}
