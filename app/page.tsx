"use client";

import { useState } from "react";
import AssessmentForm from "@/components/AssessmentForm";
import ResultsCard from "@/components/ResultsCard";
import PanelLayoutSection from "@/components/PanelLayoutSection";
import MarketplaceMatches from "@/components/MarketplaceMatches";
import QuoteUploader from "@/components/QuoteUploader";
import ComparisonView from "@/components/ComparisonView";
import AdSlot from "@/components/AdSlot";
import UploadProgressBar from "@/components/UploadProgressBar";
import type { AssessmentInput, AssessmentResult, QuoteAnalysis } from "@/types";

const CALC_STAGES = [
  "جاري جلب بيانات الإشعاع الشمسي لموقعك...",
  "جاري تحليل احتياجك بالذكاء الاصطناعي...",
  "جاري تحديد حجم النظام وعدد الألواح...",
  "جاري تحديد الانفيرتر والبطارية...",
  "جاري تقدير الكلفة النهائية...",
];

const CALC_STAGES_WITH_PLAN = [
  "جاري قراءة خارطة البيت وقياس الأبعاد...",
  "جاري جلب بيانات الإشعاع الشمسي لموقعك...",
  "جاري تحليل احتياجك بالذكاء الاصطناعي...",
  "جاري تحديد حجم النظام وعدد الألواح...",
  "جاري تحديد الانفيرتر والبطارية...",
  "جاري تقدير الكلفة النهائية...",
];

export default function Home() {
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [analyses, setAnalyses] = useState<QuoteAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calcPercent, setCalcPercent] = useState(0);
  const [calcLabel, setCalcLabel] = useState(CALC_STAGES[0]);

  async function handleAssess(input: AssessmentInput) {
    const stages = input.roofPlanUrl ? CALC_STAGES_WITH_PLAN : CALC_STAGES;

    setLoading(true);
    setError(null);
    setResult(null);
    setAnalyses([]);
    setCalcPercent(5);
    let stageIdx = 0;
    setCalcLabel(stages[0]);

    const tick = setInterval(() => {
      setCalcPercent((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(0.3, (92 - p) * 0.03))));
    }, 300);
    const stageTick = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      setCalcLabel(stages[stageIdx]);
    }, 2500);

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحساب");
      setCalcPercent(100);
      setResult(data as AssessmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      clearInterval(tick);
      clearInterval(stageTick);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold">منصة تقييم الطاقة الشمسية</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          احسب احتياجك الفعلي من الألواح والبطاريات، وقارن عروض الشركات بمساعدة الذكاء الاصطناعي
        </p>
      </header>

      {!result && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { n: "١", t: "احسب احتياجك", d: "أدخل مساحة بيتك واستهلاكك، وارفع خارطة البيت لدقة أعلى" },
            { n: "٢", t: "قارن العروض", d: "شوف عروض الشركات المسجلة المناسبة لاحتياجك مباشرة، أو ارفع كوتيشن وصلك" },
            { n: "٣", t: "اطلب عبر المنصة", d: "اضغط طلب العرض، وفريقنا يربطك بالشركة الأنسب وينسق التفاصيل" },
          ].map((step) => (
            <div key={step.n} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] font-bold text-[#1a1200]">
                {step.n}
              </div>
              <div className="font-semibold">{step.t}</div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">{step.d}</div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <AssessmentForm onSubmit={handleAssess} isLoading={loading} result={result} />
          {loading && (
            <div className="mt-4">
              <UploadProgressBar percent={calcPercent} label={calcLabel} />
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">قد ياخذ الحساب دقيقة إلى دقيقتين — نستخدم ذكاء اصطناعي يفكر بالمسألة خطوة خطوة.</p>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        </div>

        {result && <ResultsCard result={result} />}

        {result && <PanelLayoutSection result={result} />}

        {result && <MarketplaceMatches requirement={result} />}

        {result && (
          <QuoteUploader requirement={result} analyses={analyses} onAnalysesChange={setAnalyses} />
        )}

        {result && analyses.length >= 2 && (
          <ComparisonView requirement={result} analyses={analyses} />
        )}

        <AdSlot slot="1234567890" />
      </div>
    </main>
  );
}
