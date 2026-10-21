import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeRoofPlan } from "@/lib/roofPlanAnalysis";
import { readUploadedFile } from "@/lib/uploads";
import { rateLimitOrNull } from "@/lib/rateLimit";

const inputSchema = z.object({
  roofPlanUrl: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "read-plan", limit: 15, windowMs: 15 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "رابط الخارطة مفقود" }, { status: 400 });
  }

  try {
    const image = await readUploadedFile(parsed.data.roofPlanUrl);
    const reading = await analyzeRoofPlan(image);
    return NextResponse.json(reading);
  } catch (err) {
    console.error("[/api/assess/read-plan] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشلت قراءة الخارطة" },
      { status: 500 }
    );
  }
}
