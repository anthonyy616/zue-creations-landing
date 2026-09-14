import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Robots rules (plan Phase 14 / architecture.md §47): public pages are
 * crawlable; admin, API and login routes are not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api", "/api/", "/login"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
