import { z } from "zod";
import { callAi, extractJson, type AiImageInput } from "@/lib/aiProvider";
import type { PanelLayout, PanelLayoutInput, RoofOrientation } from "@/types";

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

const layoutSchema = z.object({
  panelWidthM: z.number().positive(),
  panelLengthM: z.number().positive(),
  panelOrientation: z.enum(["portrait", "landscape"]),
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  reservedCorner: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "none"]),
  reservedRows: z.number().int().nonnegative(),
  reservedColumns: z.number().int().nonnegative(),
  panelsPlaced: z.number().int().nonnegative(),
  fitsAllPanels: z.boolean(),
  obstructionSource: z.enum(["image", "assumed"]),
  stringGroups: z.array(z.number().int().positive()),
  electricalNotes: z.array(z.string()),
  layoutSummaryAr: z.string(),
});

const SYSTEM_PROMPT_NO_IMAGE = `انت مهندس تركيب أنظمة طاقة شمسية تصمم مخطط توزيع أولي (preliminary layout) للألواح على سطح منزل، بالاعتماد على أبعاد السطح الخارجية بس (ما عندك صورة فعلية للسطح، بس أبعاده كمستطيل).

قواعد التصميم:
- افترض ألواح شمسية بأبعاد واقعية شائعة (تقريباً 1.13م × 2.28م للوح عمودي "portrait"، أو نفسها بالعكس لو أفقي "landscape") — اختار الاتجاه الأنسب لأبعاد السطح.
- احجز ركن واحد من أركان السطح (topLeft/topRight/bottomLeft/bottomRight) كمساحة غير مستخدمة تمثيلاً لفتحة الدرج/خزان الماء الشائعة بأسطح البيوت العراقية — بحدود 8-15% من مساحة السطح، إلا إذا السطح صغير جداً وما يحتمل حجز (استخدم "none" وقتها ووضح بالملاحظات إنه يحتاج تأكيد ميداني). هذا تخمين عام، رجع obstructionSource: "assumed".
- احسب شبكة (rows × columns) من الألواح تغطي عدد الألواح المطلوب بعد استبعاد الخلايا المحجوزة بالركن (reservedRows × reservedColumns خلية من نفس الركن).
- إذا الشبكة المتاحة ما تكفي لعدد الألواح المطلوب كامل، وضح هذا بصراحة (fitsAllPanels: false) واقترح الحل بالملاحظات (تقليل الحجز، أو نظام عمودي مائل يحتاج مسافة أكبر بين الصفوف لتفادي التظليل).
- قسم الألواح لسلاسل كهربائية (strings) منطقية — عدد الألواح بكل سلسلة يعتمد على قدرة الانفيرتر المعطاة (عادة سلاسل متقاربة بالعدد، مثلاً 19 لوح ممكن تصير سلسلتين: 10+9).
- اكتب 2-4 ملاحظات كهربائية عملية بالعربي: مكان الانفيرتر المقترح (قريب من نقطة الدخول للسطح أو الدرج لتقليل طول الكيبل)، تجميع السلاسل بصندوق تجميع (combiner box) لو أكثر من سلسلتين، وأهمية مسافة أمان وممر صيانة بين صفوف الألواح.
- هذا تخطيط إرشادي أولي فقط بدون معاينة ميدانية حقيقية — لا تدعي دقة مطلقة، واذكر هذا التحفظ ضمن الملاحظات أو الملخص.
- جاوب بصيغة JSON فقط.`;

const SYSTEM_PROMPT_WITH_IMAGE = `انت مهندس تركيب أنظمة طاقة شمسية تصمم مخطط توزيع للألواح على سطح منزل، وعندك صورة حقيقية لخارطة/مخطط السطح نفسه (مو مخطط طابق داخلي) توضح عوائق فعلية زي خزان الماء، فتحة الدرج، مظلات، أطباق استقبال، أو أي بناء إضافي على السطح.

قواعد التصميم:
- افحص الصورة أول شي وحدد مواقع العوائق الحقيقية المرسومة أو المكتوبة عليها (خزان، درج، أي بناء) — واستخدم هذا لتحديد الركن أو المنطقة يلي لازم تنحجز فعلياً، مو تخمين عام. رجع obstructionSource: "image".
- لو الصورة غير واضحة أو ما فيها عوائق مرسومة صراحة، ارجع للتخمين العام (8-15% من ركن، obstructionSource: "assumed") ووضح هذا بالملاحظات.
- افترض ألواح شمسية بأبعاد واقعية شائعة (تقريباً 1.13م × 2.28م للوح عمودي "portrait"، أو نفسها بالعكس لو أفقي "landscape") — اختار الاتجاه الأنسب لأبعاد السطح.
- احسب شبكة (rows × columns) من الألواح تغطي عدد الألواح المطلوب بعد استبعاد الخلايا المحجوزة (reservedRows × reservedColumns خلية من أقرب ركن لموقع العائق الحقيقي يلي شفته بالصورة).
- إذا الشبكة المتاحة ما تكفي لعدد الألواح المطلوب كامل، وضح هذا بصراحة (fitsAllPanels: false) واقترح حل بالملاحظات.
- قسم الألواح لسلاسل كهربائية (strings) منطقية حسب قدرة الانفيرتر.
- اكتب 2-4 ملاحظات عملية بالعربي، واذكر بالتحديد شنو شفت بالصورة (مثلاً "الخزان يبين قرب الزاوية الشمالية الشرقية" لو واضح).
- هذا تخطيط إرشادي معتمد على صورة حقيقية لكن بدون معاينة ميدانية فعلية — لا تدعي دقة مطلقة 100%.
- جاوب بصيغة JSON فقط.`;

function buildUserPrompt(input: PanelLayoutInput, hasImage: boolean): string {
  return `أبعاد السطح: ${input.roofWidthM} م × ${input.roofLengthM} م
عدد الألواح المطلوب تركيبها: ${input.numberOfPanels}
قدرة كل لوح: ${input.panelWattage} واط
حجم الانفيرتر: ${input.inverterSizeKW} kW
اتجاه السطح العام: ${ORIENTATION_LABELS_AR[input.roofOrientation]}
${hasImage ? "فيه صورة خارطة سطح حقيقية مرفقة — افحصها أول شي عشان تحدد مواقع العوائق الفعلية." : "ما فيه صورة سطح مرفقة — استخدم افتراض عام لمكان العوائق."}

صمم مخطط توزيع وطلع JSON بهذا الشكل بالضبط:
{
  "panelWidthM": number,
  "panelLengthM": number,
  "panelOrientation": "portrait" | "landscape",
  "rows": number,
  "columns": number,
  "reservedCorner": "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none",
  "reservedRows": number,
  "reservedColumns": number,
  "panelsPlaced": number (rows*columns بعد طرح خلايا الحجز),
  "fitsAllPanels": boolean,
  "obstructionSource": "image" | "assumed",
  "stringGroups": number[] (مجموع عناصرها = عدد الألواح),
  "electricalNotes": string[] (2-4 ملاحظات),
  "layoutSummaryAr": string (فقرة قصيرة تشرح التخطيط والتحفظ عن الدقة)
}`;
}

export async function generatePanelLayout(input: PanelLayoutInput, image?: AiImageInput): Promise<PanelLayout> {
  // Spatial layout reasoning (grid placement, string grouping) burns even
  // more reasoning_content than the solar-sizing call — give it more room.
  const text = await callAi({
    system: image ? SYSTEM_PROMPT_WITH_IMAGE : SYSTEM_PROMPT_NO_IMAGE,
    userText: buildUserPrompt(input, Boolean(image)),
    image,
    maxTokens: 12000,
  });

  const parsed = extractJson<unknown>(text);
  return layoutSchema.parse(parsed);
}
