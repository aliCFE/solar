import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";

const updateSchema = z.object({
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  description: z.string().trim().optional(),
  website: z.string().trim().url().optional().or(z.literal("")),
});

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ company: null });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      city: true,
      description: true,
      website: true,
    },
  });

  return NextResponse.json({ company });
}

export async function PATCH(req: NextRequest) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const { phone, city, description, website } = parsed.data;
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      phone: phone || null,
      city: city || null,
      description: description || null,
      website: website || null,
    },
  });

  return NextResponse.json({ company });
}
