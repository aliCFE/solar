"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import AdminStatsBar from "@/components/AdminStatsBar";
import type { DiscoveredCompanyDTO } from "@/types";
import { DISCOVERED_STATUSES, DISCOVERED_STATUS_LABELS_AR, type DiscoveredStatus } from "@/lib/discoveredCompanyStatus";
import type { AdminStats } from "@/lib/adminStats";

interface Props {
  initialCompanies: DiscoveredCompanyDTO[];
  stats: AdminStats;
}

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

export default function AdminDiscoveredClient({ initialCompanies, stats }: Props) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [filter, setFilter] = useState<DiscoveredStatus | "all">("new");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", website: "", city: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearchNow() {
    setSearching(true);
    setSearchMessage(null);
    setSearchError(null);
    try {
      const res = await fetch("/api/admin/discovered/search", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل البحث");
      setCompanies((cs) => [...data.companies, ...cs]);
      setSearchMessage(
        data.added > 0
          ? `تمت إضافة ${data.added} شركة جديدة${data.skipped > 0 ? ` (تجاهلنا ${data.skipped} مكررة)` : ""}.`
          : "ما لكينا شركات جديدة هالمرة — جرب تضغط مرة ثانية بعد شوية، البحث يتنوع بكل مرة."
      );
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "فشل البحث");
    } finally {
      setSearching(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("اسم الشركة مطلوب");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "manual" }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "فشل الإضافة");
      setCompanies((cs) => [created, ...cs]);
      setForm({ name: "", phone: "", website: "", city: "", notes: "" });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setSaving(false);
    }
  }

  async function updateCompany(id: string, data: Partial<DiscoveredCompanyDTO>) {
    const res = await fetch(`/api/admin/discovered/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذا المرشح نهائياً؟")) return;
    const res = await fetch(`/api/admin/discovered/${id}`, { method: "DELETE" });
    if (res.ok) setCompanies((cs) => cs.filter((c) => c.id !== id));
  }

  const visible = filter === "all" ? companies : companies.filter((c) => c.status === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">الشركات المكتشفة</h1>
        <button onClick={handleLogout} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
          تسجيل خروج
        </button>
      </div>

      <AdminNav />
      <AdminStatsBar stats={stats} currentPath="/admin/discovered" />

      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-xs text-[var(--color-text-muted)]">
        قائمة خاصة بيك بس — مرشحين للتواصل معهم، مو شركات مسجلة بعد. لما تتفقون، الشركة تسجل حساب حقيقي من <code>/register</code> بنفسها، وبعدين تحدّث الحالة هنا لـ&quot;انضمت&quot;.
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <button
          onClick={handleSearchNow}
          disabled={searching}
          className="whitespace-nowrap rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
        >
          {searching ? "جاري البحث..." : "🔍 ابحث عن شركات جديدة"}
        </button>
        <div className="text-xs text-[var(--color-text-muted)]">
          {searchMessage && <span className="text-[var(--color-accent-2)]">{searchMessage}</span>}
          {searchError && <span className="text-[var(--color-danger)]">{searchError}</span>}
          {!searchMessage && !searchError &&
            "يبحث بالانترنت ويستخرج شركات طاقة شمسية عراقية حقيقية تلقائياً (يحتاج SERPER_API_KEY ومفتاح AI (Kimi أو Anthropic) بـ.env.local)"}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...DISCOVERED_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s
                ? "bg-[var(--color-accent)] font-semibold text-[#1a1200]"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {s === "all" ? "الكل" : DISCOVERED_STATUS_LABELS_AR[s]}
            {s !== "all" && <span className="mr-1">({companies.filter((c) => c.status === s).length})</span>}
          </button>
        ))}
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="mr-auto rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1200]"
        >
          + إضافة يدوياً
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} placeholder="اسم الشركة *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={inputClass} placeholder="المدينة" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <input className={inputClass} placeholder="رقم الهاتف" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <input className={inputClass} placeholder="الموقع الإلكتروني" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          </div>
          <textarea className={inputClass + " w-full"} rows={2} placeholder="ملاحظات..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1200] disabled:opacity-60">
              {saving ? "..." : "حفظ"}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {visible.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">لا يوجد مرشحين بهذه الحالة.</p>}

      <div className="space-y-3">
        {visible.map((c) => (
          <div key={c.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {c.city && `${c.city} · `}
                  {c.phone && <span dir="ltr">{c.phone} · </span>}
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
                      {c.website}
                    </a>
                  )}
                </div>
              </div>
              <select
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-sm"
                value={c.status}
                onChange={(e) => updateCompany(c.id, { status: e.target.value as DiscoveredStatus })}
              >
                {DISCOVERED_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DISCOVERED_STATUS_LABELS_AR[s]}
                  </option>
                ))}
              </select>
            </div>

            {c.notes && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{c.notes}</p>}

            <div className="mt-3 flex items-center gap-2">
              <input
                className={inputClass + " flex-1"}
                placeholder="ملاحظة متابعة..."
                defaultValue={c.notes ?? ""}
                onBlur={(e) => updateCompany(c.id, { notes: e.target.value })}
              />
              <button onClick={() => handleDelete(c.id)} className="text-xs text-[var(--color-danger)] hover:brightness-125">
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
