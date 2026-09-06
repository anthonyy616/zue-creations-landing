"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { format } from "date-fns";
import type { Project } from "@/db/schema";

interface SortableProjectItemProps {
  project: Project;
  categoryLabels: Record<string, string>;
  busyId: string | null;
  reorderingId: string | null;
  onDelete: (id: string, title: string) => void;
}

export default function SortableProjectItem({
  project,
  categoryLabels,
  busyId,
  reorderingId,
  onDelete,
}: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3 last:border-b-0 ${
        isDragging ? "z-10 opacity-70" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none p-1 text-zinc-600 hover:text-zinc-300 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="text-lg leading-none">⠿</span>
      </button>
      <Link
        href={`/admin/projects/${project.id}`}
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-sm font-medium text-white">
          {project.title}
        </span>
        <span className="block text-xs uppercase tracking-wide text-zinc-500">
          {categoryLabels[project.category]} ·{" "}
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
          onClick={() => onDelete(project.id, project.title)}
          disabled={busyId === project.id}
          className="rounded border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          {busyId === project.id ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
