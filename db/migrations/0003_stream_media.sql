-- Phase 2: provider-neutral media model + Stream support.
-- Backward compatible: existing image rows keep working (provider defaults to 'r2',
-- existing 'processing' | 'ready' | 'failed' statuses remain valid, storageKey becomes
-- nullable only so Stream-backed videos (which have no R2 object) can be stored.

-- 1. Widen the media_status enum (safe: additive values only).
ALTER TYPE "media_status" ADD VALUE IF NOT EXISTS 'uploading';
ALTER TYPE "media_status" ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE "media_status" ADD VALUE IF NOT EXISTS 'unpublished';
ALTER TYPE "media_status" ADD VALUE IF NOT EXISTS 'deleted';

-- 2. New provider enum + columns on media.
DO $$ BEGIN
  CREATE TYPE "media_provider" AS ENUM ('r2', 'cloudflare_stream');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "provider" "media_provider" DEFAULT 'r2' NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "provider_asset_id" varchar(500);
ALTER TABLE "media" ALTER COLUMN "storage_key" DROP NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "custom_poster_key" varchar(500);
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "title" varchar(200);
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "duration_seconds" integer;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "aspect_ratio" varchar(20);
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "preview_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "preview_start_seconds" integer DEFAULT 0 NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "preview_duration_seconds" integer DEFAULT 4 NOT NULL;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "seo_title" varchar(200);
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "seo_description" varchar(300);
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "deleted_by" uuid;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Existing rows were implicitly published; stamp them so SEO/uploadDate data is real.
UPDATE "media" SET "published_at" = "created_at" WHERE "published_at" IS NULL AND "status" IN ('ready', 'published');

CREATE INDEX IF NOT EXISTS "media_provider_asset_id_idx" ON "media" ("provider_asset_id");
CREATE INDEX IF NOT EXISTS "media_status_idx" ON "media" ("status");

-- 3. Project publishing + SEO fields. Default true keeps every existing project live.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT true NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "seo_title" varchar(200);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "seo_description" varchar(300);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "og_image_key" varchar(500);

UPDATE "projects" SET "published_at" = "created_at" WHERE "published_at" IS NULL;
