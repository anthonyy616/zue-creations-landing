"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Trash2, UploadCloud } from "lucide-react";
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
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MediaView } from "@/lib/media";
import { reorderMedia } from "./media-actions";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

type Status = { fileName: string; progress: number } | null;

function SortableMediaItem({
  item,
  onDelete,
  deleting,
}: {
  item: MediaView;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-2 ${
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
        <GripVertical size={16} />
      </button>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-900">
        {item.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.altText ?? ""} className="h-full w-full object-cover" />
        ) : (
          <video src={item.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs uppercase tracking-wide text-zinc-400">
          {item.type}
        </p>
        {item.width && item.height ? (
          <p className="text-xs text-zinc-600">
            {item.width}×{item.height}
            {item.fileSizeBytes
              ? ` · ${Math.round(item.fileSizeBytes / 1024 / 1024)} MB`
              : ""}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        disabled={deleting}
        aria-label="Delete media"
        className="rounded p-2 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

export default function MediaManager({
  projectId,
  initialMedia,
}: {
  projectId: string;
  initialMedia: MediaView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialMedia);
  const [status, setStatus] = useState<Status>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Stable reference so the XHR progress handler can read the latest status.
  const statusRef = useRef(status);
  statusRef.current = status;

  const presign = useCallback(
    async (file: File) => {
      const res = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.push("/admin/login");
          throw new Error("Session expired — please log in again");
        }
        throw new Error(data.error ?? `Presign failed (${res.status})`);
      }
      return res.json() as Promise<{ uploadUrl: string; key: string }>;
    },
    [router]
  );

  const confirm = useCallback(
    async (
      file: File,
      key: string
    ): Promise<MediaView> => {
      const res = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          key,
          type: file.type.startsWith("video") ? "video" : "image",
          fileSizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to record upload");
      }
      const data = (await res.json()) as { media: MediaView };
      return data.media;
    },
    [projectId]
  );

  const putToR2 = useCallback((file: File, uploadUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && statusRef) {
          const pct = Math.round((event.loaded / event.total) * 100);
          setStatus((prev) => (prev ? { ...prev, progress: pct } : prev));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });
  }, []);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} exceeds the 50 MB limit and was skipped.`);
        continue;
      }
      if (!/^(image|video)\//.test(file.type)) {
        setError(`${file.name} is not an image or video and was skipped.`);
        continue;
      }
      setStatus({ fileName: file.name, progress: 0 });
      try {
        const { uploadUrl, key } = await presign(file);
        await putToR2(file, uploadUrl);
        const view = await confirm(file, key);
        setItems((prev) => [...prev, view]);
        setStatus(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatus(null);
      }
    }
  }

  async function handleDelete(id: string) {
    const item = items.find((m) => m.id === id);
    if (!item) return;
    if (!window.confirm("Delete this file? This also removes it from storage.")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    const result = await reorderMedia(
      projectId,
      reordered.map((m) => m.id)
    );
    if (!result.ok) {
      setError(result.error ?? "Could not save the new order");
      setItems(items); // revert
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Media</h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!status}
          className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
        >
          <UploadCloud size={16} /> Upload files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {status ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <p className="mb-2 truncate text-sm text-zinc-300">
            Uploading {status.fileName}…
          </p>
          <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-zinc-100 transition-[width]"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No media yet. Upload images or video snippets (up to 50 MB each).
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {items.map((item) => (
                <SortableMediaItem
                  key={item.id}
                  item={item}
                  onDelete={handleDelete}
                  deleting={deletingId === item.id}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
