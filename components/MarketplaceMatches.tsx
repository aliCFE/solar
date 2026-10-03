"use client";

import { useEffect, useState } from "react";
import type { AssessmentResult } from "@/types";
import type { PackageMatch } from "@/lib/packageMatching";
import RequestOfferModal from "@/components/RequestOfferModal";
import PackageMediaGallery from "@/components/PackageMediaGallery";

interface Props {
  requirement: AssessmentResult;
}

export default function MarketplaceMatches({ requirement }: Props) {
  const [matches, setMatches] = useState<PackageMatch[] | null>(null);
  const [bestId, setBestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/packages/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requirement }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setMatches(data.matches);
        setBestId(data.bestId);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "فشل جلب العروض"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [requirement]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-muted)]">
        جاري البحث عن عروض من الشركات المسجلة...
      </div>
    );
  }

  if (error) return null;
  if (!matches || matches.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-muted)]">
        ما فيه شركات مسجلة توفر عروض حالياً. تصفح{" "}
        <a href="/companies" className="text-[var(--color-accent)] underline">
          دليل الشركات
        </a>{" "}
        لاحقاً.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-lg font-bold">عروض من شركات مسجلة تناسب احتياجك</h2>

      <div className="space-y-3">
        {matches.map((m) => {
          const isBest = m.package.id === bestId;
          return (
            <div
              key={m.package.id}
              className={`rounded-lg border p-4 ${
                isBest
                  ? "border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
              }`}
            >
              {m.package.media.length > 0 && <PackageMediaGallery media={m.package.media} />}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {m.package.title}
                    {isBest && (
                      <span className="mr-2 rounded-full bg-[var(--color-accent-2)] px-2 py-0.5 text-xs text-black">
                        أفضل عرض
                      </span>
                    )}
                  </div>
                  <a
                    href={`/companies/${m.package.company.slug}`}
                    className="text-xs text-[var(--color-accent)] underline"
                  >
                    {m.package.company.name} {m.package.company.city && `· ${m.package.company.city}`}
                  </a>
                </div>
                <div className="text-left">
                  {m.package.priceUSD && (
                    <div className="font-bold text-[var(--color-accent-2)]">
                      ${m.package.priceUSD.toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-[var(--color-text-muted)]">تطابق {m.score}%</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {m.reasons.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-[var(--color-accent-2)]">
                    {m.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {m.warnings.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-[var(--color-danger)]">
                    {m.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-3">
                <RequestOfferModal
                  companyId={m.package.companyId}
                  companyName={m.package.company.name}
                  packageId={m.package.id}
                  packageTitle={m.package.title}
                  requirement={requirement}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
