import { z } from "zod";

// Keep in sync with the Postgres enum in db/schema.ts.
export const CATEGORIES = ["photography", "cinematography", "branding"] as const;
export type Category = (typeof CATEGORIES)[number];

export const projectFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(200, "Slug must be 200 characters or fewer")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may only contain lowercase letters, numbers, and dashes"
    ),
  category: z.enum(CATEGORIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  description: z.string().trim().max(20000).optional(),
  location: z.string().trim().max(200).optional(),
  instagramUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine(
      (v) => !v || v.startsWith("http://") || v.startsWith("https://"),
      "Instagram URL must start with http:// or https://"
    ),
  featured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };
