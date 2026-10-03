"use client";

import { useRef, useState } from "react";
import type { AssessmentResult, QuoteAnalysis } from "@/types";

interface Props {
  requirement: AssessmentResult;
  analyses: QuoteAnalysis[];
  onAnalysesChange: (analyses: QuoteAnalysis[]) => void;
}

const VERDICT_LABELS: Record<QuoteAnalysis["verdict"], string> = {
  "good-fit": "مطابق للاحتياج",
  "over-sized": "أكبر من الاحتياج",
  "under-sized": "أصغر من الاحتياج",
  overpriced: "سعر مرتفع",
  "needs-review": "يحتاج مراجعة",
};

const VERDICT_COLORS: Record<QuoteAnalysis["verdict"], string> = {
  "good-fit": "text-[var(--color-accent-2)]",
  "over-sized": "text-[var(--color-accent)]",
  "under-sized": "text-[var(--color-danger)]",
  overpriced: "text-[var(--color-danger)]",
  "needs-review": "text-[var(--color-text-muted)]",
};

export default function QuoteUploader({ requirement, analyses, onAnalysesChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const newAnalyses: QuoteAnalysis[] = [];
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("requirement", JSON.stringify(requirement));

        const res = await fetch("/api/analyze-quote", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل التحليل");
        newAnalyses.push(data as QuoteAnalysis);
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : "فشل غير معروف"}`);
      }
    }

    onAnalysesChange([...analyses, ...newAnalyses]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAnalysis(id: string) {
    onAnalysesChange(analyses.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-lg font-bold">رفع كوتيشنز للمقارنة</h2>
      <p className="text-sm text-[var(--color-text-muted)]">
        ارفع صورة أو PDF لعرض السعر المستلم من الشركة، وراح يقرأه الذكاء الاصطناعي ويقيّمه مقابل احتياجك المحسوب.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        className="block w-full text-sm text-[var(--color-text-muted)] file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:font-semibold file:text-[#1a1200]"
      />
      {uploading && <p className="text-sm text-[var(--color-text-muted)]">جاري التحليل بالذكاء الاصطناعي...</p>}
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {analyses.length > 0 && (
        <div className="space-y-3">
          {analyses.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {a.extracted.supplierName || a.fileName}
                  </div>
                  <div className={`text-sm font-medium ${VERDICT_COLORS[a.verdict]}`}>
                    {VERDICT_LABELS[a.verdict]} — تطابق {a.matchScorePercent}%
                  </div>
                </div>
                <button
                  onClick={() => removeAnalysis(a.id)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                >
                  إزالة
                </button>
              </div>

              <p className="mt-2 text-sm">{a.summary}</p>

              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] sm:grid-cols-4">
                <div>الألواح: {a.extracted.numberOfPanels ?? "؟"} × {a.extracted.panelWattage ?? "؟"}W</div>
                <div>الانفيرتر: {a.extracted.inverterSizeKW ?? "؟"} kW</div>
                <div>البطارية: {a.extracted.batteryCapacityKWh ?? "؟"} kWh</div>
                <div>
                  السعر: {a.extracted.totalPriceUSD ? `$${a.extracted.totalPriceUSD.toLocaleString()}` : "؟"}
                </div>
              </div>

              {(a.strengths.length > 0 || a.weaknesses.length > 0) && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {a.strengths.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-accent-2)]">نقاط القوة</div>
                      <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-muted)]">
                        {a.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {a.weaknesses.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-danger)]">نقاط الضعف</div>
                      <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-muted)]">
                        {a.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
