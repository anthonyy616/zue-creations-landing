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
  AmbientFloat,
  Heartbeat,
} from "@/components/site/motion";
import Marquee from "@/components/site/marquee";
import SectionDivider from "@/components/site/section-divider";
import Counter from "@/components/site/counter";
// import HeroSpotlight from "@/components/site/hero-spotlight";
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
              <AmbientFloat yRange={4} xRange={3} duration={9} className="inline-block">
                <h1 className="font-display text-[13vw] font-black uppercase leading-[0.86] tracking-tight text-fg sm:text-7xl md:text-8xl">
                  <RevealLine delay={0.05}>Pictures</RevealLine>
                  <RevealLine delay={0.18} driftDelay={0.7}>that feel like</RevealLine>
                  <RevealLine delay={0.31} driftDelay={1.4}>
                    <span className="font-accent-serif font-normal normal-case tracking-tight text-accent">
                      stories.
                    </span>
                  </RevealLine>
                </h1>
              </AmbientFloat>
            </PointerTilt>
          </div>

          <div className="flex flex-col justify-end gap-8 lg:col-span-4 lg:pb-2">
            <FadeUp delay={0.5}>
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                An independent visual practice working across still and moving
                image — selected projects, told one at a time.
              </p>
            </FadeUp>

            <FadeUp delay={0.65}>
              <div className="flex flex-wrap items-center gap-6">
                <Heartbeat className="group/btn">
                  <Link
                    href="/enquire"
                    className="inline-flex items-center gap-2 border border-line px-5 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-fg transition-all duration-300 hover:border-accent hover:text-accent hover:translate-x-1"
                  >
                    Start a project <ArrowUpRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </Link>
                </Heartbeat>
                <Link
                  href="#work"
                  className="group/link inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-fg"
                >
                  Selected work <ArrowDown size={14} strokeWidth={1.5} className="transition-transform duration-500 group-hover/link:translate-y-0.5" />
                </Link>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Editorial strip                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Marquee
        text="PHOTOGRAPHY · CINEMATOGRAPHY · CREATIVE DIRECTION · VISUAL STORYTELLING ·"
        speed={42}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Selected work                                                      */}
      {/* ------------------------------------------------------------------ */}
      <SectionDivider style="fade">
        <section id="work" className="mx-auto max-w-6xl scroll-mt-20 px-6">
          <FadeUp>
            <header className="flex items-end justify-between gap-6 pt-16">
              <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
                Selected<span className="text-accent"> work</span>
              </h2>
              <Counter value={projects.length} label="projects" />
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
      </SectionDivider>

      {/* ------------------------------------------------------------------ */}
      {/* Discipline index — browse by work type                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <FadeUp>
          <header className="pt-20">
            <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
              Browse<span className="text-accent"> here</span>
            </h2>
          </header>
        </FadeUp>
        <StaggerList className="mt-8 border-t border-line">
          {DISCIPLINES.map((d, index) => (
            <StaggerItem key={d.href} className="border-b border-line">
              <Link
                href={d.href}
                className="group/disc flex items-center justify-between gap-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-accent active:translate-x-1 sm:py-8"
              >
                <div className="flex items-baseline gap-5 sm:gap-8">
                  <span className="mono-meta hidden text-xs text-muted transition-colors duration-300 group-hover/disc:text-accent sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="font-display block text-3xl font-black uppercase leading-none tracking-tight transition-all duration-500 ease-out group-hover/disc:translate-x-2 group-hover/disc:text-accent sm:text-5xl md:text-6xl">
                      {d.title}
                    </span>
                    <span className="mt-2 hidden max-w-md text-sm text-muted transition-colors duration-300 group-hover/disc:text-fg/70 sm:block">
                      {d.blurb}
                    </span>
                  </div>
                </div>
                <ArrowUpRight
                  size={28}
                  strokeWidth={1.25}
                  className="shrink-0 text-muted transition-all duration-300 group-hover/disc:translate-x-1 group-hover/disc:-translate-y-1 group-hover/disc:text-accent group-active:translate-y-0 group-active:text-accent"
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
            <Heartbeat className="mt-6">
              <Link
                href="/enquire"
                className="inline-flex items-center gap-2 border border-line px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-fg transition-colors hover:border-accent hover:text-accent"
              >
                Start an enquiry <ArrowUpRight size={14} strokeWidth={1.5} />
              </Link>
            </Heartbeat>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}
