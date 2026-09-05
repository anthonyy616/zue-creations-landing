import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import InstagramIcon from "@/components/site/instagram-icon";
import {
  getAllProjectSlugs,
  getPublicProject,
  getProjectMediaViews,
} from "@/lib/public";
import MediaScroller from "@/components/site/media-scroller";
import { mediaToSlide } from "@/lib/media-slides";
import { FadeUp } from "@/components/site/motion";
import { CATEGORY_LABELS } from "@/components/site/work-list";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) return { title: "Project not found" };

  const mediaViews = await getProjectMediaViews(project.id);
  const firstImage = mediaViews.find((m) => m.type === "image");

  return {
    title: project.title,
    description:
      project.description ??
      `${CATEGORY_LABELS[project.category]} project from ${format(project.date, "yyyy")}.`,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      type: "article",
      title: project.title,
      description:
        project.description ??
        `${CATEGORY_LABELS[project.category]} project from ${format(project.date, "yyyy")}.`,
      images: firstImage
        ? [{ url: firstImage.url, width: firstImage.width ?? undefined, height: firstImage.height ?? undefined }]
        : undefined,
    },
  };
}


export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) notFound();

  const mediaViews = await getProjectMediaViews(project.id);
  const categoryHref = `/${project.category}`;
  const year = format(project.date, "yyyy");

  return (
    <article>
      {/* Back + category link */}
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href={categoryHref}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            {CATEGORY_LABELS[project.category]}
          </Link>
          <span className="mono-meta text-[10px] uppercase tracking-[0.22em] text-muted">
            {year}
          </span>
        </div>
      </div>

      {/* Title block */}
      <header className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <FadeUp>
            <p className="mono-meta text-[11px] uppercase tracking-[0.24em] text-accent">
              {CATEGORY_LABELS[project.category]} · {year}
              {project.location ? ` · ${project.location}` : ""}
            </p>
            <h1 className="font-display mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.88] tracking-tight text-fg sm:text-7xl">
              {project.title}
            </h1>
          </FadeUp>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            {project.description ? (
              <FadeUp delay={0.1} className="max-w-xl">
                <p className="text-base leading-relaxed text-muted sm:text-lg">
                  {project.description}
                </p>
              </FadeUp>
            ) : (
              <span />
            )}
            {project.instagramUrl ? (
              <a
                href={project.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-fg transition-colors hover:border-accent hover:text-accent"
              >
                <InstagramIcon size={14} strokeWidth={1.5} />
                View on Instagram <ArrowUpRight size={13} strokeWidth={1.5} />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* Media gallery — swipe / scroll / drag between every frame. */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        {mediaViews.length === 0 ? (
          <p className="border-y border-line py-16 text-center text-sm uppercase tracking-[0.2em] text-muted">
            No media published for this project yet.
          </p>
        ) : (
          <FadeUp>
            <MediaScroller
              slides={mediaViews.map((m) => mediaToSlide(m))}
              mode="pages"
            />
          </FadeUp>
        )}

        {/* Bottom nav */}
        <nav className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
          <Link
            href={categoryHref}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            More {CATEGORY_LABELS[project.category].toLowerCase()} work
          </Link>
          <Link
            href="/enquire"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-accent"
          >
            Enquire about a similar project <ArrowUpRight size={13} strokeWidth={1.5} />
          </Link>
        </nav>
      </div>
    </article>
  );
}
