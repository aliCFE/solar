"use client";

import { useState } from "react";
import { IRAQ_CITY_PRESETS } from "@/lib/cities";
import type { AssessmentInput, AssessmentResult, BatteryType, RoofOrientation, RoofPlanReading } from "@/types";
import UploadProgressBar from "@/components/UploadProgressBar";

interface Props {
  onSubmit: (input: AssessmentInput) => void;
  isLoading: boolean;
  result?: AssessmentResult | null;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const labelClass = "mb-1 block text-sm text-[var(--color-text-muted)]";

const ROOF_ORIENTATION_OPTIONS: { value: RoofOrientation; label: string }[] = [
  { value: "unknown", label: "غير متأكد (تقدير متوسط)" },
  { value: "south", label: "جنوب (الأفضل)" },
  { value: "southeast", label: "جنوب شرقي" },
  { value: "southwest", label: "جنوب غربي" },
  { value: "east", label: "شرق" },
  { value: "west", label: "غرب" },
  { value: "north", label: "شمال (الأضعف)" },
  { value: "flat", label: "سطح مستوي" },
];

export default function AssessmentForm({ onSubmit, isLoading, result }: Props) {
  const [cityIndex, setCityIndex] = useState(0);
  const [customLat, setCustomLat] = useState<string>("");
  const [customLng, setCustomLng] = useState<string>("");
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [homeAreaSqm, setHomeAreaSqm] = useState("150");
  const [monthlyConsumptionKWh, setMonthlyConsumptionKWh] = useState("600");
  const [batteryAutonomyDays, setBatteryAutonomyDays] = useState("1");
  const [preferredBatteryType, setPreferredBatteryType] = useState<BatteryType | "auto">("auto");
  const [roofOrientation, setRoofOrientation] = useState<RoofOrientation>("unknown");
  const [roofPlanUrl, setRoofPlanUrl] = useState<string | null>(null);
  const [roofPlanFileName, setRoofPlanFileName] = useState<string | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [planReading, setPlanReading] = useState<RoofPlanReading | null>(null);
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [planReadError, setPlanReadError] = useState<string | null>(null);
  const [areaIsManualOverride, setAreaIsManualOverride] = useState(false);

  // Uploading stores the file, then the plan is read right away in its own
  // dedicated call — separate from system sizing — so the customer sees and
  // can correct the extracted area BEFORE it ever reaches the sizing
  // calculation. A bad vision read this way shows up as "please confirm",
  // never as a silently wrong system size.
  async function handleRoofPlanUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPlanReading(null);
    setPlanReadError(null);
    setAreaIsManualOverride(false);
    setUploadingPlan(true);
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
      if (!res.ok) throw new Error(data.error || "فشل رفع المخطط");
      setRoofPlanUrl(data.url);
      setRoofPlanFileName(file.name);
      setUploadPercent(100);
      clearInterval(tick);
      setUploadingPlan(false);
      setTimeout(() => setUploadPercent(0), 500);

      setAnalyzingPlan(true);
      try {
        const readRes = await fetch("/api/assess/read-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roofPlanUrl: data.url }),
        });
        const reading = await readRes.json();
        if (!readRes.ok) throw new Error(reading.error || "فشلت قراءة الخارطة");
        setPlanReading(reading as RoofPlanReading);
        if (reading.resolvedAreaSqm != null) {
          setHomeAreaSqm(String(reading.resolvedAreaSqm));
        }
      } catch (err) {
        setPlanReadError(err instanceof Error ? err.message : "فشلت قراءة الخارطة");
      } finally {
        setAnalyzingPlan(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع المخطط");
      setUploadPercent(0);
      clearInterval(tick);
      setUploadingPlan(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomLat(pos.coords.latitude.toFixed(4));
        setCustomLng(pos.coords.longitude.toFixed(4));
        setUseCustomLocation(true);
        setLocating(false);
      },
      () => {
        setError("تعذر الحصول على موقعك، أدخل الإحداثيات يدوياً أو اختر مدينة");
        setLocating(false);
      }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const area = Number(homeAreaSqm);
    const consumption = Number(monthlyConsumptionKWh);
    const autonomy = Number(batteryAutonomyDays);

    if (!area || area <= 0) return setError("أدخل مساحة صحيحة للبيت");
    if (!consumption || consumption <= 0) return setError("أدخل استهلاك كهربائي صحيح");

    let latitude: number;
    let longitude: number;
    let locationLabel: string;

    if (useCustomLocation) {
      latitude = Number(customLat);
      longitude = Number(customLng);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return setError("إحداثيات غير صحيحة");
      }
      locationLabel = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
    } else {
      const city = IRAQ_CITY_PRESETS[cityIndex];
      latitude = city.latitude;
      longitude = city.longitude;
      locationLabel = city.label;
    }

    // Only trust the plan-derived source/dimensions when the area field still
    // matches what the plan reading resolved — if the customer typed over it,
    // this is a manual number and must not be reported as plan-confirmed.
    const usingPlanReading =
      !areaIsManualOverride && planReading != null && planReading.resolvedAreaSqm === area;

    onSubmit({
      homeAreaSqm: area,
      monthlyConsumptionKWh: consumption,
      latitude,
      longitude,
      locationLabel,
      batteryAutonomyDays: autonomy || 1,
      preferredBatteryType,
      roofOrientation,
      roofPlanUrl,
      roofWidthM: usingPlanReading ? planReading.outerWidthM : null,
      roofLengthM: usingPlanReading ? planReading.outerLengthM : null,
      areaSource: usingPlanReading ? (planReading.areaSource as "explicit" | "geometric") : "manual",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className={labelClass}>الموقع</span>
        <div className="flex flex-wrap gap-2">
          <select
            className={inputClass + " flex-1 min-w-[10rem]"}
            value={useCustomLocation ? "" : String(cityIndex)}
            onChange={(e) => {
              setUseCustomLocation(false);
              setCityIndex(Number(e.target.value));
            }}
            disabled={useCustomLocation}
          >
            {IRAQ_CITY_PRESETS.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
            disabled={locating}
          >
            {locating ? "..." : "استخدم موقعي الحالي"}
          </button>
        </div>
        {useCustomLocation && (
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              placeholder="خط العرض (latitude)"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="خط الطول (longitude)"
              value={customLng}
              onChange={(e) => setCustomLng(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setUseCustomLocation(false)}
              className="whitespace-nowrap text-sm text-[var(--color-text-muted)] underline"
            >
              رجوع لقائمة المدن
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>مساحة السطح (م²)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={homeAreaSqm}
            onChange={(e) => {
              setHomeAreaSqm(e.target.value);
              setAreaIsManualOverride(true);
            }}
          />
          {!planReading && !analyzingPlan && !areaIsManualOverride && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              رقم تقريبي — لدقة أعلى ارفع خارطة البيت بالحقل المقابل
            </p>
          )}
          {areaIsManualOverride && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">عدّلتها يدوياً — هذا الرقم يلي راح يُستخدم بالحساب</p>
          )}
        </div>
        <div>
          <label className={labelClass}>الاستهلاك الشهري (kWh)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={monthlyConsumptionKWh}
            onChange={(e) => setMonthlyConsumptionKWh(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>اتجاه سطح البيت</label>
          <select
            className={inputClass}
            value={roofOrientation}
            onChange={(e) => setRoofOrientation(e.target.value as RoofOrientation)}
          >
            {ROOF_ORIENTATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>خارطة/مخطط البيت (اختياري، يحسن الدقة)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleRoofPlanUpload(e.target.files?.[0])}
            disabled={uploadingPlan || analyzingPlan}
            className="block w-full text-sm text-[var(--color-text-muted)] file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-[var(--color-text)]"
          />
          {uploadPercent > 0 && <UploadProgressBar percent={uploadPercent} label="جاري رفع الخارطة..." />}
          {analyzingPlan && <UploadProgressBar percent={60} label="جاري قراءة الخارطة..." />}
          {!roofPlanFileName && !analyzingPlan && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              نقرأ الأبعاد المكتوبة على الخارطة فور الرفع، وتقدر تراجع المساحة وتعدّلها قبل الحساب
            </p>
          )}
        </div>
      </div>

      {planReadError && !analyzingPlan && (
        <p className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)]">
          {planReadError} — أدخل مساحة السطح يدوياً بالحقل أعلاه.
        </p>
      )}

      {planReading && !analyzingPlan && !areaIsManualOverride && (
        <div
          className={`rounded-lg border p-3 text-xs ${
            planReading.needsUserConfirmation
              ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
              : "border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)]"
          }`}
        >
          <div className="font-semibold">
            {planReading.areaSource === "explicit" && "✓ مساحة مقروءة صراحة من الخارطة"}
            {planReading.areaSource === "geometric" && "✓ مساحة محسوبة هندسياً من الأبعاد المقروءة"}
            {planReading.areaSource === "uncertain" && "⚠️ ما نقدر نأكد المساحة من هذي الخارطة"}
          </div>
          <p className="mt-1">{planReading.confirmationMessageAr}</p>
          <p className="mt-1 text-[var(--color-text-muted)]">{planReading.summaryAr}</p>
          {!planReading.needsUserConfirmation && (
            <p className="mt-1 text-[var(--color-text-muted)]">راجع رقم المساحة أعلاه وعدّله إذا تحتاج قبل الحساب.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>أيام الاستقلالية عن الشبكة (البطارية)</label>
          <select
            className={inputClass}
            value={batteryAutonomyDays}
            onChange={(e) => setBatteryAutonomyDays(e.target.value)}
          >
            <option value="0.5">نصف يوم</option>
            <option value="1">يوم واحد</option>
            <option value="2">يومين</option>
            <option value="3">ثلاثة أيام</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>نوع البطارية المفضل</label>
          <select
            className={inputClass}
            value={preferredBatteryType}
            onChange={(e) => setPreferredBatteryType(e.target.value as BatteryType | "auto")}
          >
            <option value="auto">اقتراح تلقائي (موصى به)</option>
            <option value="lithium">ليثيوم (LiFePO4)</option>
            <option value="lead-acid">رصاص حمضي</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <button
        type="submit"
        disabled={isLoading || uploadingPlan}
        className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-semibold text-[#1a1200] transition hover:brightness-110 disabled:opacity-60"
      >
        {isLoading ? "جاري الحساب..." : "احسب احتياجي من الطاقة الشمسية"}
      </button>
    </form>
  );
}
