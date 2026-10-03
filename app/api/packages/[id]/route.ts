import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";
import { packageInputSchema } from "@/lib/packageSchema";

async function assertOwnership(id: string, companyId: string) {
  const existing = await prisma.solarPackage.findUnique({ where: { id }, select: { companyId: true } });
  if (!existing) return { ok: false as const, status: 404, error: "الباقة غير موجودة" };
  if (existing.companyId !== companyId) return { ok: false as const, status: 403, error: "غير مصرح" };
  return { ok: true as const };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const ownership = await assertOwnership(id, companyId);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = packageInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const updated = await prisma.solarPackage.update({
    where: { id },
    data: parsed.data,
    include: { media: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const ownership = await assertOwnership(id, companyId);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  await prisma.solarPackage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
