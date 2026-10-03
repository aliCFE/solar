"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const labelClass = "mb-1 block text-sm text-[var(--color-text-muted)]";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
    description: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التسجيل");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-xl font-bold">سجل شركتك بالمنصة</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div>
          <label className={labelClass}>اسم الشركة</label>
          <input className={inputClass} required value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>البريد الإلكتروني</label>
          <input type="email" className={inputClass} required value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>كلمة المرور (8 أحرف على الأقل)</label>
          <input type="password" className={inputClass} required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>رقم الهاتف</label>
            <input className={inputClass} value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>المدينة</label>
            <input className={inputClass} value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>الموقع الإلكتروني (اختياري)</label>
          <input className={inputClass} placeholder="https://" value={form.website} onChange={(e) => update("website", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>نبذة عن الشركة</label>
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
        </div>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "جاري التسجيل..." : "إنشاء الحساب"}
        </button>

        <p className="text-center text-sm text-[var(--color-text-muted)]">
          عندك حساب؟{" "}
          <a href="/login" className="text-[var(--color-accent)] underline">
            سجل دخول
          </a>
        </p>
      </form>
    </main>
  );
}
