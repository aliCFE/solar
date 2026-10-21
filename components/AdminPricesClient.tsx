"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";

interface PriceDTO {
  id: string;
  category: "panel" | "battery" | "inverter";
  brand: string | null;
  model: string | null;
  specValue: number;
  priceUSD: number;
  includesInstallation: boolean;
  source: string;
  sourceDate: string;
  city: string | null;
  isActive: boolean;
  notes: string | null;
}

interface Props {
  initialPrices: PriceDTO[];
}

const CATEGORY_LABELS_AR: Record<PriceDTO["category"], string> = {
  panel: "لوح شمسي",
  battery: "بطارية",
  inverter: "انفيرتر",
};

const SPEC_UNIT: Record<PriceDTO["category"], string> = {
  panel: "واط",
  battery: "kWh",
  inverter: "kW",
};

const inputClass =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

const emptyForm = {
  category: "panel" as PriceDTO["category"],
  brand: "",
  model: "",
  specValue: "",
  priceUSD: "",
  includesInstallation: false,
  source: "",
  sourceDate: new Date().toISOString().slice(0, 10),
  city: "",
  notes: "",
};

export default function AdminPricesClient({ initialPrices }: Props) {
  const router = useRouter();
  const [prices, setPrices] = useState(initialPrices);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const specValue = Number(form.specValue);
    const priceUSD = Number(form.priceUSD);
    if (!specValue || specValue <= 0) return setError("أدخل مواصفة صحيحة");
    if (!priceUSD || priceUSD <= 0) return setError("أدخل سعر صحيح");
    if (!form.source.trim()) return setError("اذكر مصدر السعر (اسم المورد، رابط، أو عرض شركة)");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          brand: form.brand || undefined,
          model: form.model || undefined,
          specValue,
          priceUSD,
          includesInstallation: form.includesInstallation,
          source: form.source,
          sourceDate: form.sourceDate,
          city: form.city || undefined,
          notes: form.notes || undefined,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || "فشلت الإضافة");
      setPrices((p) => [{ ...created, sourceDate: String(created.sourceDate).slice(0, 10) }, ...p]);
      setForm(emptyForm);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت الإضافة");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(price: PriceDTO) {
    const res = await fetch(`/api/admin/product-prices/${price.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !price.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPrices((p) => p.map((x) => (x.id === price.id ? { ...x, isActive: updated.isActive } : x)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذا السعر نهائياً؟")) return;
    const res = await fetch(`/api/admin/product-prices/${id}`, { method: "DELETE" });
    if (res.ok) setPrices((p) => p.filter((x) => x.id !== id));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">أسعار المكونات</h1>
        <button onClick={handleLogout} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
          تسجيل خروج
        </button>
      </div>

      <AdminNav />

      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        أسعار حقيقية موثّقة (من عرض شركة، مورد محلي، أو مصدر تتحقق منه) — المحرك يستخدمها بدل التقدير العام لما تكون قريبة من حجم احتياج الزبون. لا تضيف رقم ما تعرف مصدره.
      </p>

      <div className="mb-4">
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[#1a1200] hover:brightness-110"
        >
          {showAddForm ? "إلغاء" : "+ إضافة سعر"}
        </button>

        {showAddForm && (
          <form onSubmit={handleAdd} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2">
            <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PriceDTO["category"] })}>
              <option value="panel">لوح شمسي</option>
              <option value="battery">بطارية</option>
              <option value="inverter">انفيرتر</option>
            </select>
            <input className={inputClass} placeholder={`المواصفة (${SPEC_UNIT[form.category]}) *`} value={form.specValue} onChange={(e) => setForm({ ...form, specValue: e.target.value })} />
            <input className={inputClass} placeholder="الماركة" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <input className={inputClass} placeholder="الموديل" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className={inputClass} placeholder="السعر بالدولار *" value={form.priceUSD} onChange={(e) => setForm({ ...form, priceUSD: e.target.value })} />
            <input className={inputClass} type="date" value={form.sourceDate} onChange={(e) => setForm({ ...form, sourceDate: e.target.value })} />
            <input className={inputClass} placeholder="المصدر (عرض شركة، مورد، رابط) *" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <input className={inputClass} placeholder="المدينة" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <input type="checkbox" checked={form.includesInstallation} onChange={(e) => setForm({ ...form, includesInstallation: e.target.checked })} />
              يشمل التركيب
            </label>
            <textarea className={`${inputClass} sm:col-span-2`} placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            {error && <p className="text-sm text-[var(--color-danger)] sm:col-span-2">{error}</p>}
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60 sm:col-span-2">
              {saving ? "جاري الحفظ..." : "حفظ السعر"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        {prices.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">ما فيه أسعار مسجلة بعد.</p>}
        {prices.map((p) => (
          <div key={p.id} className={`rounded-lg border p-3 text-sm ${p.isActive ? "border-[var(--color-border)] bg-[var(--color-surface)]" : "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-semibold">{CATEGORY_LABELS_AR[p.category]}</span>{" "}
                {p.brand && <span>{p.brand}</span>} {p.model && <span>{p.model}</span>}{" "}
                <span className="text-[var(--color-text-muted)]">
                  ({p.specValue} {SPEC_UNIT[p.category]})
                </span>
              </div>
              <div className="font-bold text-[var(--color-accent-2)]">${p.priceUSD.toLocaleString()}</div>
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              المصدر: {p.source} · {p.sourceDate}
              {p.city && ` · ${p.city}`}
              {p.includesInstallation && " · شامل التركيب"}
              {!p.isActive && " · معطّل"}
            </div>
            {p.notes && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{p.notes}</p>}
            <div className="mt-2 flex gap-3 text-xs">
              <button onClick={() => toggleActive(p)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                {p.isActive ? "تعطيل" : "تفعيل"}
              </button>
              <button onClick={() => handleDelete(p.id)} className="text-[var(--color-danger)] hover:brightness-125">
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
