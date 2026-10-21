import { z } from "zod";
import { callAi, extractJson } from "@/lib/aiProvider";
import { getMonthlyPeakSunHours } from "@/lib/nasaPower";
import { findAllPriceAnchors, formatAnchorsForPrompt } from "@/lib/productPricing";
import type { AssessmentInput, AssessmentResult } from "@/types";

const ORIENTATION_LABELS_AR: Record<AssessmentInput["roofOrientation"], string> = {
  south: "جنوب (الأفضل، بدون خصم)",
  southeast: "جنوب شرقي",
  southwest: "جنوب غربي",
  east: "شرق",
  west: "غرب",
  north: "شمال (الأضعف)",
  flat: "سطح مستوي",
  unknown: "غير معروف (افترض خصم متوسط 10%)",
};

const systemSchema = z.object({
  dailyConsumptionKWh: z.number().positive(),
  recommendedSystemSizeKW: z.number().positive(),
  panelWattage: z.number().positive(),
  numberOfPanels: z.number().int().positive(),
  actualSystemSizeKW: z.number().positive(),
  roofAreaNeededSqm: z.number().positive(),
  roofAreaSufficient: z.boolean(),
  inverterSizeKW: z.number().positive(),
  batteryType: z.enum(["lithium", "lead-acid"]),
  batteryCapacityKWh: z.number().positive(),
  batteryUsableCapacityKWh: z.number().positive(),
  estimatedPanelCostUSD: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  estimatedBatteryCostUSD: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  estimatedInverterCostUSD: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  estimatedTotalCostUSD: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  orientationFactor: z.number().positive().max(1),
  notes: z.array(z.string()),
});

// This call only sizes the system from an already-confirmed roof area — it
// never touches a plan image or decides the area itself. That read/confirm
// step happens earlier (see lib/roofPlanAnalysis.ts), so a vision misread
// can never silently corrupt the sizing math here.
const SYSTEM_PROMPT = `انت مهندس أنظمة طاقة شمسية خبير. تستلم بيانات زبون (مساحة سطح مؤكدة، استهلاك كهربائي، موقع، بيانات إشعاع شمسي حقيقية شهرية لموقعه، اتجاه السطح، تفضيلات البطارية). تحسب له نظام طاقة شمسية متكامل من الصفر بنفسك — أنت المسؤول عن كل الحسابات الهندسية والرياضية، ما في معادلة جاهزة تطبقها، أنت تسوي التفكير والحساب.

مساحة السطح معطاة لك كرقم مؤكد (الزبون راجعها وأكدها بنفسه) — استخدمها كما هي، لا تحاول تعيد تقديرها أو تشكك فيها.

اتبع هذا المنهج الهندسي السليم للحساب:
- احسب الاستهلاك اليومي من الاستهلاك الشهري.
- استخدم أسوأ شهر شمسي بالسنة (أقل ساعات ذروة شمسية) لحجم النظام، عشان يغطي الاستهلاك طول السنة مو بس بالصيف.
- طبق كفاءة نظام واقعية (خسائر أسلاك/حرارة/انفيرتر) حوالي 75-80%.
- طبق خصم اتجاه السطح إذا مو جنوبي مباشر (جنوب شرقي/غربي خصم بسيط ~3%، شرق/غرب ~10-12%، شمال ~25-28%، سطح مستوي ~5-7%، غير معروف ~10%).
- اختر قدرة لوح شمسي واقعية شائعة بالسوق (عادة 500-600 واط للوح الحديث) وحدد عدد الألواح (قرّب للأعلى دائماً).
- تأكد هل مساحة السطح المعطاة كافية لعدد الألواح (احسب ~2.6 م² لكل لوح شامل مساحة التركيب والصيانة).
- اقترح حجم انفيرتر مناسب (بهامش أمان معقول فوق حجم مصفوفة الألواح، بمقاس تجاري شائع: 3, 5, 8, 10, 15, 20, 25, 30 kW).
- احسب سعة البطارية بالاعتماد على أيام الاستقلالية المطلوبة وعمق التفريغ الآمن (ليثيوم LiFePO4 ~90%، رصاص حمضي ~50%).
- للتسعير: إذا معاك أسعار عراقية موثقة بالبرومبت (مصدر حقيقي وتاريخ)، اعتمدها كأساس نطاقك السعري بدل معرفتك العامة، ووضّح بالملاحظات إنك استخدمت سعر موثق. إذا ما فيه أسعار موثقة قريبة من المواصفات، قدّر نطاق عام وقل صراحة بالملاحظات إنه تقدير عام تقريبي مو مبني على بيانات سوق عراقية موثقة.
- اكتب ملاحظات (notes) بالعربي تشرح أهم قراراتك وأي تحذيرات (مثل نقص مساحة السطح، أو مصدر التسعير).

جاوب بصيغة JSON فقط بدون أي نص خارج الـJSON، مطابق تماماً للشكل المطلوب.`;

function buildUserPrompt(
  input: AssessmentInput,
  monthly: { month: string; peakSunHours: number }[],
  anchorsText: string
): string {
  const worst = monthly.reduce((min, m) => (m.peakSunHours < min.peakSunHours ? m : min));

  return `بيانات الزبون:
- مساحة السطح المؤكدة: ${input.homeAreaSqm} م²
- الاستهلاك الشهري: ${input.monthlyConsumptionKWh} kWh
- الموقع: ${input.locationLabel} (خط عرض ${input.latitude}, خط طول ${input.longitude})
- اتجاه السطح: ${ORIENTATION_LABELS_AR[input.roofOrientation]}
- أيام الاستقلالية المطلوبة من البطارية: ${input.batteryAutonomyDays}
- نوع البطارية المفضل: ${input.preferredBatteryType === "auto" ? "اقتراح تلقائي (اختر الأنسب، الأفضلية لليثيوم)" : input.preferredBatteryType === "lithium" ? "ليثيوم" : "رصاص حمضي"}

بيانات الإشعاع الشمسي الحقيقية لهذا الموقع (ساعة ذروة شمسية/يوم لكل شهر، من بيانات NASA):
${monthly.map((m) => `${m.month}: ${m.peakSunHours}`).join("\n")}
أسوأ شهر: ${worst.month} (${worst.peakSunHours} ساعة/يوم)

بيانات تسعير (لحجم تقريبي قريب من احتياج هذا الزبون):
${anchorsText}

طلع JSON بهذا الشكل بالضبط (كل الأرقام numbers فعلية، مو نصوص):
{
  "dailyConsumptionKWh": number,
  "recommendedSystemSizeKW": number,
  "panelWattage": number,
  "numberOfPanels": number (عدد صحيح),
  "actualSystemSizeKW": number,
  "roofAreaNeededSqm": number,
  "roofAreaSufficient": boolean,
  "inverterSizeKW": number,
  "batteryType": "lithium" | "lead-acid",
  "batteryCapacityKWh": number,
  "batteryUsableCapacityKWh": number,
  "estimatedPanelCostUSD": [number, number],
  "estimatedBatteryCostUSD": [number, number],
  "estimatedInverterCostUSD": [number, number],
  "estimatedTotalCostUSD": [number, number],
  "orientationFactor": number (بين 0 و1),
  "notes": string[] (2-4 ملاحظات بالعربي)
}`;
}

// Rough pre-estimate used only to look up nearby real prices before the AI
// call runs — the AI still makes the actual sizing decision; this just picks
// a plausible neighborhood to search for anchors in. ~550W is the common
// panel wattage this project already assumes elsewhere (lib/solarCalc.ts).
function roughSpecEstimate(input: AssessmentInput, worstMonthPeakSun: number) {
  const dailyConsumptionKWh = input.monthlyConsumptionKWh / 30;
  const panelWattage = 550;
  const systemSizeKW = dailyConsumptionKWh / Math.max(worstMonthPeakSun, 1) / 0.78;
  const inverterSizeKW = systemSizeKW * 1.25;
  const dod = input.preferredBatteryType === "lead-acid" ? 0.5 : 0.9;
  const batteryCapacityKWh = (dailyConsumptionKWh * input.batteryAutonomyDays) / dod;
  return { panelWattage, inverterSizeKW, batteryCapacityKWh };
}

export async function runAiAssessment(input: AssessmentInput): Promise<AssessmentResult> {
  const monthly = await getMonthlyPeakSunHours(input.latitude, input.longitude);
  const worstMonth = monthly.reduce((min, m) => (m.peakSunHours < min.peakSunHours ? m : min));
  const averagePeakSunHours = monthly.reduce((sum, m) => sum + m.peakSunHours, 0) / monthly.length;

  const estimate = roughSpecEstimate(input, worstMonth.peakSunHours);
  const anchors = await findAllPriceAnchors(estimate.panelWattage, estimate.batteryCapacityKWh, estimate.inverterSizeKW);
  const anchorsText = formatAnchorsForPrompt(anchors);

  // kimi-k3 is a reasoning model — it spends a large share of the token
  // budget on internal reasoning_content before writing the final JSON.
  const text = await callAi({
    system: SYSTEM_PROMPT,
    userText: buildUserPrompt(input, monthly, anchorsText),
    maxTokens: 9000,
  });

  const parsed = extractJson<unknown>(text);
  const system = systemSchema.parse(parsed);

  return {
    input,
    irradiance: { monthly, worstMonth, averagePeakSunHours: Number(averagePeakSunHours.toFixed(2)) },
    system: { ...system, areaSource: input.areaSource ?? "manual" },
  };
}
