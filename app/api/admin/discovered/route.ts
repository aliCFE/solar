import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";

const createSchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة قصير جداً"),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
  city: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  source: z.string().trim().optional(),
});

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const companies = await prisma.discoveredCompany.findMany({
    orderBy: { discoveredAt: "desc" },
  });

  return NextResponse.json(companies);
}

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

  const created = await prisma.discoveredCompany.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      city: parsed.data.city || null,
      notes: parsed.data.notes || null,
      source: parsed.data.source || "manual",
    },
  });

  return NextResponse.json(created, { status: 201 });
}
