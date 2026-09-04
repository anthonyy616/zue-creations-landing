import { revalidatePath } from "next/cache";
import type { ProjectCategory } from "@/db/schema";

export const CATEGORY_ROUTES: Record<ProjectCategory, string> = {
  photography: "/photography",
  cinematography: "/cinematography",
  branding: "/branding",
};

/**
 * Invalidates every public page that can show this project or its media:
 * the project page, its discipline listing, and the home page. Category
 * listings are only touched for the project's own category.
 */
export function revalidateProjectPublic(slug: string, category: ProjectCategory) {
  revalidatePath(`/work/${slug}`);
  revalidatePath(CATEGORY_ROUTES[category]);
  revalidatePath("/");
}

/** Invalidates a project's own page + listing when only media changed. */
export function revalidateMediaForProject(slug: string, category: ProjectCategory) {
  revalidatePath(`/work/${slug}`);
  revalidatePath(CATEGORY_ROUTES[category]);
  revalidatePath("/");
}
