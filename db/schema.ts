import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const mediaStatusEnum = pgEnum("media_status", [
  "processing",
  "ready",
  "failed",
  "uploading",
  "published",
  "unpublished",
  "deleted",
]);

export const categoryEnum = pgEnum("category", [
  "photography",
  "cinematography",
  "branding",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);

export const mediaProviderEnum = pgEnum("media_provider", ["r2", "cloudflare_stream"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    category: categoryEnum("category").notNull(),
    date: timestamp("date").notNull(),
    description: text("description"),
    location: varchar("location", { length: 200 }),
    instagramUrl: varchar("instagram_url", { length: 300 }),
    featured: boolean("featured").default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    published: boolean("published").default(true).notNull(),
    publishedAt: timestamp("published_at"),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 300 }),
    ogImageKey: varchar("og_image_key", { length: 500 }),
  },
  (table) => [
    index("projects_category_idx").on(table.category),
    index("projects_slug_idx").on(table.slug),
  ]
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    type: mediaTypeEnum("type").notNull(),
    provider: mediaProviderEnum("provider").default("r2").notNull(),
    /** R2 object key (images + custom posters) or Cloudflare Stream UID (videos). */
    providerAssetId: varchar("provider_asset_id", { length: 500 }),
    /** Legacy/original R2 key; null for Stream-backed videos. */
    storageKey: varchar("storage_key", { length: 500 }),
    variants: text("variants"),
    altText: varchar("alt_text", { length: 300 }),
    sortOrder: integer("sort_order").default(0),
    fileSizeBytes: integer("file_size_bytes"),
    width: integer("width"),
    height: integer("height"),
    status: mediaStatusEnum("status").default("processing").notNull(),
    lqipDataUrl: text("lqip_data_url"),
    posterKey: varchar("poster_key", { length: 500 }),
    customPosterKey: varchar("custom_poster_key", { length: 500 }),
    title: varchar("title", { length: 200 }),
    description: text("description"),
    durationSeconds: integer("duration_seconds"),
    aspectRatio: varchar("aspect_ratio", { length: 20 }),
    previewEnabled: boolean("preview_enabled").default(false).notNull(),
    previewStartSeconds: integer("preview_start_seconds").default(0).notNull(),
    previewDurationSeconds: integer("preview_duration_seconds").default(4).notNull(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 300 }),
    publishedAt: timestamp("published_at"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: uuid("deleted_by"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("media_project_id_idx").on(table.projectId),
    index("media_provider_asset_id_idx").on(table.providerAssetId),
    index("media_status_idx").on(table.status),
  ]
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type ProjectCategory = (typeof categoryEnum.enumValues)[number];
