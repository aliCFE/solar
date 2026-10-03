import { z } from "zod";
import { callAi, extractJson } from "@/lib/aiProvider";
import type { AssessmentResult, ComparisonResult, ExtractedQuote, QuoteAnalysis } from "@/types";

const extractedQuoteSchema = z.object({
  supplierName: z.string().nullable(),
  panelBrand: z.string().nullable(),
  panelWattage: z.number().nullable(),
  numberOfPanels: z.number().nullable(),
  totalPanelCapacityKW: z.number().nullable(),
  inverterBrand: z.string().nullable(),
  inverterSizeKW: z.number().nullable(),
  batteryBrand: z.string().nullable(),
  batteryType: z.string().nullable(),
  batteryCapacityKWh: z.number().nullable(),
  totalPriceUSD: z.number().nullable(),
  currency: z.string().nullable(),
  warrantyYears: z.number().nullable(),
  installationIncluded: z.boolean().nullable(),
  additionalItems: z.array(z.string()),
  rawNotes: z.string(),
});

const analysisSchema = z.object({
  verdict: z.enum(["good-fit", "over-sized", "under-sized", "overpriced", "needs-review"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  matchScorePercent: z.number(),
});

const EXTRACTION_SYSTEM_PROMPT = `انت خبير هندسة أنظمة طاقة شمسية. تقرأ كوتيشن (عرض سعر) من شركة توريد وتركيب طاقة شمسية، وتستخرج منه بيانات دقيقة بصيغة JSON فقط بدون أي نص إضافي. اذا معلومة غير موجودة بالكوتيشن استخدم null. لا تخمن أرقام غير مذكورة صراحة أو يمكن حسابها بوضوح (مثلاً اذا مذكور عدد الألواح وقدرة كل لوح، احسب totalPanelCapacityKW).`;

function buildRequirementContext(requirement: AssessmentResult): string {
  const s = requirement.system;
  return `احتياج الزبون المحسوب (لاستخدامه كمرجع مقارنة فقط):
- الاستهلاك اليومي: ${s.dailyConsumptionKWh} kWh
- حجم النظام الموصى به: ${s.actualSystemSizeKW} kW (${s.numberOfPanels} لوح × ${s.panelWattage} واط)
- حجم الانفيرتر الموصى به: ${s.inverterSizeKW} kW
- نوع وسعة البطارية الموصى بها: ${s.batteryType === "lithium" ? "ليثيوم" : "رصاص حمضي"}, ${s.batteryCapacityKWh} kWh
- الكلفة التقديرية الكلية: $${s.estimatedTotalCostUSD[0]} - $${s.estimatedTotalCostUSD[1]}`;
}

export async function extractQuoteFromFile(
  fileBase64: string,
  mediaType: string
): Promise<ExtractedQuote> {
  const schemaExample = `{
  "supplierName": string | null,
  "panelBrand": string | null,
  "panelWattage": number | null,
  "numberOfPanels": number | null,
  "totalPanelCapacityKW": number | null,
  "inverterBrand": string | null,
  "inverterSizeKW": number | null,
  "batteryBrand": string | null,
  "batteryType": string | null,
  "batteryCapacityKWh": number | null,
  "totalPriceUSD": number | null,
  "currency": string | null,
  "warrantyYears": number | null,
  "installationIncluded": boolean | null,
  "additionalItems": string[],
  "rawNotes": string
}`;

  const text = await callAi({
    system: EXTRACTION_SYSTEM_PROMPT,
    image: { base64: fileBase64, mediaType },
    maxTokens: 2048,
    userText: `استخرج بيانات هذا الكوتيشن بصيغة JSON مطابقة تماماً لهذا الشكل:\n${schemaExample}`,
  });

  const parsed = extractJson<unknown>(text);
  return extractedQuoteSchema.parse(parsed);
}

export async function evaluateQuote(
  extracted: ExtractedQuote,
  requirement: AssessmentResult
): Promise<Omit<QuoteAnalysis, "id" | "fileName" | "extracted">> {
  const text = await callAi({
    system: "انت مستشار طاقة شمسية محايد يساعد زبون يقيّم عرض سعر مقابل احتياجه الفعلي. جاوب بصيغة JSON فقط.",
    maxTokens: 1536,
    userText: `${buildRequirementContext(requirement)}

بيانات الكوتيشن المستخرجة:
${JSON.stringify(extracted, null, 2)}

قيّم هذا الكوتيشن مقابل الاحتياج وطلع JSON بهذا الشكل بالضبط:
{
  "verdict": "good-fit" | "over-sized" | "under-sized" | "overpriced" | "needs-review",
  "summary": string (جملتين إلى ثلاث بالعربي تلخص التقييم),
  "strengths": string[] (نقاط قوة محددة),
  "weaknesses": string[] (نقاط ضعف أو مخاطر محددة),
  "matchScorePercent": number (0-100, مدى مطابقة العرض للاحتياج الفعلي، مو بالضرورة الأرخص)
}`,
  });

  const parsed = extractJson<unknown>(text);
  return analysisSchema.parse(parsed);
}

export async function compareQuotes(
  analyses: QuoteAnalysis[],
  requirement: AssessmentResult
): Promise<ComparisonResult> {
  const text = await callAi({
    system: "انت مستشار طاقة شمسية محايد يساعد زبون يقارن بين عدة عروض أسعار ويختار الأنسب. جاوب بصيغة JSON فقط.",
    maxTokens: 2048,
    userText: `${buildRequirementContext(requirement)}

العروض المطلوب مقارنتها:
${JSON.stringify(
  analyses.map((a) => ({ id: a.id, fileName: a.fileName, extracted: a.extracted, previousVerdict: a.verdict })),
  null,
  2
)}

قارن بين هذه العروض وطلع JSON بهذا الشكل بالضبط:
{
  "recommendationId": string (id العرض الموصى به),
  "overallSummary": string (فقرة قصيرة تشرح سبب التوصية ومقارنة عامة),
  "rankings": [
    {
      "id": string,
      "rank": number (1 = الأفضل),
      "scoreOutOf10": number,
      "strengths": string[],
      "weaknesses": string[]
    }
  ]
}`,
  });

  return extractJson<ComparisonResult>(text);
}
