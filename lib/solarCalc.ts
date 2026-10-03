import type { AssessmentInput, AssessmentResult, BatteryType, RoofOrientation } from "@/types";
import { getMonthlyPeakSunHours } from "@/lib/nasaPower";

// Sizing assumptions — documented here since they drive every downstream number.
const SYSTEM_LOSS_FACTOR = 0.8; // wiring, inverter, dust, temperature derating

// Iraq sits in the Northern Hemisphere, so a due-south roof gets the most annual
// sun; every other direction loses some yield. Ratios are standard PV-siting
// rule-of-thumb figures relative to true south (not a precise shading model).
const ORIENTATION_FACTORS: Record<RoofOrientation, number> = {
  south: 1.0,
  southeast: 0.97,
  southwest: 0.97,
  east: 0.88,
  west: 0.88,
  north: 0.72,
  flat: 0.93, // flat roofs mounted on tilted racking, close to optimal
  unknown: 0.9, // conservative average when the customer isn't sure
};

const ORIENTATION_LABELS_AR: Record<RoofOrientation, string> = {
  south: "جنوب",
  southeast: "جنوب شرقي",
  southwest: "جنوب غربي",
  east: "شرق",
  west: "غرب",
  north: "شمال",
  flat: "سطح مستوي",
  unknown: "غير معروف",
};
const PANEL_WATTAGE = 550; // common modern monocrystalline panel
const PANEL_AREA_SQM = 2.6; // includes mounting/spacing clearance per panel
const INVERTER_OVERSIZE_FACTOR = 1.25; // headroom above array size for surge loads
const INVERTER_STANDARD_SIZES_KW = [3, 5, 8, 10, 15, 20, 25, 30];
const LITHIUM_DOD = 0.9; // usable depth of discharge
const LEAD_ACID_DOD = 0.5;
const LITHIUM_COST_PER_KWH_USD: [number, number] = [280, 400];
const LEAD_ACID_COST_PER_KWH_USD: [number, number] = [130, 200];
const PANEL_COST_PER_WATT_USD: [number, number] = [0.35, 0.55];
const INVERTER_COST_PER_KW_USD: [number, number] = [90, 160];

function roundUpToStandardInverter(sizeKW: number): number {
  return (
    INVERTER_STANDARD_SIZES_KW.find((size) => size >= sizeKW) ??
    Math.ceil(sizeKW / 5) * 5
  );
}

function addRanges(...ranges: [number, number][]): [number, number] {
  return [
    Math.round(ranges.reduce((sum, [lo]) => sum + lo, 0)),
    Math.round(ranges.reduce((sum, [, hi]) => sum + hi, 0)),
  ];
}

export async function runAssessment(input: AssessmentInput): Promise<AssessmentResult> {
  const monthly = await getMonthlyPeakSunHours(input.latitude, input.longitude);
  const worstMonth = monthly.reduce((min, m) => (m.peakSunHours < min.peakSunHours ? m : min));
  const averagePeakSunHours =
    monthly.reduce((sum, m) => sum + m.peakSunHours, 0) / monthly.length;

  const dailyConsumptionKWh = input.monthlyConsumptionKWh / 30;
  const orientationFactor = ORIENTATION_FACTORS[input.roofOrientation] ?? ORIENTATION_FACTORS.unknown;

  // Size against the worst month so the system covers the household year-round,
  // not just in peak summer sun. Roof orientation derates the usable sun
  // further — a north-facing roof needs more panels for the same output.
  const recommendedSystemSizeKW =
    dailyConsumptionKWh / worstMonth.peakSunHours / SYSTEM_LOSS_FACTOR / orientationFactor;

  const numberOfPanels = Math.max(1, Math.ceil((recommendedSystemSizeKW * 1000) / PANEL_WATTAGE));
  const actualSystemSizeKW = (numberOfPanels * PANEL_WATTAGE) / 1000;

  const roofAreaNeededSqm = Math.round(numberOfPanels * PANEL_AREA_SQM);
  const roofAreaSufficient = roofAreaNeededSqm <= input.homeAreaSqm;

  const inverterSizeKW = roundUpToStandardInverter(actualSystemSizeKW * INVERTER_OVERSIZE_FACTOR);

  const batteryType: BatteryType =
    input.preferredBatteryType === "auto" ? "lithium" : input.preferredBatteryType;
  const dod = batteryType === "lithium" ? LITHIUM_DOD : LEAD_ACID_DOD;
  const batteryUsableCapacityKWh = dailyConsumptionKWh * input.batteryAutonomyDays;
  const batteryCapacityKWh = Math.ceil((batteryUsableCapacityKWh / dod) * 10) / 10;

  const batteryCostRange: [number, number] =
    batteryType === "lithium" ? LITHIUM_COST_PER_KWH_USD : LEAD_ACID_COST_PER_KWH_USD;

  const estimatedPanelCostUSD: [number, number] = [
    Math.round(numberOfPanels * PANEL_WATTAGE * PANEL_COST_PER_WATT_USD[0]),
    Math.round(numberOfPanels * PANEL_WATTAGE * PANEL_COST_PER_WATT_USD[1]),
  ];
  const estimatedBatteryCostUSD: [number, number] = [
    Math.round(batteryCapacityKWh * batteryCostRange[0]),
    Math.round(batteryCapacityKWh * batteryCostRange[1]),
  ];
  const estimatedInverterCostUSD: [number, number] = [
    Math.round(inverterSizeKW * INVERTER_COST_PER_KW_USD[0]),
    Math.round(inverterSizeKW * INVERTER_COST_PER_KW_USD[1]),
  ];
  const estimatedTotalCostUSD = addRanges(
    estimatedPanelCostUSD,
    estimatedBatteryCostUSD,
    estimatedInverterCostUSD
  );

  const notes: string[] = [
    `الحساب معتمد على أسوأ شهر شمسي بالسنة (${worstMonth.month}, ${worstMonth.peakSunHours} ساعة ذروة شمسية/يوم) لضمان تغطية الاستهلاك طول السنة.`,
    `يفترض الحساب لوح شمسي بقدرة ${PANEL_WATTAGE} واط وكفاءة نظام ${Math.round(SYSTEM_LOSS_FACTOR * 100)}% (خسائر الأسلاك، الحرارة، والانفيرتر).`,
  ];
  if (!roofAreaSufficient) {
    notes.push(
      `تحذير: المساحة المدخلة (${input.homeAreaSqm} م²) قد لا تكفي لتركيب ${numberOfPanels} لوح (يحتاج تقريباً ${roofAreaNeededSqm} م² من مساحة السطح). راجع تقليل الاستهلاك أو استخدام ألواح أعلى كفاءة.`
    );
  }
  if (input.preferredBatteryType === "auto") {
    notes.push("تم اقتراح بطارية ليثيوم (LiFePO4) تلقائياً لعمرها الأطول وكفاءتها الأعلى؛ يمكن التبديل لبطاريات الرصاص الحمضي لتقليل الكلفة الأولية.");
  }
  if (orientationFactor < 1) {
    notes.push(
      `اتجاه السطح (${ORIENTATION_LABELS_AR[input.roofOrientation]}) يقلل الإنتاج عن الاتجاه الجنوبي الأمثل بنسبة ${Math.round((1 - orientationFactor) * 100)}%، فتمت زيادة عدد الألواح لتعويض الفرق.`
    );
  }
  if (input.roofPlanUrl) {
    notes.push(
      `تنويه: هذا المحرك الاحتياطي ما يقرأ صور — استخدمنا المساحة الاحتياطية (${input.homeAreaSqm} م²) يلي أدخلتها يدوياً، مو الخارطة المرفوعة.`
    );
  }

  return {
    input,
    irradiance: { monthly, worstMonth, averagePeakSunHours: Number(averagePeakSunHours.toFixed(2)) },
    system: {
      dailyConsumptionKWh: Number(dailyConsumptionKWh.toFixed(2)),
      recommendedSystemSizeKW: Number(recommendedSystemSizeKW.toFixed(2)),
      panelWattage: PANEL_WATTAGE,
      numberOfPanels,
      actualSystemSizeKW: Number(actualSystemSizeKW.toFixed(2)),
      roofAreaNeededSqm,
      roofAreaSufficient,
      inverterSizeKW,
      batteryType,
      batteryCapacityKWh,
      batteryUsableCapacityKWh: Number(batteryUsableCapacityKWh.toFixed(2)),
      estimatedPanelCostUSD,
      estimatedBatteryCostUSD,
      estimatedInverterCostUSD,
      estimatedTotalCostUSD,
      orientationFactor,
      areaSource: "manual",
      notes,
    },
  };
}
