import Link from "next/link";
import type { AdminStats } from "@/lib/adminStats";

interface Props {
  stats: AdminStats;
  currentPath: "/admin" | "/admin/leads" | "/admin/discovered";
}

export default function AdminStatsBar({ stats, currentPath }: Props) {
  const chips: { href: Props["currentPath"]; label: string; count: number }[] = [
    { href: "/admin", label: "شركات قيد المراجعة", count: stats.pendingCompanies },
    { href: "/admin/leads", label: "طلبات زباين جديدة", count: stats.newLeads },
    { href: "/admin/discovered", label: "شركات مكتشفة جديدة", count: stats.newDiscovered },
  ];

  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {chips.map((chip) => {
        const isCurrent = chip.href === currentPath;
        const needsAttention = chip.count > 0;
        return (
          <Link
            key={chip.href}
            href={chip.href}
            className={`rounded-lg border p-3 transition ${
              isCurrent
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                : needsAttention
                  ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 hover:border-[var(--color-danger)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]"
            }`}
          >
            <div
              className={`text-2xl font-bold ${needsAttention ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"}`}
            >
              {chip.count}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{chip.label}</div>
          </Link>
        );
      })}
    </div>
  );
}
