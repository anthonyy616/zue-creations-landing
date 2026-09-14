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
import SafeText from "@/components/site/safe-text";
import { safeInstagramUrl, sanitizeText } from "@/lib/sanitize";
import { publicMediaUrl } from "@/lib/r2";
import type { Project } from "@/db/schema";
import type { MediaView } from "@/lib/media";

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
  // Social image: OG override -> any image -> video poster (plan Phase 13).
  const ogMedia =
    mediaViews.find((m) => m.type === "image") ??
    mediaViews.find((m) => m.type === "video" && m.posterUrl) ?? null;
  const ogImage = project.ogImageKey
    ? publicMediaUrl(project.ogImageKey)
    : ogMedia
      ? ogMedia.type === "image"
        ? ogMedia.url
        : ogMedia.posterUrl
      : null;

  const title = project.seoTitle || project.title;
  const description =
    project.seoDescription ||
    project.description ||
    `${CATEGORY_LABELS[project.category]} project from ${format(project.date, "yyyy")}.`;

  return {
    title,
    description,
    alternates: { canonical: `/work/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/work/${slug}`,
      images: ogImage
        ? [{ url: ogImage }]
        : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

/** ISO-8601 duration for VideoObject, e.g. PT1M30S. Returns null when unknown. */
function isoDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

/**
 * VideoObject JSON-LD (plan Phase 13 / media-rules.md §21): generated only
 * from real CMS data, only for published projects with READY video that has
 * a title and poster — never fake fields for missing data.
 */
function VideoObjectJsonLd({
  project,
  video,
}: {
  project: Project;
  video: MediaView;
}) {
  if (!video.posterUrl || !(video.title || project.title)) return null;
  const duration = isoDuration(video.durationSeconds);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.seoTitle || video.title || project.title,
    description:
      video.seoDescription || video.description || project.description || project.title,
    thumbnailUrl: [video.posterUrl],
    uploadDate: (video.publishedAt ?? project.publishedAt ?? project.createdAt ?? new Date()).toISOString(),
    embedUrl: video.streamEmbedUrl ?? undefined,
  };
  if (duration) data.duration = duration;

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe structured data; sanitize is applied upstream.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}


export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) notFound();

  const mediaViews = await getProjectMediaViews(project.id);
  const categoryHref = `/${project.category}`;
  const year = format(project.date, "yyyy");

  // Structured data: first READY video with enough metadata (media-rules.md §21).
  const seoVideo = mediaViews.find(
    (m) => m.type === "video" && m.provider === "cloudflare_stream" && m.posterUrl
  );

  return (
    <article>
      {seoVideo ? <VideoObjectJsonLd project={project} video={seoVideo} /> : null}
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
              {project.location ? ` · ${sanitizeText(project.location)}` : ""}
            </p>
            <h1 className="font-display mt-6 max-w-5xl text-5xl font-black uppercase leading-[0.88] tracking-tight text-fg sm:text-7xl">
              <SafeText>{project.title}</SafeText>
            </h1>
          </FadeUp>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            {project.description ? (
              <FadeUp delay={0.12} className="max-w-xl">
                <p className="text-base leading-relaxed text-muted sm:text-lg">
                  <SafeText>{project.description}</SafeText>
                </p>
              </FadeUp>
            ) : (
              <span />
            )}
            {project.instagramUrl ? (
              <FadeUp delay={0.2}>
                <a
                  href={safeInstagramUrl(project.instagramUrl) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group/ig inline-flex w-fit items-center gap-2 border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-fg transition-all duration-300 hover:border-accent hover:text-accent hover:translate-x-1"
                  aria-invalid={project.instagramUrl && !safeInstagramUrl(project.instagramUrl) ? true : undefined}
                >
                  <InstagramIcon size={14} strokeWidth={1.5} />
                  View on Instagram <ArrowUpRight size={13} strokeWidth={1.5} className="transition-transform duration-300 group-hover/ig:translate-x-0.5 group-hover/ig:-translate-y-0.5" />
                </a>
              </FadeUp>
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
