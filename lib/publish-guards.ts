import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { media, projects } from "@/db/schema";

/**
 * Publish guards (plan Phase 16 / architecture.md §40):
 *
 * A project may not go public when title, slug or cover media are missing,
 * or when its required media is still uploading/processing/failed.
 * A media asset may never be public while uploading/processing/failed/deleted
 * — that side is enforced centrally in lib/public.ts public queries.
 */

const BLOCKING_MEDIA_STATUSES = ["uploading", "processing", "failed", "deleted"] as const;

export type PublishCheck = { ok: true } | { ok: false; reason: string };

/** Media rows that block publishing (uploaded/processing/failed). */
async function blockingMediaForProject(projectId: string) {
  return db
    .select({ id: media.id, status: media.status, type: media.type, title: media.title })
    .from(media)
    .where(
      and(
        eq(media.projectId, projectId),
        inArray(media.status, [...BLOCKING_MEDIA_STATUSES])
      )
    );
}

/**
 * Validates that a project can be published. Returns the first blocking
 * reason in admin-friendly language.
 */
export async function checkProjectPublishable(
  project: { id: string; title: string; slug: string }
): Promise<PublishCheck> {
  if (!project.title.trim()) {
    return { ok: false, reason: "Add a title before publishing." };
  }
  if (!project.slug.trim()) {
    return { ok: false, reason: "Add a web address (slug) before publishing." };
  }

  const mediaRows = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.projectId, project.id))
    .limit(1);
  if (mediaRows.length === 0) {
    return { ok: false, reason: "Upload a cover image or video before publishing." };
  }

  const blocking = await blockingMediaForProject(project.id);
  const processing = blocking.find((m) => m.status === "uploading" || m.status === "processing");
  if (processing) {
    return {
      ok: false,
      reason: `A video is still processing. Publishing is blocked until it's ready ("${processing.title ?? "untitled video"}").`,
    };
  }
  const failed = blocking.find((m) => m.status === "failed");
  if (failed) {
    return {
      ok: false,
      reason: `A video failed processing. Retry, replace or delete it before publishing ("${failed.title ?? "untitled video"}").`,
    };
  }

  return { ok: true };
}

/**
 * Guard applied in updateProject: if the update would set published=true,
 * verify the project is publishable first.
 */
export async function guardPublishTransition(
  projectId: string,
  nextPublished: boolean,
  values: { title: string; slug: string }
): Promise<PublishCheck> {
  if (!nextPublished) return { ok: true };

  const [project] = await db
    .select({ id: projects.id, title: projects.title, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { ok: false, reason: "Project not found." };

  return checkProjectPublishable({
    id: project.id,
    // Use the incoming values so fixing title/slug in the same save counts.
    title: values.title || project.title,
    slug: values.slug || project.slug,
  });
}
