import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generatePanelLayout } from "@/lib/panelLayoutAi";
import { rateLimitOrNull } from "@/lib/rateLimit";
import { readUploadedFile } from "@/lib/uploads";

const inputSchema = z.object({
  roofWidthM: z.number().positive(),
  roofLengthM: z.number().positive(),
  numberOfPanels: z.number().int().positive(),
  panelWattage: z.number().positive(),
  inverterSizeKW: z.number().positive(),
  roofOrientation: z.enum(["south", "southeast", "southwest", "east", "west", "north", "flat", "unknown"]),
  rooftopPlanUrl: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "panel-layout", limit: 8, windowMs: 15 * 60_000 });
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
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" },
      { status: 400 }
    );
  }

  try {
    const image = parsed.data.rooftopPlanUrl ? await readUploadedFile(parsed.data.rooftopPlanUrl) : undefined;
    const layout = await generatePanelLayout(parsed.data, image);
    return NextResponse.json(layout);
  } catch (err) {
    console.error("[/api/assess/panel-layout] AI call failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "فشل تصميم التخطيط" },
      { status: 500 }
    );
  }
}
