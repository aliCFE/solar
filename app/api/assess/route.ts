import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAiAssessment } from "@/lib/aiSolarCalc";
import { runAssessment } from "@/lib/solarCalc";
import { getActiveProvider } from "@/lib/aiProvider";
import { rateLimitOrNull } from "@/lib/rateLimit";
import { readUploadedFile } from "@/lib/uploads";

const inputSchema = z.object({
  homeAreaSqm: z.number().positive(),
  monthlyConsumptionKWh: z.number().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationLabel: z.string().min(1),
  batteryAutonomyDays: z.number().positive(),
  preferredBatteryType: z.enum(["lithium", "lead-acid", "auto"]),
  roofOrientation: z.enum(["south", "southeast", "southwest", "east", "west", "north", "flat", "unknown"]),
  roofPlanUrl: z.string().trim().optional().nullable(),
  roofWidthM: z.number().positive().optional().nullable(),
  roofLengthM: z.number().positive().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "assess", limit: 8, windowMs: 15 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير مكتملة", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // The AI computes the full system sizing (not a hardcoded formula). If no
  // AI key is configured, or the AI call fails/returns something unusable,
  // fall back to the deterministic engine so the page never breaks — but the
  // AI path is the primary one whenever a key is available. When a roof plan
  // was uploaded, it's read as part of this same AI call (not a separate
  // request) so submitting costs one AI call, not two.
  try {
    getActiveProvider();
    const image = parsed.data.roofPlanUrl ? await readUploadedFile(parsed.data.roofPlanUrl) : undefined;
    const result = await runAiAssessment(parsed.data, image);
    return NextResponse.json(result);
  } catch (aiErr) {
    console.error("[/api/assess] AI call failed, falling back to deterministic engine:", aiErr);
    try {
      const fallback = await runAssessment(parsed.data);
      fallback.system.notes.unshift(
        `تحذير: تعذر استخدام الذكاء الاصطناعي للحساب (${aiErr instanceof Error ? aiErr.message : "خطأ غير معروف"})، فاستخدمنا محرك الحساب الاحتياطي.`
      );
      return NextResponse.json(fallback);
    } catch (fallbackErr) {
      return NextResponse.json(
        { error: fallbackErr instanceof Error ? fallbackErr.message : "خطأ غير متوقع" },
        { status: 500 }
      );
    }
  }
}
