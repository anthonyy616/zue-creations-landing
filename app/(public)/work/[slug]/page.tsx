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
import type { MediaView } from "@/lib/media";
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

function GalleryMedia({ media, index }: { media: MediaView; index: number }) {
  if (media.type === "video") {
    return (
      <figure>
        <video
          src={media.url}
          controls
          muted
          playsInline
          preload="metadata"
          className="block max-h-[85vh] w-full bg-line object-contain"
        />
        {media.altText ? (
          <figcaption className="mono-meta mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
            {media.altText}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure>
      {/* Plain <img> until Phase 6 introduces the responsive R2 loader. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={media.altText ?? ""}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading={index === 0 ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={index === 0 ? "high" : "auto"}
        className="block w-full bg-line"
      />
      {media.altText ? (
        <figcaption className="mono-meta mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
          {media.altText}
        </figcaption>
      ) : null}
    </figure>
  );
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
          <p className="mono-meta text-[11px] uppercase tracking-[0.24em] text-accent">
            {CATEGORY_LABELS[project.category]} · {year}
            {project.location ? ` · ${project.location}` : ""}
          </p>
          <h1 className="font-display mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.88] tracking-tight text-fg sm:text-7xl">
            {project.title}
          </h1>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            {project.description ? (
              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {project.description}
              </p>
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

      {/* Media gallery */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        {mediaViews.length === 0 ? (
          <p className="border-y border-line py-16 text-center text-sm uppercase tracking-[0.2em] text-muted">
            No media published for this project yet.
          </p>
        ) : (
          <div className="space-y-10">
            {mediaViews.map((media, index) => (
              <GalleryMedia key={media.id} media={media} index={index} />
            ))}
          </div>
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
