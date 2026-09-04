/**
 * Custom next/image loader for media served from R2.
 *
 * Media URLs carry the widths of the variants that actually exist as a
 * `?v=480,960` query (see buildMediaView / loaderSrc below). The loader picks
 * the smallest variant that covers the requested width — falling back to the
 * largest one, or to the original file when no variant is wide enough or none
 * was generated. Variants are always WebP and named `<base>-<width>.webp`.
 *
 * This module is pure URL logic with no Node imports so Next can bundle it as
 * the loader file (runs in the browser for every optimized <Image>).
 */

const VARIANT_SUFFIX_RE = /^(.*?)(?:-\d+)?\.([a-z0-9]+)$/i;

/** Attaches the available variant widths to a media URL for the loader. */
export function loaderSrc(originalUrl: string, variantWidths: number[]): string {
  if (variantWidths.length === 0) return originalUrl;
  return `${originalUrl}?v=${variantWidths.join(",")}`;
}

function pickVariant(variantWidths: number[], width: number): number | null {
  if (variantWidths.length === 0) return null;
  // Smallest variant that still covers the requested width…
  for (const w of variantWidths) {
    if (w >= width) return w;
  }
  // …otherwise the largest one we have.
  return variantWidths[variantWidths.length - 1];
}

export default function r2ImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  const v = (url.searchParams.get("v") ?? "")
    .split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const segments = url.pathname.split("/");
  const filename = segments.pop() ?? "";
  const match = filename.match(VARIANT_SUFFIX_RE);
  if (!match) return src;
  const base = match[1];

  const chosen = pickVariant(v, width);
  if (chosen === null) {
    // No variants — original file (its own extension) is the only option.
    url.pathname = [...segments, `${base}.${match[2]}`].join("/");
  } else {
    url.pathname = [...segments, `${base}-${chosen}.webp`].join("/");
  }
  url.search = "";
  return url.toString();
}
