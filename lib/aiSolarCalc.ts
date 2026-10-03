import { z } from "zod";
import { callAi, extractJson, type AiImageInput } from "@/lib/aiProvider";
import { getMonthlyPeakSunHours } from "@/lib/nasaPower";
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

const aiResponseSchema = z.object({
  areaSource: z.enum(["plan", "manual"]),
  resolvedAreaSqm: z.number().positive(),
  roofWidthM: z.number().positive().nullable(),
  roofLengthM: z.number().positive().nullable(),
  system: systemSchema,
});

const SYSTEM_PROMPT = `انت مهندس أنظمة طاقة شمسية خبير. تستلم بيانات زبون (مساحة سطح احتياطية أدخلها يدوياً، استهلاك كهربائي، موقع، بيانات إشعاع شمسي حقيقية شهرية لموقعه، اتجاه السطح، تفضيلات البطارية)، وربما صورة خارطة بيت مرفقة. تحسب له نظام طاقة شمسية متكامل من الصفر بنفسك — أنت المسؤول عن كل الحسابات الهندسية والرياضية، ما في معادلة جاهزة تطبقها، أنت تسوي التفكير والحساب.

إذا فيه صورة خارطة مرفقة معك، أول شي اقرأ الأبعاد الخارجية المكتوبة عليها صراحة (طول × عرض المبنى ككل، مو مجموع الغرف الداخلية لأنها أصغر بسبب سمك الجدران) واحسب المساحة الكلية للبصمة الخارجية — استخدم هذا الرقم كمساحة السطح الفعلية (areaSource: "plan") بدل الرقم الاحتياطي المدخل يدوياً. إذا الخارطة غير واضحة أو ما فيها أبعاد قابلة للقراءة، أو ما فيه صورة أصلاً، استخدم الرقم الاحتياطي المدخل يدوياً (areaSource: "manual") ورجع roofWidthM/roofLengthM كـ null.

اتبع هذا المنهج الهندسي السليم للحساب:
- احسب الاستهلاك اليومي من الاستهلاك الشهري.
- استخدم أسوأ شهر شمسي بالسنة (أقل ساعات ذروة شمسية) لحجم النظام، عشان يغطي الاستهلاك طول السنة مو بس بالصيف.
- طبق كفاءة نظام واقعية (خسائر أسلاك/حرارة/انفيرتر) حوالي 75-80%.
- طبق خصم اتجاه السطح إذا مو جنوبي مباشر (جنوب شرقي/غربي خصم بسيط ~3%، شرق/غرب ~10-12%، شمال ~25-28%، سطح مستوي ~5-7%، غير معروف ~10%).
- اختر قدرة لوح شمسي واقعية شائعة بالسوق (عادة 500-600 واط للوح الحديث) وحدد عدد الألواح (قرّب للأعلى دائماً).
- تأكد هل مساحة السطح (الناتجة من الخارطة أو الاحتياطية) كافية لعدد الألواح (احسب ~2.6 م² لكل لوح شامل مساحة التركيب والصيانة).
- اقترح حجم انفيرتر مناسب (بهامش أمان معقول فوق حجم مصفوفة الألواح، بمقاس تجاري شائع: 3, 5, 8, 10, 15, 20, 25, 30 kW).
- احسب سعة البطارية بالاعتماد على أيام الاستقلالية المطلوبة وعمق التفريغ الآمن (ليثيوم LiFePO4 ~90%، رصاص حمضي ~50%).
- قدّر نطاق كلفة واقعي بالدولار الأمريكي لكل مكون (ألواح، بطارية، انفيرتر) بأسعار السوق التقريبية الحالية 2026، وبعدين المجموع الكلي.
- اكتب ملاحظات (notes) بالعربي تشرح أهم قراراتك وأي تحذيرات (مثل نقص مساحة السطح، أو أنك اعتمدت الرقم الاحتياطي لأن الخارطة غير واضحة).

جاوب بصيغة JSON فقط بدون أي نص خارج الـJSON، مطابق تماماً للشكل المطلوب.`;

function buildUserPrompt(
  input: AssessmentInput,
  monthly: { month: string; peakSunHours: number }[],
  hasImage: boolean
): string {
  const worst = monthly.reduce((min, m) => (m.peakSunHours < min.peakSunHours ? m : min));

  return `بيانات الزبون:
- مساحة السطح الاحتياطية (استخدمها بس لو ما فيه خارطة أو ما كدرت تقراها): ${input.homeAreaSqm} م²
- ${hasImage ? "فيه صورة خارطة بيت مرفقة مع هذا الطلب — اقرأها أول شي." : "ما فيه صورة خارطة مرفقة — استخدم المساحة الاحتياطية مباشرة."}
- الاستهلاك الشهري: ${input.monthlyConsumptionKWh} kWh
- الموقع: ${input.locationLabel} (خط عرض ${input.latitude}, خط طول ${input.longitude})
- اتجاه السطح: ${ORIENTATION_LABELS_AR[input.roofOrientation]}
- أيام الاستقلالية المطلوبة من البطارية: ${input.batteryAutonomyDays}
- نوع البطارية المفضل: ${input.preferredBatteryType === "auto" ? "اقتراح تلقائي (اختر الأنسب، الأفضلية لليثيوم)" : input.preferredBatteryType === "lithium" ? "ليثيوم" : "رصاص حمضي"}

بيانات الإشعاع الشمسي الحقيقية لهذا الموقع (ساعة ذروة شمسية/يوم لكل شهر، من بيانات NASA):
${monthly.map((m) => `${m.month}: ${m.peakSunHours}`).join("\n")}
أسوأ شهر: ${worst.month} (${worst.peakSunHours} ساعة/يوم)

طلع JSON بهذا الشكل بالضبط (كل الأرقام numbers فعلية، مو نصوص):
{
  "areaSource": "plan" | "manual",
  "resolvedAreaSqm": number (المساحة يلي اعتمدتها فعلياً بالحساب، من الخارطة أو الاحتياطية),
  "roofWidthM": number | null (لو قريت من خارطة),
  "roofLengthM": number | null (لو قريت من خارطة),
  "system": {
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
  }
}`;
}

export async function runAiAssessment(input: AssessmentInput, image?: AiImageInput): Promise<AssessmentResult> {
  const monthly = await getMonthlyPeakSunHours(input.latitude, input.longitude);
  const worstMonth = monthly.reduce((min, m) => (m.peakSunHours < min.peakSunHours ? m : min));
  const averagePeakSunHours = monthly.reduce((sum, m) => sum + m.peakSunHours, 0) / monthly.length;

  // kimi-k3 is a reasoning model — it spends a large share of the token
  // budget on internal reasoning_content before writing the final JSON, so
  // this needs much more headroom than a plain extraction call. Reading the
  // roof plan (when attached) happens in this same call rather than a
  // separate request, so uploading a plan costs one AI call, not two.
  const text = await callAi({
    system: SYSTEM_PROMPT,
    userText: buildUserPrompt(input, monthly, Boolean(image)),
    image,
    maxTokens: 9000,
  });

  const parsed = extractJson<unknown>(text);
  const aiResult = aiResponseSchema.parse(parsed);

  const resolvedInput: AssessmentInput = {
    ...input,
    homeAreaSqm: aiResult.resolvedAreaSqm,
    roofWidthM: aiResult.roofWidthM,
    roofLengthM: aiResult.roofLengthM,
  };

  return {
    input: resolvedInput,
    irradiance: { monthly, worstMonth, averagePeakSunHours: Number(averagePeakSunHours.toFixed(2)) },
    system: { ...aiResult.system, areaSource: aiResult.areaSource },
  };
}
