"use client";

import { useState } from "react";
import type { AssessmentResult, ComparisonResult, QuoteAnalysis } from "@/types";

interface Props {
  requirement: AssessmentResult;
  analyses: QuoteAnalysis[];
}

export default function ComparisonView({ requirement, analyses }: Props) {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    setLoading(true);
    setError(null);
    setComparison(null);
    try {
      const res = await fetch("/api/compare-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyses, requirement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشلت المقارنة");
      setComparison(data as ComparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  if (analyses.length < 2) return null;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">مقارنة العروض</h2>
        <button
          onClick={handleCompare}
          disabled={loading}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "جاري المقارنة..." : "قارن العروض بالذكاء الاصطناعي"}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {comparison && (
        <div className="space-y-4">
          <p className="text-sm">{comparison.overallSummary}</p>

          <div className="space-y-3">
            {[...comparison.rankings]
              .sort((a, b) => a.rank - b.rank)
              .map((r) => {
                const source = analyses.find((a) => a.id === r.id);
                const isRecommended = r.id === comparison.recommendationId;
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-4 ${
                      isRecommended
                        ? "border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/10"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        #{r.rank} — {source?.extracted.supplierName || source?.fileName}
                        {isRecommended && (
                          <span className="mr-2 rounded-full bg-[var(--color-accent-2)] px-2 py-0.5 text-xs text-black">
                            الأفضل
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">{r.scoreOutOf10}/10</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-accent-2)]">نقاط القوة</div>
                        <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-muted)]">
                          {r.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-danger)]">نقاط الضعف</div>
                        <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-muted)]">
                          {r.weaknesses.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
