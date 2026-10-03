import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
  }

  const packages = await prisma.solarPackage.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(packages);
}
