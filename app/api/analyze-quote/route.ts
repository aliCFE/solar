import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractQuoteFromFile, evaluateQuote } from "@/lib/quoteAnalysis";
import { rateLimitOrNull } from "@/lib/rateLimit";
import type { AssessmentResult, QuoteAnalysis } from "@/types";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "analyze-quote", limit: 10, windowMs: 15 * 60_000 });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file");
  const requirementRaw = formData.get("requirement");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لم يتم رفع ملف" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "نوع ملف غير مدعوم. استخدم صورة (JPEG/PNG/WebP) أو PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم الملف كبير جداً (الحد الأقصى 10MB)" }, { status: 400 });
  }
  if (typeof requirementRaw !== "string") {
    return NextResponse.json({ error: "الاحتياج المحسوب مفقود" }, { status: 400 });
  }

  let requirement: AssessmentResult;
  try {
    requirement = JSON.parse(requirementRaw);
  } catch {
    return NextResponse.json({ error: "صيغة الاحتياج المحسوب غير صالحة" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const extracted = await extractQuoteFromFile(base64, file.type);
    const evaluation = await evaluateQuote(extracted, requirement);

    const analysis: QuoteAnalysis = {
      id: crypto.randomUUID(),
      fileName: file.name,
      extracted,
      ...evaluation,
    };

    return NextResponse.json(analysis);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل تحليل الكوتيشن" },
      { status: 500 }
    );
  }
}
