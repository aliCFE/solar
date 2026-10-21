import type { AssessmentInput, AssessmentResult } from "@/types";

const BATTERY_DOD = { lithium: 0.9, "lead-acid": 0.5 } as const;

/**
 * Independent, non-AI sanity check on the AI's system-sizing output. Zod
 * only verifies shape (right types, positive numbers) — it can't catch a
 * JSON blob that's internally self-contradictory (e.g. actualSystemSizeKW
 * that doesn't match numberOfPanels × panelWattage, or usable battery
 * capacity bigger than nominal capacity). A model returning well-formed but
 * inconsistent numbers is exactly the failure mode that looks safe until a
 * customer notices the arithmetic doesn't add up.
 *
 * Returns the first violated rule, or null if the result is internally
 * consistent. Callers should treat a non-null result the same as an AI
 * failure (fall back, don't present the numbers as trustworthy).
 */
export function findSystemInconsistency(
  input: AssessmentInput,
  system: AssessmentResult["system"]
): string | null {
  const arrayFromPanels = (system.numberOfPanels * system.panelWattage) / 1000;
  if (Math.abs(arrayFromPanels - system.actualSystemSizeKW) > Math.max(0.3, arrayFromPanels * 0.05)) {
    return `حجم المصفوفة (${system.actualSystemSizeKW} kW) ما يطابق عدد الألواح × قدرة اللوح (${system.numberOfPanels} × ${system.panelWattage}W = ${arrayFromPanels.toFixed(2)} kW)`;
  }

  if (system.inverterSizeKW < system.actualSystemSizeKW * 0.8) {
    return `حجم الانفيرتر (${system.inverterSizeKW} kW) أصغر بشكل غير منطقي من حجم مصفوفة الألواح (${system.actualSystemSizeKW} kW)`;
  }

  if (system.batteryUsableCapacityKWh > system.batteryCapacityKWh) {
    return `الطاقة القابلة للاستخدام بالبطارية (${system.batteryUsableCapacityKWh} kWh) أكبر من سعتها الاسمية (${system.batteryCapacityKWh} kWh)`;
  }

  const expectedUsable = system.dailyConsumptionKWh * input.batteryAutonomyDays;
  if (expectedUsable > 0 && Math.abs(system.batteryUsableCapacityKWh - expectedUsable) > Math.max(1, expectedUsable * 0.25)) {
    return `الطاقة القابلة للاستخدام (${system.batteryUsableCapacityKWh} kWh) ما تتوافق مع الاستهلاك اليومي × أيام الاستقلالية (${system.dailyConsumptionKWh} × ${input.batteryAutonomyDays} = ${expectedUsable.toFixed(2)} kWh)`;
  }

  const dod = BATTERY_DOD[system.batteryType];
  const expectedNominal = expectedUsable / dod;
  if (expectedUsable > 0 && Math.abs(system.batteryCapacityKWh - expectedNominal) > Math.max(1.5, expectedNominal * 0.3)) {
    return `سعة البطارية الاسمية (${system.batteryCapacityKWh} kWh) ما تتوافق مع عمق التفريغ المفترض لنوع البطارية (متوقع تقريباً ${expectedNominal.toFixed(2)} kWh)`;
  }

  for (const [label, range] of [
    ["estimatedPanelCostUSD", system.estimatedPanelCostUSD],
    ["estimatedBatteryCostUSD", system.estimatedBatteryCostUSD],
    ["estimatedInverterCostUSD", system.estimatedInverterCostUSD],
    ["estimatedTotalCostUSD", system.estimatedTotalCostUSD],
  ] as const) {
    if (range[1] < range[0]) return `نطاق ${label} معكوس (الحد الأعلى أصغر من الحد الأدنى)`;
  }

  const componentSumLo = system.estimatedPanelCostUSD[0] + system.estimatedBatteryCostUSD[0] + system.estimatedInverterCostUSD[0];
  const componentSumHi = system.estimatedPanelCostUSD[1] + system.estimatedBatteryCostUSD[1] + system.estimatedInverterCostUSD[1];
  if (
    system.estimatedTotalCostUSD[0] < componentSumLo * 0.9 ||
    system.estimatedTotalCostUSD[1] > componentSumHi * 1.6
  ) {
    return `إجمالي الكلفة التقديرية (${system.estimatedTotalCostUSD[0]}-${system.estimatedTotalCostUSD[1]}$) ما يتوافق مع مجموع مكوناته (${componentSumLo}-${componentSumHi}$)`;
  }

  if (!system.roofAreaSufficient && system.roofAreaNeededSqm <= input.homeAreaSqm) {
    return `roofAreaSufficient معلّمة false رغم إن المساحة المطلوبة (${system.roofAreaNeededSqm} م²) أصغر من أو تساوي المتاحة (${input.homeAreaSqm} م²)`;
  }
  if (system.roofAreaSufficient && system.roofAreaNeededSqm > input.homeAreaSqm) {
    return `roofAreaSufficient معلّمة true رغم إن المساحة المطلوبة (${system.roofAreaNeededSqm} م²) أكبر من المتاحة (${input.homeAreaSqm} م²)`;
  }

  return null;
}
