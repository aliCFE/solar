"use client";

import { useState } from "react";
import type { MediaDTO } from "@/types";

interface Props {
  packageId: string;
  media: MediaDTO[];
  onChange: (media: MediaDTO[]) => void;
}

export default function PackageMediaManager({ packageId, media, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/packages/${packageId}/media`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الرفع");
      onChange([...media, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddVideo() {
    if (!videoUrl.trim()) return;
    setError(null);
    try {
      const formData = new FormData();
      formData.append("videoUrl", videoUrl.trim());
      const res = await fetch(`/api/packages/${packageId}/media`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإضافة");
      onChange([...media, data]);
      setVideoUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    }
  }

  async function handleDelete(mediaId: string) {
    const res = await fetch(`/api/packages/${packageId}/media/${mediaId}`, { method: "DELETE" });
    if (res.ok) onChange(media.filter((m) => m.id !== mediaId));
  }

  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video-url");

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">صور وفيديوهات المشروع</div>

      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((m) => (
            <div key={m.id} className="group relative">
              <img src={m.url} alt="" className="h-16 w-24 rounded-md border border-[var(--color-border)] object-cover" />
              <button
                onClick={() => handleDelete(m.id)}
                className="absolute -left-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-xs text-white group-hover:flex"
                aria-label="حذف"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <ul className="mb-2 space-y-1">
          {videos.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-xs">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="truncate text-[var(--color-accent)] underline">
                {m.url}
              </a>
              <button onClick={() => handleDelete(m.id)} className="mr-2 text-[var(--color-danger)]">
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-accent)]">
          {uploading ? "جاري الرفع..." : "+ رفع صورة"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
          />
        </label>
        <input
          className="flex-1 min-w-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs"
          placeholder="رابط فيديو YouTube أو Vimeo"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button onClick={handleAddVideo} className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-accent)]">
          إضافة
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
