"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCompanyDTO } from "@/types";
import { COMPANY_STATUS_LABELS_AR, type CompanyStatus } from "@/lib/companyStatus";
import AdminNav from "@/components/AdminNav";
import AdminStatsBar from "@/components/AdminStatsBar";
import type { AdminStats } from "@/lib/adminStats";

interface Props {
  initialCompanies: AdminCompanyDTO[];
  stats: AdminStats;
}

const STATUS_COLORS: Record<CompanyStatus, string> = {
  pending: "text-[var(--color-accent)]",
  approved: "text-[var(--color-accent-2)]",
  rejected: "text-[var(--color-danger)]",
};

const FILTERS: { key: CompanyStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "موافق عليها" },
  { key: "rejected", label: "مرفوضة" },
];

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

const emptyForm = { name: "", email: "", password: "", phone: "", city: "", description: "", website: "" };

export default function AdminClient({ initialCompanies, stats }: Props) {
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [filter, setFilter] = useState<CompanyStatus | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return setAddError("اسم الشركة والبريد الإلكتروني مطلوبين");
    setSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: form.password || undefined }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "فشل إضافة الشركة");
      const { generatedPassword, ...companyDto } = created;
      setCompanies((cs) => [companyDto, ...cs]);
      setLastCreated({ email: companyDto.email, password: generatedPassword || form.password });
      setForm(emptyForm);
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "فشل إضافة الشركة");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: CompanyStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const visible = filter === "all" ? companies : companies.filter((c) => c.status === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">إدارة الشركات المسجلة</h1>
        <button onClick={handleLogout} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
          تسجيل خروج
        </button>
      </div>

      <AdminNav />
      <AdminStatsBar stats={stats} currentPath="/admin" />

      {lastCreated && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/10 p-3 text-sm text-[var(--color-accent-2)]">
          تمت إضافة الشركة — بيانات الدخول: <strong>{lastCreated.email}</strong> / <strong>{lastCreated.password}</strong> (احفظها وسلمها للشركة، ما راح تنعرض مرة ثانية).
          <button onClick={() => setLastCreated(null)} className="mr-3 underline">إخفاء</button>
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1200] hover:brightness-110"
        >
          {showAddForm ? "إلغاء" : "+ إضافة شركة"}
        </button>

        {showAddForm && (
          <form onSubmit={handleAdd} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2">
            <input className={inputClass} placeholder="اسم الشركة *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputClass} placeholder="البريد الإلكتروني *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={inputClass} placeholder="كلمة المرور (فاضي = توليد تلقائي)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input className={inputClass} placeholder="رقم الهاتف" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inputClass} placeholder="المدينة" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className={inputClass} placeholder="الموقع الإلكتروني" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <textarea className={`${inputClass} sm:col-span-2`} placeholder="نبذة عن الشركة" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            {addError && <p className="text-sm text-[var(--color-danger)] sm:col-span-2">{addError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60 sm:col-span-2"
            >
              {saving ? "جاري الإضافة..." : "إضافة الشركة"}
            </button>
          </form>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key
                ? "bg-[var(--color-accent)] text-[#1a1200] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="mr-1">({companies.filter((c) => c.status === f.key).length})</span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">لا توجد شركات بهذه الحالة.</p>}

      <div className="space-y-3">
        {visible.map((c) => (
          <div key={c.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {c.email} {c.city && `· ${c.city}`} · {c.packageCount} باقة · سجلت {new Date(c.createdAt).toLocaleDateString("ar")}
                </div>
              </div>
              <span className={`text-sm font-semibold ${STATUS_COLORS[c.status as CompanyStatus]}`}>
                {COMPANY_STATUS_LABELS_AR[c.status as CompanyStatus]}
              </span>
            </div>

            {c.description && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{c.description}</p>}

            <div className="mt-3 flex gap-2">
              <a href={`/companies/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] underline">
                عرض الصفحة العامة
              </a>
            </div>

            <div className="mt-3 flex gap-2">
              {c.status !== "approved" && (
                <button
                  onClick={() => updateStatus(c.id, "approved")}
                  disabled={busyId === c.id}
                  className="rounded-lg bg-[var(--color-accent-2)] px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
                >
                  موافقة
                </button>
              )}
              {c.status !== "rejected" && (
                <button
                  onClick={() => updateStatus(c.id, "rejected")}
                  disabled={busyId === c.id}
                  className="rounded-lg bg-[var(--color-danger)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  رفض
                </button>
              )}
              {c.status !== "pending" && (
                <button
                  onClick={() => updateStatus(c.id, "pending")}
                  disabled={busyId === c.id}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] disabled:opacity-60"
                >
                  إرجاع لقيد المراجعة
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
