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

export const categoryEnum = pgEnum("category", [
  "photography",
  "cinematography",
  "branding",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);

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
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    variants: text("variants"),
    altText: varchar("alt_text", { length: 300 }),
    sortOrder: integer("sort_order").default(0),
    fileSizeBytes: integer("file_size_bytes"),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("media_project_id_idx").on(table.projectId)]
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
