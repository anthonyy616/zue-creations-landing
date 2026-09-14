"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Loader2,
  Film,
  Trash2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import * as tus from "tus-js-client";
import type { MediaView } from "@/lib/media";
import { VideoMediaItem } from "./video-media-item";

/**
 * CMS video upload + management. Videos upload directly from the browser to
 * Cloudflare Stream via a one-time TUS URL (resumable, so large files and
 * flaky connections survive). The app server never touches the video bytes.
 *
 * Lifecycle: SELECTED -> UPLOADING -> PROCESSING -> READY / FAILED.
 * Publish is blocked while a video is not READY/PUBLISHED (guards live in
 * the project actions).
 */

const MAX_VIDEO_BYTES = 30 * 1024 * 1024 * 1024; // Stream hard cap: 30 GB
const ALLOWED_TYPES = /^video\/(mp4|webm|quicktime|x-matroska|x-msvideo)$/;

type UploadState = {
  mediaId: string;
  fileName: string;
  progress: number;
  error?: string;
};

export default function VideoManager({
  projectId,
  videos,
}: {
  projectId: string;
  videos: MediaView[];
}) {
  const [items, setItems] = useState<MediaView[]>(videos);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tusUploadRef = useRef<tus.Upload | null>(null);

  // Poll processing states so the CMS updates without a manual refresh.
  const hasPending = items.some(
    (m) => m.status === "processing" || m.status === "uploading"
  );
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(async () => {
      const pendingIds = items
        .filter((m) => m.status === "processing" || m.status === "uploading")
        .map((m) => m.id);
      if (pendingIds.length === 0) return;
      try {
        const res = await fetch("/api/admin/media/video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaIds: pendingIds }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { media: MediaView[] };
        setItems((prev) =>
          prev.map((m) => data.media.find((u) => u.id === m.id) ?? m)
        );
      } catch {
        // Transient network error — next tick retries.
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [hasPending, items]);

  const requestUploadUrl = useCallback(
    async (file: File) => {
      const res = await fetch("/api/admin/media/video/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          fileSizeBytes: file.size,
          fileType: file.type || "video/mp4",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't start the upload.");
      }
      return (await res.json()) as {
        mediaId: string;
        streamUid: string;
        uploadUrl: string;
      };
    },
    [projectId]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const file = Array.from(files).find((f) => ALLOWED_TYPES.test(f.type));
      if (!file) {
        setError("Please choose a video file (MP4, WebM, MOV, MKV or AVI).");
        return;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError("That video is too large (limit is 30 GB).");
        return;
      }

      let session: { mediaId: string; streamUid: string; uploadUrl: string };
      try {
        session = await requestUploadUrl(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the upload.");
        return;
      }

      // Show the new item immediately in UPLOADING state.
      setItems((prev) => [
        ...prev,
        {
          id: session.mediaId,
          type: "video",
          provider: "cloudflare_stream",
          providerAssetId: session.streamUid,
          url: "",
          originalUrl: "",
          variantWidths: [],
          width: null,
          height: null,
          fileSizeBytes: file.size,
          altText: null,
          sortOrder: prev.length,
          status: "uploading",
          lqipDataUrl: null,
          posterUrl: null,
          title: file.name,
          description: null,
          durationSeconds: null,
          aspectRatio: null,
          previewEnabled: false,
          previewStartSeconds: 0,
          previewDurationSeconds: 4,
          seoTitle: null,
          seoDescription: null,
          publishedAt: null,
          customPosterUrl: null,
          streamThumbnailUrl: null,
          streamEmbedUrl: null,
        },
      ]);
      setUpload({ mediaId: session.mediaId, fileName: file.name, progress: 0 });

      // Upload directly to Cloudflare Stream with resumable TUS.
      const tusUpload = new tus.Upload(file, {
        uploadUrl: session.uploadUrl,
        endpoint: null as unknown as string, // uploadUrl provided; no creation endpoint
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 64 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type || "video/mp4",
        },
        onError: (err) => {
          setError(`Upload failed: ${err.message} You can retry or delete the video.`);
          setUpload((prev) => (prev ? { ...prev, error: err.message } : prev));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setUpload((prev) => (prev ? { ...prev, progress: pct } : prev));
        },
        onSuccess: async () => {
          setUpload(null);
          // Tell the backend the bytes are at Cloudflare — status -> PROCESSING.
          // READY arrives via the Stream webhook.
          try {
            const res = await fetch("/api/admin/media/video/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mediaId: session.mediaId,
                streamUid: session.streamUid,
              }),
            });
            if (res.ok) {
              const data = (await res.json()) as { media: MediaView };
              setItems((prev) =>
                prev.map((m) => (m.id === session.mediaId ? data.media : m))
              );
            } else {
              setError("Upload finished but the video state couldn't be updated. Refresh to sync.");
            }
          } catch {
            setError("Upload finished but the video state couldn't be updated. Refresh to sync.");
          }
        },
      });
      tusUploadRef.current = tusUpload;
      tusUpload.start();
    },
    [requestUploadUrl]
  );

  function cancelUpload() {
    tusUploadRef.current?.abort();
    tusUploadRef.current = null;
    setUpload(null);
    setError("Upload cancelled. You can retry it from the video list.");
  }

  async function retryUpload(id: string) {
    setError(null);
    const item = items.find((m) => m.id === id);
    if (!item) return;
    // Re-open a fresh upload session for the same media row is not possible
    // (one-time URLs); simplest safe path: delete the stuck row and upload again.
    await handleDelete(id);
    inputRef.current?.click();
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
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-medium text-white">
          <Film size={18} /> Videos
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!upload}
          className="flex items-center gap-2 rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
        >
          <UploadCloud size={16} /> Upload video
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      {upload ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-sm text-zinc-300">
              Uploading {upload.fileName}… {upload.progress}%
            </p>
            <button
              type="button"
              onClick={cancelUpload}
              className="text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-zinc-100 transition-[width]"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          {upload.error ? (
            <button
              type="button"
              onClick={() => retryUpload(upload.mediaId)}
              className="mt-2 flex items-center gap-1 text-xs text-amber-400 underline"
            >
              <RotateCcw size={11} /> Retry upload
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No videos yet. Uploads go directly to the video CDN — large files
          supported, resumable if your connection drops.
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
    processing: { label: "Processing video…", cls: "text-amber-400", spin: true },
    ready: { label: "Ready", cls: "text-green-400" },
    published: { label: "Published", cls: "text-green-400" },
    failed: { label: "Processing failed — retry or replace", cls: "text-red-400" },
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
