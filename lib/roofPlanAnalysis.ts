import { z } from "zod";
import { callAi, extractJson, type AiImageInput } from "@/lib/aiProvider";
import type { RoofPlanReading } from "@/types";

// Extraction only — this prompt must never compute a final area itself. It
// reports exactly what's visible on the plan (numbers, units, whether the
// footprint reads as a simple rectangle) and nothing else. Keeping extraction
// separate from the area math means a vision misread shows up as "couldn't
// read this" instead of silently producing a wrong-but-confident number.
const SYSTEM_PROMPT = `انت تقرأ خارطة/مخطط بيت وتستخرج منها فقط المعلومات المكتوبة أو المرسومة صراحة. لا تحسب أي مساحة، ولا تخمن رقم غير موجود بالصورة.

استخرج:
- explicitAreaSqm: رقم مساحة مكتوب صراحة بالمتر المربع على الخارطة نفسها (مو مجموع غرف تجمعه انت، رقم مكتوب حرفياً كمساحة). null إذا ما فيه.
- outerWidthM و outerLengthM: طول وعرض البصمة الخارجية الكلية للمبنى (الحدود الخارجية، مو أبعاد غرفة وحدة ومو مجموع غرف داخلية) بالمتر، إذا مكتوبة صراحة على الخارطة. null لأي وحدة ما تكدر تقرأها بثقة.
- unit: وحدة القياس يلي استخدمتها الخارطة فعلياً (مثلاً "م" أو "متر")، كما هي مكتوبة.
- floors: عدد الطوابق إذا واضح من الخارطة، أو null.
- shapeRegular: true إذا البصمة الخارجية شكلها مستطيل بسيط تقريباً، false إذا شكل غير منتظم (حرف L أو أكثر تعقيداً)، null إذا ما تقدر تحدد.
- readSuccess: false فقط إذا الصورة مو خارطة بيت أصلاً أو غير مقروءة إطلاقاً.
- summaryAr: جملة أو جملتين بالعربي تشرح بالضبط شنو شفت وقرأت (الأرقام والمواقع)، بدون أي استنتاج أو حساب.

قواعد صارمة:
- لا تجمع مساحات غرف داخلية مع بعض لتطلع مساحة إجمالية — هذا ليس عملك هنا.
- لا تخترع رقم إذا مو مكتوب بوضوح بالصورة. استخدم null.
- لا تفترض إن مساحة الأرض تساوي مساحة البناء.
- جاوب بصيغة JSON فقط.`;

const extractionSchema = z.object({
  explicitAreaSqm: z.number().positive().nullable(),
  outerWidthM: z.number().positive().nullable(),
  outerLengthM: z.number().positive().nullable(),
  unit: z.string().nullable(),
  floors: z.number().int().positive().nullable(),
  shapeRegular: z.boolean().nullable(),
  readSuccess: z.boolean(),
  summaryAr: z.string(),
});

type Extraction = z.infer<typeof extractionSchema>;

function buildUserPrompt(): string {
  return `افحص صورة الخارطة المرفقة وطلع JSON بهذا الشكل بالضبط:
{
  "readSuccess": boolean,
  "explicitAreaSqm": number | null,
  "outerWidthM": number | null,
  "outerLengthM": number | null,
  "unit": string | null,
  "floors": number | null,
  "shapeRegular": boolean | null,
  "summaryAr": string
}`;
}

async function extractFromImage(image: AiImageInput): Promise<Extraction> {
  // Same reasoning-token-budget issue as every other Kimi call in this
  // project: it burns most of a small budget on internal reasoning before
  // ever emitting the JSON, regardless of how simple the task looks.
  const text = await callAi({
    system: SYSTEM_PROMPT,
    userText: buildUserPrompt(),
    image,
    maxTokens: 8000,
  });
  const parsed = extractJson<unknown>(text);
  return extractionSchema.parse(parsed);
}

// Pure code, no AI — the only place a final area number gets produced. Prefers
// an area written explicitly on the plan (most reliable); falls back to
// width×length only when the footprint reads as a simple rectangle; never
// guesses when the shape is irregular or the numbers are incomplete.
function resolveArea(e: Extraction): Pick<RoofPlanReading, "resolvedAreaSqm" | "areaSource" | "needsUserConfirmation" | "confirmationMessageAr"> {
  if (!e.readSuccess) {
    return {
      resolvedAreaSqm: null,
      areaSource: "uncertain",
      needsUserConfirmation: true,
      confirmationMessageAr: "ما قدرنا نقرأ هذي الصورة كخارطة بيت. أدخل مساحة السطح يدوياً.",
    };
  }

  // An explicitly written area is read directly off the drawing, not derived
  // from shape — "is the footprint regular" is irrelevant to trusting it.
  if (e.explicitAreaSqm != null) {
    return {
      resolvedAreaSqm: e.explicitAreaSqm,
      areaSource: "explicit",
      needsUserConfirmation: false,
      confirmationMessageAr: `قرأنا مساحة مكتوبة صراحة على الخارطة: ${e.explicitAreaSqm} م². راجعها وعدّلها إذا تحتاج.`,
    };
  }

  // A clean width×length reading is useful even when the AI isn't fully sure
  // the footprint is a simple rectangle — model judgment on "is this shape
  // regular" has proven inconsistent between identical runs of the same
  // image, so it must never discard two solid numbers outright. Instead it
  // downgrades confidence: irregular shapes get the product as a starting
  // estimate (it's an upper bound for an L-shape, never an invented number)
  // and are flagged for the customer to confirm rather than silently trusted.
  if (e.outerWidthM != null && e.outerLengthM != null) {
    const area = Math.round(e.outerWidthM * e.outerLengthM * 10) / 10;
    if (e.shapeRegular === false) {
      return {
        resolvedAreaSqm: area,
        areaSource: "uncertain",
        needsUserConfirmation: true,
        confirmationMessageAr: `شكل البيت يبدو غير منتظم (مو مستطيل بسيط)، فالرقم ${area} م² (من ${e.outerWidthM} × ${e.outerLengthM} م) حد أعلى تقريبي وممكن يكون أكبر من المساحة الفعلية. راجعه وصحّحه إذا تحتاج.`,
      };
    }
    return {
      resolvedAreaSqm: area,
      areaSource: "geometric",
      needsUserConfirmation: false,
      confirmationMessageAr: `حسبنا المساحة هندسياً من الأبعاد الخارجية المقروءة (${e.outerWidthM} × ${e.outerLengthM} م) = ${area} م². راجعها وعدّلها إذا تحتاج.`,
    };
  }

  return {
    resolvedAreaSqm: null,
    areaSource: "uncertain",
    needsUserConfirmation: true,
    confirmationMessageAr: "ما قدرنا نقرأ أبعاد أو مساحة كافية من هذي الخارطة بثقة. أدخل مساحة السطح يدوياً.",
  };
}

export async function analyzeRoofPlan(image: AiImageInput): Promise<RoofPlanReading> {
  const extraction = await extractFromImage(image);
  const resolved = resolveArea(extraction);

  return {
    readSuccess: extraction.readSuccess,
    explicitAreaSqm: extraction.explicitAreaSqm,
    outerWidthM: extraction.outerWidthM,
    outerLengthM: extraction.outerLengthM,
    unit: extraction.unit,
    floors: extraction.floors,
    shapeRegular: extraction.shapeRegular,
    summaryAr: extraction.summaryAr,
    ...resolved,
  };
}
