/**
 * Cleanup job: purges soft-deleted Cloudflare Stream assets (architecture.md
 * §38.2 / §38.3, media-rules.md §18).
 *
 * Deletes rows with status='deleted' whose deletedAt is older than the
 * retention window (default 30 days). For each: destroys the Stream asset
 * via the provider API, removes any R2 custom poster, then deletes the DB
 * row. Provider failures are non-fatal per row — the row stays deleted in
 * the DB and will be retried on the next run (purge is idempotent).
 *
 * Usage:
 *   npx tsx scripts/cleanup-deleted-media.ts            # 30-day retention
 *   npx tsx scripts/cleanup-deleted-media.ts --days=7   # custom window
 *   npx tsx scripts/cleanup-deleted-media.ts --dry-run  # report only
 *
 * Run manually, from a CI cron, or later from a Vercel scheduled function.
 * Never called from the public frontend.
 */

import "dotenv/config";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "../lib/db";
import { media } from "../db/schema";
import { deleteVideo, isStreamConfigured } from "../lib/stream";
import { r2, R2_BUCKET_NAME } from "../lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const DEFAULT_RETENTION_DAYS = 30;
const PROVIDER_DELETE_RETRIES = 2;

function parseArgs(): { days: number; dryRun: boolean } {
  let days = DEFAULT_RETENTION_DAYS;
  let dryRun = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--dry-run") dryRun = true;
    const daysMatch = arg.match(/^--days=(\d+)$/);
    if (daysMatch) days = Number(daysMatch[1]);
  }
  if (!Number.isFinite(days) || days < 1) {
    throw new Error(`Invalid retention window: ${days} days (must be >= 1)`);
  }
  return { days, dryRun };
}

async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

async function deleteStreamAssetWithRetry(uid: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= PROVIDER_DELETE_RETRIES; attempt++) {
    try {
      await deleteVideo(uid);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < PROVIDER_DELETE_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function main() {
  const { days, dryRun } = parseArgs();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  console.log(
    `Cleanup: soft-deleted media older than ${days} days (before ${cutoff.toISOString()})${dryRun ? " — DRY RUN" : ""}`
  );

  const candidates = await db
    .select({
      id: media.id,
      provider: media.provider,
      providerAssetId: media.providerAssetId,
      storageKey: media.storageKey,
      customPosterKey: media.customPosterKey,
      posterKey: media.posterKey,
      deletedAt: media.deletedAt,
    })
    .from(media)
    .where(and(eq(media.status, "deleted"), isNotNull(media.deletedAt), lt(media.deletedAt, cutoff)));

  if (candidates.length === 0) {
    console.log("Nothing to purge.");
    return;
  }

  let purged = 0;
  let failed = 0;

  for (const row of candidates) {
    const label = `media ${row.id}${row.providerAssetId ? ` (stream ${row.providerAssetId})` : ""}`;

    if (dryRun) {
      console.log(`[dry-run] would purge ${label}, deletedAt=${row.deletedAt?.toISOString()}`);
      purged++;
      continue;
    }

    try {
      // 1. Destroy the Stream asset (only Stream-backed rows have a UID).
      if (row.provider === "cloudflare_stream" && row.providerAssetId) {
        if (!isStreamConfigured()) {
          console.warn(`Skip ${label}: Cloudflare Stream is not configured`);
          failed++;
          continue;
        }
        await deleteStreamAssetWithRetry(row.providerAssetId);
      }

      // 2. Remove the R2 custom poster (the video itself never lived in R2).
      const posterKey = row.customPosterKey ?? row.posterKey;
      if (posterKey) {
        try {
          await deleteR2Object(posterKey);
        } catch (err) {
          // Poster cleanup failure shouldn't block the purge — the poster is
          // unreferenced once the row is gone.
          console.warn(`Poster cleanup failed for ${label} (${posterKey})`, err);
        }
      }

      // 3. Remove the DB row.
      await db.delete(media).where(eq(media.id, row.id));

      console.log(`Purged ${label}`);
      purged++;
    } catch (err) {
      // Row stays status='deleted' — retried on the next run.
      console.error(`Failed to purge ${label} — will retry on next run`, err);
      failed++;
    }
  }

  console.log(`Done: ${purged} purged, ${failed} failed${dryRun ? " (dry run)" : ""}.`);
  if (failed > 0 && !dryRun) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
