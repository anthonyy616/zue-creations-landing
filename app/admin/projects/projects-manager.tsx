"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { Project } from "@/db/schema";
import ProjectForm from "./project-form";
import { deleteProject } from "./actions";

const CATEGORY_LABELS: Record<string, string> = {
  photography: "Photography",
  cinematography: "Cinematography",
  branding: "Branding",
};

export default function ProjectsManager({
  initialProjects,
}: {
  initialProjects: Project[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusyId(id);
    setListError(null);
    const result = await deleteProject(id);
    if (!result.ok) {
      setListError(result.error);
      setBusyId(null);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
          >
            New project
          </button>
        ) : null}
      </div>

      {listError ? (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {listError}
        </p>
      ) : null}

      {creating ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-medium text-white">New project</h2>
          <ProjectForm backHref="/admin/projects" />
        </section>
      ) : null}

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
          No projects yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-zinc-800">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 last:border-b-0"
            >
              <Link
                href={`/admin/projects/${project.id}`}
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm font-medium text-white">
                  {project.title}
                </span>
                <span className="block text-xs uppercase tracking-wide text-zinc-500">
                  {CATEGORY_LABELS[project.category]} ·{" "}
                  {format(project.date, "yyyy")}
                  {project.featured ? " · Featured" : ""}
                </span>
              </Link>
              <span className="hidden text-xs text-zinc-600 sm:block">
                /work/{project.slug}
              </span>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(project.id, project.title)}
                  disabled={busyId === project.id}
                  className="rounded border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {busyId === project.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
