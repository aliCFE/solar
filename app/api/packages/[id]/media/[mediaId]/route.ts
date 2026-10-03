import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: packageId, mediaId } = await params;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { packageId: true, package: { select: { companyId: true } } },
  });
  if (!media || media.packageId !== packageId) {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }
  if (media.package.companyId !== companyId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  await prisma.media.delete({ where: { id: mediaId } });
  return NextResponse.json({ ok: true });
}
