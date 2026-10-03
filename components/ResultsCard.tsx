import type { AssessmentResult } from "@/types";

interface Props {
  result: AssessmentResult;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ? "text-[var(--color-accent)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

export default function ResultsCard({ result }: Props) {
  const { system, irradiance, input } = result;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">نتيجة التقييم — {input.locationLabel}</h2>
        <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
          أسوأ شهر شمسي: {irradiance.worstMonth.month} ({irradiance.worstMonth.peakSunHours} ساعة/يوم)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="عدد الألواح" value={`${system.numberOfPanels} لوح`} accent />
        <Stat label="قدرة النظام" value={`${system.actualSystemSizeKW} kW`} />
        <Stat label="حجم الانفيرتر" value={`${system.inverterSizeKW} kW`} />
        <Stat
          label={`البطارية (${system.batteryType === "lithium" ? "ليثيوم" : "رصاص حمضي"})`}
          value={`${system.batteryCapacityKWh} kWh`}
        />
      </div>

      <div className="rounded-lg border border-[var(--color-border)] p-3">
        <div className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">
          الكلفة التقديرية الكلية
        </div>
        <div className="text-2xl font-bold text-[var(--color-accent-2)]">
          ${system.estimatedTotalCostUSD[0].toLocaleString()} – $
          {system.estimatedTotalCostUSD[1].toLocaleString()}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[var(--color-text-muted)]">
          <div>ألواح: ${system.estimatedPanelCostUSD[0]}–${system.estimatedPanelCostUSD[1]}</div>
          <div>بطارية: ${system.estimatedBatteryCostUSD[0]}–${system.estimatedBatteryCostUSD[1]}</div>
          <div>انفيرتر: ${system.estimatedInverterCostUSD[0]}–${system.estimatedInverterCostUSD[1]}</div>
        </div>
      </div>

      {!system.roofAreaSufficient && (
        <div className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
          تحتاج تقريباً {system.roofAreaNeededSqm} م² من مساحة السطح، وأدخلت {input.homeAreaSqm} م² فقط.
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--color-text-muted)]">
          الإشعاع الشمسي الشهري وتفاصيل إضافية
        </summary>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {irradiance.monthly.map((m) => (
            <div key={m.month} className="rounded bg-[var(--color-surface-2)] p-2 text-center">
              <div className="text-xs text-[var(--color-text-muted)]">{m.month}</div>
              <div className="font-semibold">{m.peakSunHours}</div>
            </div>
          ))}
        </div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-[var(--color-text-muted)]">
          {system.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
