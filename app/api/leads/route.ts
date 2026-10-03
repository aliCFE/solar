import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitOrNull } from "@/lib/rateLimit";

const leadSchema = z.object({
  companyId: z.string().min(1),
  packageId: z.string().min(1).optional(),
  customerName: z.string().trim().min(2, "أدخل اسمك"),
  customerPhone: z.string().trim().min(7, "أدخل رقم هاتف صحيح"),
  customerCity: z.string().trim().optional(),
  assessmentSnapshot: z.unknown().optional(),
  roofPlanUrl: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "leads", limit: 10, windowMs: 10 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: parsed.data.companyId }, select: { status: true } });
  if (!company || company.status !== "approved") {
    return NextResponse.json({ error: "الشركة غير متاحة" }, { status: 404 });
  }

  const lead = await prisma.lead.create({
    data: {
      companyId: parsed.data.companyId,
      packageId: parsed.data.packageId,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerCity: parsed.data.customerCity || null,
      assessmentSnapshot: parsed.data.assessmentSnapshot
        ? JSON.stringify(parsed.data.assessmentSnapshot)
        : null,
      roofPlanUrl: parsed.data.roofPlanUrl || null,
    },
  });

  return NextResponse.json({ id: lead.id }, { status: 201 });
}
