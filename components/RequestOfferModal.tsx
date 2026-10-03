"use client";

import { useState } from "react";
import type { AssessmentResult } from "@/types";

interface Props {
  companyId: string;
  companyName: string;
  packageId?: string;
  packageTitle?: string;
  requirement?: AssessmentResult;
  triggerLabel?: string;
  triggerClassName?: string;
}

export default function RequestOfferModal({
  companyId,
  companyName,
  packageId,
  packageTitle,
  requirement,
  triggerLabel = "اطلب هذا العرض عبر المنصة",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState(requirement?.input.locationLabel ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          packageId,
          customerName: name,
          customerPhone: phone,
          customerCity: city || undefined,
          assessmentSnapshot: requirement,
          roofPlanUrl: requirement?.input.roofPlanUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الطلب");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#1a1200] hover:brightness-110"
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <p className="font-semibold text-[var(--color-accent-2)]">تم إرسال طلبك</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  فريق المنصة راح يتواصل وياك قريباً ويرتب التفاصيل مع {companyName} نيابة عنك.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200]"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <h3 className="font-bold">طلب عرض من {companyName}</h3>
                  {packageTitle && <p className="text-sm text-[var(--color-text-muted)]">{packageTitle}</p>}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    ما ننطي رقمك للشركة مباشرة — فريقنا يتواصل وياك أول ويربطكم حسب الحاجة.
                  </p>
                </div>
                <input
                  required
                  placeholder="اسمك"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  required
                  placeholder="رقم هاتفك"
                  dir="ltr"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  placeholder="مدينتك (اختياري)"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] disabled:opacity-60"
                  >
                    {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-muted)]"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
