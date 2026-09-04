"use client";

import { useState } from "react";
import Link from "next/link";
import slugify from "slugify";
import { format } from "date-fns";
import type { Project } from "@/db/schema";
import {
  CATEGORIES,
  projectFormSchema,
  type ProjectFormValues,
} from "./schema";
import { createProject, updateProject } from "./actions";

const CATEGORY_LABELS: Record<string, string> = {
  photography: "Photography",
  cinematography: "Cinematography",
  branding: "Branding",
};

type ProjectFormProps = {
  /** Present in edit mode; omitted when creating. */
  project?: Project;
  backHref: string;
};

function toFormValues(project?: Project): ProjectFormValues {
  return {
    title: project?.title ?? "",
    slug: project?.slug ?? "",
    category: (project?.category as ProjectFormValues["category"]) ?? "photography",
    date: project ? format(project.date, "yyyy-MM-dd") : "",
    description: project?.description ?? "",
    location: project?.location ?? "",
    instagramUrl: project?.instagramUrl ?? "",
    featured: project?.featured ?? false,
    sortOrder: project?.sortOrder ?? 0,
  };
}

export default function ProjectForm({
  project,
  backHref,
}: ProjectFormProps) {
  // Server actions are imported here (client) and called with the form values;
  // create redirects to the new project's edit page on success.
  const submitAction = project
    ? (values: ProjectFormValues) => updateProject(project.id, values)
    : createProject;
  const [values, setValues] = useState<ProjectFormValues>(() =>
    toFormValues(project)
  );
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function setField<K extends keyof ProjectFormValues>(
    key: K,
    value: ProjectFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(title: string) {
    setField("title", title);
    if (!slugTouched) {
      setField(
        "slug",
        slugify(title, { lower: true, strict: true }).slice(0, 200)
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = projectFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please fix the form");
      return;
    }

    setPending(true);
    const result = await submitAction(parsed.data);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
    }
    // On success the server action either redirects (create) or the parent
    // refreshes the view (update), so there is nothing else to do here.
  }

  const inputClass =
    "w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500";
  const labelClass = "mb-1 block text-sm text-zinc-300";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelClass}>
            Title *
          </label>
          <input
            id="title"
            className={inputClass}
            value={values.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug *{" "}
            <span className="text-zinc-500">(/work/…)</span>
          </label>
          <input
            id="slug"
            className={inputClass}
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setField("slug", e.target.value.toLowerCase());
            }}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>
            Category *
          </label>
          <select
            id="category"
            className={inputClass}
            value={values.category}
            onChange={(e) =>
              setField("category", e.target.value as ProjectFormValues["category"])
            }
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-zinc-900">
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>
            Date *
          </label>
          <input
            id="date"
            type="date"
            className={inputClass}
            value={values.date}
            onChange={(e) => setField("date", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          rows={5}
          className={inputClass}
          value={values.description ?? ""}
          onChange={(e) => setField("description", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className={labelClass}>
            Location
          </label>
          <input
            id="location"
            className={inputClass}
            value={values.location ?? ""}
            onChange={(e) => setField("location", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="instagramUrl" className={labelClass}>
            Instagram URL
          </label>
          <input
            id="instagramUrl"
            type="url"
            placeholder="https://instagram.com/…"
            className={inputClass}
            value={values.instagramUrl ?? ""}
            onChange={(e) => setField("instagramUrl", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={values.featured ?? false}
            onChange={(e) => setField("featured", e.target.checked)}
            className="h-4 w-4 accent-zinc-100"
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          Sort order
          <input
            type="number"
            className={`${inputClass} w-24`}
            value={values.sortOrder ?? 0}
            onChange={(e) => setField("sortOrder", Number(e.target.value))}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Saving…" : project ? "Save changes" : "Create project"}
        </button>
        <Link
          href={backHref}
          className="px-2 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
