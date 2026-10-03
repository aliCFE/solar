interface Props {
  percent: number;
  label: string;
}

export default function UploadProgressBar({ percent, label }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="mt-2 space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-accent)]">{label}</span>
        <span className="font-mono text-[var(--color-text-muted)] tabular-nums">{clamped}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
