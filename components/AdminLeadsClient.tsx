"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import AdminStatsBar from "@/components/AdminStatsBar";
import type { AssessmentResult, LeadDTO } from "@/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS_AR, type LeadStatus } from "@/lib/leadStatus";
import type { AdminStats } from "@/lib/adminStats";

interface Props {
  initialLeads: LeadDTO[];
  stats: AdminStats;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "text-[var(--color-accent)]",
  contacted: "text-[var(--color-text)]",
  quoted: "text-[var(--color-text-muted)]",
  won: "text-[var(--color-accent-2)]",
  lost: "text-[var(--color-danger)]",
};

function parseSnapshot(raw: string | null): AssessmentResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AssessmentResult;
  } catch {
    return null;
  }
}

export default function AdminLeadsClient({ initialLeads, stats }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<LeadStatus | "all">("new");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function updateLead(id: string, data: { status?: LeadStatus; commissionNote?: string }) {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...updated } : l)));
    }
  }

  const visible = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">طلبات الزباين</h1>
        <button onClick={handleLogout} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
          تسجيل خروج
        </button>
      </div>

      <AdminNav />
      <AdminStatsBar stats={stats} currentPath="/admin/leads" />

      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        هذي الطلبات ما تظهر لأي شركة — انت بس يلي تشوف بيانات الزبون، وتتواصل وياه ومع الشركة يدوياً حسب الاتفاق.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s
                ? "bg-[var(--color-accent)] font-semibold text-[#1a1200]"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {s === "all" ? "الكل" : LEAD_STATUS_LABELS_AR[s]}
            {s !== "all" && <span className="mr-1">({leads.filter((l) => l.status === s).length})</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">لا توجد طلبات بهذه الحالة.</p>}

      <div className="space-y-3">
        {visible.map((lead) => {
          const snapshot = parseSnapshot(lead.assessmentSnapshot);
          return (
            <div key={lead.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{lead.customerName}</div>
                  <div className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                    {lead.customerPhone}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {lead.customerCity && `${lead.customerCity} · `}
                    {new Date(lead.createdAt).toLocaleString("ar")}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${STATUS_COLORS[lead.status as LeadStatus]}`}>
                  {LEAD_STATUS_LABELS_AR[lead.status as LeadStatus]}
                </span>
              </div>

              <div className="mt-2 rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
                <div>
                  الشركة: <a href={`/companies/${lead.company.slug}`} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">{lead.company.name}</a>
                </div>
                {lead.package && (
                  <div>
                    الباقة: {lead.package.title} {lead.package.priceUSD && `— $${lead.package.priceUSD.toLocaleString()}`}
                  </div>
                )}
                {snapshot && (
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    احتياج الزبون: {snapshot.system.actualSystemSizeKW} kW · بطارية {snapshot.system.batteryCapacityKWh} kWh ·
                    تقدير ${snapshot.system.estimatedTotalCostUSD[0].toLocaleString()}–${snapshot.system.estimatedTotalCostUSD[1].toLocaleString()} · {snapshot.input.locationLabel}
                  </div>
                )}
                {lead.roofPlanUrl && (
                  <a href={lead.roofPlanUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-[var(--color-accent)] underline">
                    عرض مخطط البيت المرفوع
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm"
                  value={lead.status}
                  onChange={(e) => updateLead(lead.id, { status: e.target.value as LeadStatus })}
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS_AR[s]}
                    </option>
                  ))}
                </select>
                <input
                  className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm"
                  placeholder="ملاحظة العمولة / الاتفاق مع الشركة..."
                  value={noteDrafts[lead.id] ?? lead.commissionNote ?? ""}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [lead.id]: e.target.value }))}
                  onBlur={(e) => updateLead(lead.id, { commissionNote: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
