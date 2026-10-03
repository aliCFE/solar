"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PackageForm from "@/components/PackageForm";
import PackageMediaManager from "@/components/PackageMediaManager";
import type { CompanyProfile, MediaDTO, PackageDTO } from "@/types";
import { COMPANY_STATUS_LABELS_AR, type CompanyStatus } from "@/lib/companyStatus";

interface LeadStats {
  total: number;
  new: number;
  won: number;
}

interface Props {
  company: CompanyProfile;
  initialPackages: PackageDTO[];
  leadStats: LeadStats;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const labelClass = "mb-1 block text-sm text-[var(--color-text-muted)]";

export default function DashboardClient({ company, initialPackages, leadStats }: Props) {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageDTO[]>(initialPackages);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    phone: company.phone ?? "",
    city: company.city ?? "",
    website: company.website ?? "",
    description: company.description ?? "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  async function handleLogout() {
    await fetch("/api/companies/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await fetch("/api/companies/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setProfileSaved(true);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleCreate(data: Record<string, unknown>) {
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const created = await res.json();
    if (!res.ok) throw new Error(created.error || "فشل الإنشاء");
    setPackages((p) => [created, ...p]);
    setShowAddForm(false);
  }

  async function handleUpdate(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    if (!res.ok) throw new Error(updated.error || "فشل التحديث");
    setPackages((p) => p.map((pkg) => (pkg.id === id ? updated : pkg)));
    setEditingId(null);
  }

  async function handleToggleActive(pkg: PackageDTO) {
    const res = await fetch(`/api/packages/${pkg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !pkg.isActive }),
    });
    const updated = await res.json();
    if (res.ok) setPackages((p) => p.map((x) => (x.id === pkg.id ? updated : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذه الباقة نهائياً؟")) return;
    const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
    if (res.ok) setPackages((p) => p.filter((pkg) => pkg.id !== id));
  }

  function handleMediaChange(packageId: string, media: MediaDTO[]) {
    setPackages((p) => p.map((pkg) => (pkg.id === packageId ? { ...pkg, media } : pkg)));
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">لوحة تحكم {company.name}</h1>
          <a href={`/companies/${company.slug}`} className="text-sm text-[var(--color-accent)] underline">
            عرض صفحتك العامة
          </a>
        </div>
        <button onClick={handleLogout} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
          تسجيل خروج
        </button>
      </div>

      {company.status !== "approved" && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            company.status === "rejected"
              ? "border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
              : "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          }`}
        >
          حالة الحساب: {COMPANY_STATUS_LABELS_AR[company.status as CompanyStatus]}
          {company.status === "pending" && " — باقاتك ما راح تظهر بدليل الشركات العام لين توافق الإدارة عليك."}
          {company.status === "rejected" && " — تواصل مع إدارة المنصة لمعرفة السبب."}
        </div>
      )}

      {leadStats.total > 0 && (
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
            <div className="text-2xl font-bold">{leadStats.total}</div>
            <div className="text-xs text-[var(--color-text-muted)]">إجمالي طلبات العرض</div>
          </div>
          <div
            className={`rounded-lg border p-3 text-center ${
              leadStats.new > 0 ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-border)] bg-[var(--color-surface)]"
            }`}
          >
            <div className={`text-2xl font-bold ${leadStats.new > 0 ? "text-[var(--color-accent)]" : ""}`}>{leadStats.new}</div>
            <div className="text-xs text-[var(--color-text-muted)]">طلبات جديدة</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center">
            <div className="text-2xl font-bold text-[var(--color-accent-2)]">{leadStats.won}</div>
            <div className="text-xs text-[var(--color-text-muted)]">صفقات ناجحة</div>
          </div>
        </section>
      )}
      {leadStats.new > 0 && (
        <p className="-mt-3 text-xs text-[var(--color-text-muted)]">
          عندك {leadStats.new} طلب عرض جديد على باقاتك — فريق المنصة راح يتواصل وياك قريباً لتنسيق التفاصيل مع الزبون.
        </p>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-4 text-lg font-bold">بيانات الشركة</h2>
        <form onSubmit={handleProfileSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>رقم الهاتف</label>
              <input className={inputClass} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>المدينة</label>
              <input className={inputClass} value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>الموقع الإلكتروني</label>
            <input className={inputClass} value={profile.website} onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>نبذة عن الشركة</label>
            <textarea className={inputClass} rows={3} value={profile.description} onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
            >
              {profileSaving ? "جاري الحفظ..." : "حفظ البيانات"}
            </button>
            {profileSaved && <span className="text-sm text-[var(--color-accent-2)]">تم الحفظ</span>}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">باقاتك ({packages.length})</h2>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1200]"
            >
              + إضافة باقة
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="mb-4">
            <PackageForm onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
          </div>
        )}

        <div className="space-y-3">
          {packages.length === 0 && !showAddForm && (
            <p className="text-sm text-[var(--color-text-muted)]">ما عندك باقات بعد. أضف أول باقة عشان الزباين يشوفون عروضك.</p>
          )}
          {packages.length > 0 && packages.every((p) => p.media.length === 0) && (
            <p className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-2 text-xs text-[var(--color-accent)]">
              نصيحة: الباقات اللي فيها صور أو فيديو تحصل ثقة أكثر من الزباين. أضف صور من قسم "صور وفيديوهات المشروع" داخل أي باقة بالأسفل.
            </p>
          )}
          {packages.map((pkg) =>
            editingId === pkg.id ? (
              <PackageForm
                key={pkg.id}
                initial={pkg}
                onSubmit={(data) => handleUpdate(pkg.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div key={pkg.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {pkg.title}{" "}
                      {!pkg.isActive && (
                        <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                          غير منشورة
                        </span>
                      )}
                    </div>
                    {pkg.priceUSD && <div className="text-sm text-[var(--color-accent-2)]">${pkg.priceUSD.toLocaleString()}</div>}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setEditingId(pkg.id)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                      تعديل
                    </button>
                    <button onClick={() => handleToggleActive(pkg)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                      {pkg.isActive ? "إخفاء" : "نشر"}
                    </button>
                    <button onClick={() => handleDelete(pkg.id)} className="text-[var(--color-danger)] hover:brightness-125">
                      حذف
                    </button>
                  </div>
                </div>
                {pkg.description && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{pkg.description}</p>}
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] sm:grid-cols-4">
                  {pkg.systemSizeKW && <div>النظام: {pkg.systemSizeKW} kW</div>}
                  {pkg.numberOfPanels && <div>الألواح: {pkg.numberOfPanels} × {pkg.panelWattage ?? "؟"}W</div>}
                  {pkg.inverterSizeKW && <div>الانفيرتر: {pkg.inverterSizeKW} kW</div>}
                  {pkg.batteryCapacityKWh && <div>البطارية: {pkg.batteryCapacityKWh} kWh</div>}
                </div>
                <PackageMediaManager
                  packageId={pkg.id}
                  media={pkg.media}
                  onChange={(media) => handleMediaChange(pkg.id, media)}
                />
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}
