"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import type { MediaView } from "@/lib/media";
import { StatusBadge, TrashButton } from "./video-manager";

/**
 * One video row in the CMS: poster thumb, lifecycle status, and a collapsible
 * editor for title/description, poster choice, preview settings, SEO fields
 * and alt text. Deliberately minimal — extends, not redesigns, the admin UI.
 */
export function VideoMediaItem({
  item,
  onPatched,
  onDelete,
  deleting,
}: {
  item: MediaView;
  onPatched: (m: MediaView) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [altText, setAltText] = useState(item.altText ?? "");
  const [previewEnabled, setPreviewEnabled] = useState(item.previewEnabled);
  const [previewStart, setPreviewStart] = useState(String(item.previewStartSeconds));
  const [previewDuration, setPreviewDuration] = useState(String(item.previewDurationSeconds));
  const [seoTitle, setSeoTitle] = useState(item.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(item.seoDescription ?? "");

  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = true;
  }, [title, description, altText, previewEnabled, previewStart, previewDuration, seoTitle, seoDescription]);

  const posterSrc =
    item.customPosterUrl ?? item.posterUrl ?? item.streamThumbnailUrl ?? null;

  // MVP manual Stream mode: the admin decides when the video is playable.
  const publishBlocked = item.status === "uploading" || item.status === "processing";
  const showMarkReady = item.status === "processing" || item.status === "uploading" || item.status === "failed";
  const showHideToggle =
    item.status === "ready" || item.status === "published" || item.status === "unpublished";

  async function setStatus(next: "ready" | "failed" | "unpublished") {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Status update failed");
      }
      const data = (await res.json()) as { media: MediaView };
      onPatched(data.media);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          description: description || undefined,
          altText: altText || undefined,
          previewEnabled,
          previewStartSeconds: Number(previewStart) || 0,
          previewDurationSeconds: Number(previewDuration) || 4,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      const data = (await res.json()) as { media: MediaView };
      onPatched(data.media);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded border border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3 p-2">
        <div className="relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-900">
          {posterSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterSrc} alt="" className="h-full w-full object-cover" />
          ) : item.status === "processing" || item.status === "uploading" ? (
            <Loader2 size={16} className="animate-spin text-zinc-600" />
          ) : (
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">No poster</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-200">
            {item.title ?? "Untitled video"}
          </p>
          <StatusBadge status={item.status} />
          {item.providerAssetId ? (
            <p className="truncate font-mono text-[10px] text-zinc-600" title={item.providerAssetId}>
              UID {item.providerAssetId}
            </p>
          ) : null}
          {publishBlocked ? (
            <p className="text-[11px] text-amber-400/80">
              Mark it READY below once Cloudflare shows the video as ready.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle video settings"
          className="rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <TrashButton onClick={() => onDelete(item.id)} deleting={deleting} />
      </div>

      {open ? (
        <div className="space-y-3 border-t border-zinc-800 p-3">
          {error ? (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 p-3">
            <p className="w-full text-[11px] uppercase tracking-wide text-zinc-500">
              Manual video state
            </p>
            {showMarkReady ? (
              <>
                <button
                  type="button"
                  onClick={() => setStatus("ready")}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded bg-green-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Mark READY (visible on site)
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("failed")}
                  disabled={saving}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                >
                  Mark failed
                </button>
              </>
            ) : null}
            {showHideToggle ? (
              <button
                type="button"
                onClick={() => setStatus("unpublished")}
                disabled={saving}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                Hide from site
              </button>
            ) : null}
            {item.status === "unpublished" ? (
              <button
                type="button"
                onClick={() => setStatus("ready")}
                disabled={saving}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                Show again
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              Video title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Alt / accessibility text
              <input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
              />
            </label>
          </div>

          <label className="block text-xs text-zinc-400">
            Description
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
            />
          </label>

          <fieldset className="rounded border border-zinc-800 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-zinc-500">
              Motion preview
            </legend>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={previewEnabled}
                onChange={(e) => setPreviewEnabled(e.target.checked)}
                className="h-3.5 w-3.5 accent-zinc-100"
              />
              Show a short muted preview on hover (posters stay the default)
            </label>
            <div className="mt-2 flex gap-3">
              <label className="text-xs text-zinc-400">
                Start (s)
                <input
                  type="number"
                  min={0}
                  value={previewStart}
                  onChange={(e) => setPreviewStart(e.target.value)}
                  className="mt-1 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:border-zinc-500"
                />
              </label>
              <label className="text-xs text-zinc-400">
                Duration (s)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={previewDuration}
                  onChange={(e) => setPreviewDuration(e.target.value)}
                  className="mt-1 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:border-zinc-500"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rounded border border-zinc-800 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-zinc-500">
              SEO
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-zinc-400">
                SEO title
                <input
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
                />
              </label>
              <label className="block text-xs text-zinc-400">
                SEO description
                <input
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-zinc-500"
                />
              </label>
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirtyRef.current}
              className="rounded bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save video settings"}
            </button>
            {item.durationSeconds ? (
              <span className="text-xs text-zinc-600">
                {item.durationSeconds}s{item.width ? ` · ${item.width}×${item.height}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
