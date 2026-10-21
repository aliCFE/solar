import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const prices = await prisma.productPrice.findMany({ orderBy: [{ category: "asc" }, { sourceDate: "desc" }] });
  return NextResponse.json(prices);
}

const createSchema = z.object({
  category: z.enum(["panel", "battery", "inverter"]),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  specValue: z.number().positive(),
  priceUSD: z.number().positive(),
  includesInstallation: z.boolean().optional(),
  source: z.string().trim().min(2, "اذكر مصدر السعر"),
  sourceDate: z.string().trim().min(1, "تاريخ السعر مطلوب"),
  city: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const sourceDate = new Date(parsed.data.sourceDate);
  if (Number.isNaN(sourceDate.getTime())) {
    return NextResponse.json({ error: "تاريخ غير صحيح" }, { status: 400 });
  }

  const created = await prisma.productPrice.create({
    data: {
      category: parsed.data.category,
      brand: parsed.data.brand || null,
      model: parsed.data.model || null,
      specValue: parsed.data.specValue,
      priceUSD: parsed.data.priceUSD,
      includesInstallation: parsed.data.includesInstallation ?? false,
      source: parsed.data.source,
      sourceDate,
      city: parsed.data.city || null,
      notes: parsed.data.notes || null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
