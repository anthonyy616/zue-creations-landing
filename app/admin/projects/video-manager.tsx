"use client";

import { useState } from "react";
import { Film, Trash2, AlertTriangle, Plus, Loader2 } from "lucide-react";
import type { MediaView } from "@/lib/media";
import { VideoMediaItem } from "./video-media-item";

/**
 * CMS video management — MVP manual Stream mode.
 *
 * The admin uploads the video inside the Cloudflare Stream dashboard, copies
 * the video UID (or the shareable URL) and pastes it here. The app stores the
 * UID as providerAssetId and derives poster/preview/embed URLs from it. The
 * admin manually marks each video READY once Cloudflare shows it as ready.
 *
 * (Direct Creator Uploads + webhooks were removed for MVP; this component is
 * the only place to change when they return — the media architecture stays
 * provider-based.)
 */

export default function VideoManager({
  projectId,
  videos,
}: {
  projectId: string;
  videos: MediaView[];
}) {
  const [items, setItems] = useState<MediaView[]>(videos);
  const [pastedUid, setPastedUid] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = pastedUid.trim();
    if (!value) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/media/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, video: value }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        media?: MediaView;
        error?: string;
      };
      if (!res.ok || !data.media) {
        throw new Error(data.error ?? "Couldn't add the video.");
      }
      setItems((prev) => [...prev, data.media!]);
      setPastedUid("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the video.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this video? It will be hidden from the site immediately.")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function handlePatched(updated: MediaView) {
    setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-medium text-white">
        <Film size={18} /> Videos
      </h2>

      <form onSubmit={handleAdd} className="space-y-2">
        <label
          htmlFor="stream-uid"
          className="block text-xs text-zinc-400"
        >
          Add a video: upload it in the{" "}
          <a
            href="https://dash.cloudflare.com/?to=/:account/stream"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-zinc-200"
          >
            Cloudflare Stream dashboard
          </a>
          , then paste the video UID or its URL here.
        </label>
        <div className="flex gap-2">
          <input
            id="stream-uid"
            value={pastedUid}
            onChange={(e) => setPastedUid(e.target.value)}
            placeholder="e.g. 6c9bd7f81e6d_example_uid_32_chars_or_paste_url"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={adding || !pastedUid.trim()}
            className="flex shrink-0 items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add video
          </button>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No videos yet. Add a Stream video UID above — the poster, preview and
          player are derived from it automatically.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <VideoMediaItem
              key={item.id}
              item={item}
              onPatched={handlePatched}
              onDelete={handleDelete}
              deleting={deletingId === item.id}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: MediaView["status"] }) {
  const map: Record<MediaView["status"], { label: string; cls: string; spin?: boolean }> = {
    uploading: { label: "Uploading", cls: "text-zinc-400", spin: true },
    processing: { label: "Waiting for manual READY", cls: "text-amber-400", spin: true },
    ready: { label: "Ready", cls: "text-green-400" },
    published: { label: "Published", cls: "text-green-400" },
    failed: { label: "Marked failed", cls: "text-red-400" },
    unpublished: { label: "Hidden", cls: "text-zinc-500" },
    deleted: { label: "Deleted", cls: "text-zinc-600" },
  };
  const s = map[status] ?? map.ready;
  return (
    <p className={`flex items-center gap-1 text-xs ${s.cls}`}>
      {s.spin ? <Loader2 size={11} className="animate-spin" /> : null}
      {s.label}
    </p>
  );
}

export function TrashButton({
  onClick,
  deleting,
}: {
  onClick: () => void;
  deleting: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deleting}
      aria-label="Delete media"
      className="rounded p-2 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
    >
      <Trash2 size={16} />
    </button>
  );
}
