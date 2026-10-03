interface Props {
  media: { id: string; type: string; url: string; caption: string | null }[];
}

function toEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

export default function PackageMediaGallery({ media }: Props) {
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video-url");

  if (images.length === 0 && videos.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((m) => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={m.url}
                alt={m.caption ?? ""}
                className="h-28 w-40 rounded-lg border border-[var(--color-border)] object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {videos.map((m) => {
        const embed = toEmbedUrl(m.url);
        return embed ? (
          <div key={m.id} className="aspect-video w-full max-w-md overflow-hidden rounded-lg border border-[var(--color-border)]">
            <iframe
              src={embed}
              title={m.caption ?? "فيديو المشروع"}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        ) : (
          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] underline">
            {m.caption ?? "مشاهدة الفيديو"}
          </a>
        );
      })}
    </div>
  );
}
