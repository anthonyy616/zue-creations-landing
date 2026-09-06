"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  SortableContext,
} from "@dnd-kit/sortable";
import type { Project } from "@/db/schema";
import ProjectForm from "./project-form";
import SortableProjectItem from "./sortable-project-item";
import { deleteProject } from "./actions";
import { updateProjectSortOrder } from "./projects-actions";

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
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setReorderingId(null);
      return;
    }

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      setReorderingId(null);
      return;
    }

    const reordered = arrayMove(projects, oldIndex, newIndex);
    setReorderingId(active.id as string);

    const result = await updateProjectSortOrder(reordered.map((p) => p.id));
    if (result.ok) {
      setProjects(reordered);
    } else {
      // Map known error types to user-friendly messages.
      const msg = result.error ?? "Could not save the new order";
      if (msg.includes("session expired") || msg.includes("log in")) {
        // Let the middleware handle the redirect; just show a brief message.
        setListError("Your session expired. Please log in again.");
      } else {
        setListError(msg);
      }
      setProjects(projects);
    }
    setReorderingId(null);
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="overflow-hidden rounded-lg border border-zinc-800">
              {projects.map((project) => (
                <SortableProjectItem
                  key={project.id}
                  project={project}
                  categoryLabels={CATEGORY_LABELS}
                  busyId={busyId}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
