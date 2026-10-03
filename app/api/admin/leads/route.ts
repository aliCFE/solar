import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, slug: true } },
      package: { select: { title: true, priceUSD: true } },
    },
  });

  return NextResponse.json(leads);
}
