"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const labelClass = "mb-1 block text-sm text-[var(--color-text-muted)]";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تسجيل الدخول");
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
      <h1 className="mb-6 text-xl font-bold">تسجيل دخول الشركة</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div>
          <label className={labelClass}>البريد الإلكتروني</label>
          <input type="email" className={inputClass} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>كلمة المرور</label>
          <input type="password" className={inputClass} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "جاري الدخول..." : "دخول"}
        </button>

        <p className="text-center text-sm text-[var(--color-text-muted)]">
          ما عندك حساب؟{" "}
          <a href="/register" className="text-[var(--color-accent)] underline">
            سجل شركتك
          </a>
        </p>
      </form>
    </main>
  );
}
