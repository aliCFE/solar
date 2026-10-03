"use client";

import { useState } from "react";
import type { PackageDTO } from "@/types";

interface Props {
  initial?: Partial<PackageDTO>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const labelClass = "mb-1 block text-xs text-[var(--color-text-muted)]";

function numOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export default function PackageForm({ initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    systemSizeKW: initial?.systemSizeKW?.toString() ?? "",
    panelBrand: initial?.panelBrand ?? "",
    panelWattage: initial?.panelWattage?.toString() ?? "",
    numberOfPanels: initial?.numberOfPanels?.toString() ?? "",
    inverterBrand: initial?.inverterBrand ?? "",
    inverterSizeKW: initial?.inverterSizeKW?.toString() ?? "",
    batteryBrand: initial?.batteryBrand ?? "",
    batteryType: initial?.batteryType ?? "",
    batteryCapacityKWh: initial?.batteryCapacityKWh?.toString() ?? "",
    priceUSD: initial?.priceUSD?.toString() ?? "",
    warrantyYears: initial?.warrantyYears?.toString() ?? "",
    installationIncluded: initial?.installationIncluded ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        systemSizeKW: numOrUndefined(form.systemSizeKW),
        panelBrand: form.panelBrand.trim() || undefined,
        panelWattage: numOrUndefined(form.panelWattage),
        numberOfPanels: numOrUndefined(form.numberOfPanels),
        inverterBrand: form.inverterBrand.trim() || undefined,
        inverterSizeKW: numOrUndefined(form.inverterSizeKW),
        batteryBrand: form.batteryBrand.trim() || undefined,
        batteryType: form.batteryType.trim() || undefined,
        batteryCapacityKWh: numOrUndefined(form.batteryCapacityKWh),
        priceUSD: numOrUndefined(form.priceUSD),
        warrantyYears: numOrUndefined(form.warrantyYears),
        installationIncluded: form.installationIncluded,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <div>
        <label className={labelClass}>عنوان الباقة *</label>
        <input className={inputClass} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="مثال: باقة منزلية 9kW" />
      </div>
      <div>
        <label className={labelClass}>الوصف</label>
        <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>حجم النظام (kW)</label>
          <input className={inputClass} value={form.systemSizeKW} onChange={(e) => update("systemSizeKW", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>عدد الألواح</label>
          <input className={inputClass} value={form.numberOfPanels} onChange={(e) => update("numberOfPanels", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>قدرة اللوح (واط)</label>
          <input className={inputClass} value={form.panelWattage} onChange={(e) => update("panelWattage", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ماركة الألواح</label>
          <input className={inputClass} value={form.panelBrand} onChange={(e) => update("panelBrand", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ماركة الانفيرتر</label>
          <input className={inputClass} value={form.inverterBrand} onChange={(e) => update("inverterBrand", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>حجم الانفيرتر (kW)</label>
          <input className={inputClass} value={form.inverterSizeKW} onChange={(e) => update("inverterSizeKW", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>ماركة البطارية</label>
          <input className={inputClass} value={form.batteryBrand} onChange={(e) => update("batteryBrand", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>نوع البطارية</label>
          <input className={inputClass} placeholder="ليثيوم / رصاص حمضي" value={form.batteryType} onChange={(e) => update("batteryType", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>سعة البطارية (kWh)</label>
          <input className={inputClass} value={form.batteryCapacityKWh} onChange={(e) => update("batteryCapacityKWh", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>السعر ($)</label>
          <input className={inputClass} value={form.priceUSD} onChange={(e) => update("priceUSD", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>الضمان (سنوات)</label>
          <input className={inputClass} value={form.warrantyYears} onChange={(e) => update("warrantyYears", e.target.value)} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            id="installationIncluded"
            checked={form.installationIncluded}
            onChange={(e) => update("installationIncluded", e.target.checked)}
          />
          <label htmlFor="installationIncluded" className="text-sm text-[var(--color-text-muted)]">
            التركيب شامل
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)]"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
