import type { MetadataRoute } from "next";
import { getAllProjectSlugs } from "@/lib/public";
import { CATEGORY_ROUTES } from "@/lib/revalidate";
import { SITE_URL } from "@/lib/site";

/**
 * Public sitemap (plan Phase 14): homepage, discipline pages, packages,
 * enquiry, and published project detail pages only. Unpublished projects
 * never appear (getAllProjectSlugs filters to published), and admin/API/
 * login routes are excluded — they are disallowed in robots.ts as well.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}${CATEGORY_ROUTES.photography}`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}${CATEGORY_ROUTES.cinematography}`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}${CATEGORY_ROUTES.branding}`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/packages`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/enquire`, changeFrequency: "yearly", priority: 0.5 },
  ];

  try {
    const slugs = await getAllProjectSlugs();
    const projectRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
      url: `${SITE_URL}/work/${slug}`,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
    return [...staticRoutes, ...projectRoutes];
  } catch {
    // DB unavailable at build time: still ship the static routes.
    return staticRoutes;
  }
}
