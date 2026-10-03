import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { compareQuotes } from "@/lib/quoteAnalysis";
import { rateLimitOrNull } from "@/lib/rateLimit";

const bodySchema = z.object({
  analyses: z.array(z.any()).min(2, "يحتاج عرضين على الأقل للمقارنة"),
  requirement: z.any(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "compare-quotes", limit: 10, windowMs: 15 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير مكتملة" },
      { status: 400 }
    );
  }

  try {
    const result = await compareQuotes(parsed.data.analyses, parsed.data.requirement);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشلت المقارنة" },
      { status: 500 }
    );
  }
}
