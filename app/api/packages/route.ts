import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";
import { packageInputSchema } from "@/lib/packageSchema";

export async function GET(req: NextRequest) {
  const companySlug = req.nextUrl.searchParams.get("companySlug");

  const packages = await prisma.solarPackage.findMany({
    where: {
      isActive: true,
      company: { status: "approved", ...(companySlug ? { slug: companySlug } : {}) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, slug: true, city: true } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(packages);
}

export async function POST(req: NextRequest) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "يجب تسجيل الدخول كشركة أولاً" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = packageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const created = await prisma.solarPackage.create({
    data: { ...parsed.data, companyId },
    include: { media: true },
  });

  return NextResponse.json(created, { status: 201 });
}
