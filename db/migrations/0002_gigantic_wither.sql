CREATE TYPE "public"."media_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "status" "media_status" DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "lqip_data_url" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "poster_key" varchar(500);