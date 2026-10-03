"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentResult, PanelLayout } from "@/types";
import PanelLayoutDiagram from "@/components/PanelLayoutDiagram";
import UploadProgressBar from "@/components/UploadProgressBar";

interface Props {
  result: AssessmentResult;
}

const STAGES = [
  "جاري تصميم توزيع الألواح على السطح...",
  "جاري حساب السلاسل الكهربائية...",
  "جاري كتابة ملاحظات التركيب...",
];

const STAGES_WITH_IMAGE = [
  "جاري فحص خارطة السطح الحقيقية...",
  "جاري تحديد مواقع العوائق (الخزان/الدرج)...",
  "جاري تصميم توزيع الألواح حول العوائق...",
  "جاري حساب السلاسل الكهربائية...",
  "جاري كتابة ملاحظات التركيب...",
];

export default function PanelLayoutSection({ result }: Props) {
  const [layout, setLayout] = useState<PanelLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(6);
  const [label, setLabel] = useState(STAGES[0]);

  const [rooftopPlanUrl, setRooftopPlanUrl] = useState<string | null>(null);
  const [rooftopFileName, setRooftopFileName] = useState<string | null>(null);
  const [uploadingRooftop, setUploadingRooftop] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const roofWidthM = result.input.roofWidthM;
  const roofLengthM = result.input.roofLengthM;

  function generateLayout(withRooftopPlanUrl?: string | null) {
    if (!roofWidthM || !roofLengthM) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    const stages = withRooftopPlanUrl ? STAGES_WITH_IMAGE : STAGES;
    setLoading(true);
    setError(null);
    setPercent(6);
    let stageIdx = 0;
    setLabel(stages[0]);

    const tick = setInterval(() => {
      setPercent((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(0.5, (92 - p) * 0.06))));
    }, 200);
    const stageTick = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      setLabel(stages[stageIdx]);
    }, 1500);

    fetch("/api/assess/panel-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roofWidthM,
        roofLengthM,
        numberOfPanels: result.system.numberOfPanels,
        panelWattage: result.system.panelWattage,
        inverterSizeKW: result.system.inverterSizeKW,
        roofOrientation: result.input.roofOrientation,
        rooftopPlanUrl: withRooftopPlanUrl || undefined,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setLayout(data as PanelLayout);
        setPercent(100);
      })
      .catch((err) => {
        if (cancelled || err?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "فشل تصميم التخطيط");
      })
      .finally(() => {
        clearInterval(tick);
        clearInterval(stageTick);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(tick);
      clearInterval(stageTick);
    };
  }

  useEffect(() => {
    // No "already requested this" ref-guard here on purpose: in dev, React
    // Strict Mode mounts -> cleans up -> remounts this effect once. A guard
    // that persists across that remount (e.g. a ref) blocks the second,
    // real attempt from ever firing while the first one's promise chain is
    // already marked cancelled — the request silently never completes and
    // the progress bar sits frozen. An AbortController lets the orphaned
    // first request actually stop instead of wasting a paid AI call.
    return generateLayout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roofWidthM, roofLengthM, result.system.numberOfPanels, result.system.panelWattage, result.system.inverterSizeKW, result.input.roofOrientation]);

  async function handleRooftopPlanUpload(file: File | undefined) {
    if (!file) return;
    setUploadingRooftop(true);
    setUploadPercent(8);
    const tick = setInterval(() => {
      setUploadPercent((p) => (p >= 92 ? 92 : Math.min(92, p + Math.max(2, (92 - p) * 0.25))));
    }, 100);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "roof-plans");
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع خارطة السطح");
      setRooftopPlanUrl(data.url);
      setRooftopFileName(file.name);
      setUploadPercent(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع خارطة السطح");
      setUploadPercent(0);
    } finally {
      clearInterval(tick);
      setUploadingRooftop(false);
      setTimeout(() => setUploadPercent(0), 500);
    }
  }

  if (!roofWidthM || !roofLengthM) return null;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-lg font-bold">تخطيط توزيع الألواح على السطح</h2>
      <p className="text-xs text-[var(--color-text-muted)]">
        تخطيط إرشادي أولي معتمد على أبعاد السطح المستخرجة من الخارطة — يحتاج تأكيد فني بزيارة ميدانية قبل التركيب الفعلي.
      </p>

      {loading && <UploadProgressBar percent={percent} label={label} />}
      {error && !loading && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {layout && !loading && (
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-2 text-center text-xs ${
              layout.obstructionSource === "image"
                ? "border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            }`}
          >
            {layout.obstructionSource === "image"
              ? "✓ مكان العوائق (الخزان/الدرج) محدد من خارطة سطح حقيقية رفعتها"
              : "⚠️ مكان العوائق تخمين عام (لا يوجد خارطة سطح حقيقية) — ارفع وحدة بالأسفل لدقة أعلى"}
          </div>

          <PanelLayoutDiagram layout={layout} roofWidthM={roofWidthM} roofLengthM={roofLengthM} />

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent)] opacity-85" /> لوح شمسي
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-40" /> مساحة محجوزة (درج/خزان)
            </span>
          </div>

          {!layout.fitsAllPanels && (
            <p className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
              تحذير: الشبكة المقترحة تسع {layout.panelsPlaced} لوح بس من أصل {result.system.numberOfPanels} مطلوب — راجع الملاحظات بالأسفل.
            </p>
          )}

          <p className="text-sm">{layout.layoutSummaryAr}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
              <div className="mb-1 font-semibold text-[var(--color-text-muted)]">السلاسل الكهربائية المقترحة</div>
              {layout.stringGroups.map((count, i) => (
                <div key={i}>سلسلة {i + 1}: {count} لوح</div>
              ))}
            </div>
            <div className="rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
              <div className="mb-1 font-semibold text-[var(--color-text-muted)]">ملاحظات التركيب</div>
              <ul className="list-inside list-disc space-y-0.5">
                {layout.electricalNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="mb-2 text-sm font-semibold">
              {layout.obstructionSource === "image" ? "غيّر خارطة السطح" : "ارفع خارطة السطح الحقيقية لدقة أعلى"}
            </div>
            <p className="mb-2 text-xs text-[var(--color-text-muted)]">
              خارطة السطح نفسه (مو مخطط الطابق الداخلي) توضح مكان خزان الماء وفتحة الدرج الفعلية — نحدد مكان الحجز من الصورة بدل التخمين العام.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleRooftopPlanUpload(e.target.files?.[0])}
              disabled={uploadingRooftop}
              className="block w-full text-sm text-[var(--color-text-muted)] file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-[var(--color-text)]"
            />
            {uploadPercent > 0 && <UploadProgressBar percent={uploadPercent} label="جاري رفع خارطة السطح..." />}
            {rooftopFileName && !uploadingRooftop && uploadPercent === 0 && (
              <p className="mt-1 text-xs text-[var(--color-accent-2)]">✓ تم رفع: {rooftopFileName}</p>
            )}
            <button
              type="button"
              onClick={() => generateLayout(rooftopPlanUrl)}
              disabled={!rooftopPlanUrl || uploadingRooftop || loading}
              className="mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-50"
            >
              أعد التصميم بخارطة السطح
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
