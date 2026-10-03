"use client";

import { useEffect, useState } from "react";
import { IRAQ_CITY_PRESETS } from "@/lib/cities";
import type { AssessmentInput, AssessmentResult, BatteryType, RoofOrientation } from "@/types";
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
  const [areaUpdatedFromPlan, setAreaUpdatedFromPlan] = useState(false);

  // After a result comes back, reflect the area the calculation actually
  // used — if a plan was read, that's the real measured figure, not the
  // fallback number the field held before submitting.
  useEffect(() => {
    if (!result) return;
    const resolved = result.input.homeAreaSqm;
    setHomeAreaSqm((current) => (Number(current) === resolved ? current : String(resolved)));
    setAreaUpdatedFromPlan(result.system.areaSource === "plan");
  }, [result]);

  // Uploading only stores the file — it's read by the AI as part of the one
  // "احسب احتياجي" call below, not as a separate request right here. That
  // keeps this step fast (plain file I/O) and means submitting costs one AI
  // call whether or not a plan was attached, not two.
  async function handleRoofPlanUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAreaUpdatedFromPlan(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع المخطط");
      setUploadPercent(0);
    } finally {
      clearInterval(tick);
      setUploadingPlan(false);
      setTimeout(() => setUploadPercent(0), 500);
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
          <label className={labelClass}>مساحة السطح الاحتياطية (م²)</label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={homeAreaSqm}
            onChange={(e) => {
              setHomeAreaSqm(e.target.value);
              setAreaUpdatedFromPlan(false);
            }}
          />
          {areaUpdatedFromPlan ? (
            <p className="mt-1 text-xs text-[var(--color-accent-2)]">
              ✓ اتحدّثت تلقائياً من الخارطة — هذا الرقم يلي استُخدم فعلياً بالحساب
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              تُستخدم بس لو ما رفعت خارطة، أو الخارطة غير واضحة — لو رفعت خارطة، تنقرا وتحسب وقت تضغط "احسب احتياجي" بالأسفل
            </p>
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
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleRoofPlanUpload(e.target.files?.[0])}
            disabled={uploadingPlan}
            className="block w-full text-sm text-[var(--color-text-muted)] file:ml-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-2)] file:px-3 file:py-2 file:text-[var(--color-text)]"
          />
          {uploadPercent > 0 && <UploadProgressBar percent={uploadPercent} label="جاري رفع الخارطة..." />}
          {roofPlanFileName && !uploadingPlan && uploadPercent === 0 && (
            <p className="mt-1 text-xs text-[var(--color-accent-2)]">
              ✓ تم رفع: {roofPlanFileName} — راح تنقرا تلقائياً وقت تضغط "احسب احتياجي" بالأسفل
            </p>
          )}
          {!roofPlanFileName && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              نقرأ الأبعاد المكتوبة على الخارطة تلقائياً وقت الحساب لتقدير مساحة السطح، وتترافق مع أي طلب عرض ترسله لشركة
            </p>
          )}
        </div>
      </div>

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
