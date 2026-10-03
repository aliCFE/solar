import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rankPackages } from "@/lib/packageMatching";
import type { AssessmentResult } from "@/types";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const requirement = (body as { requirement?: AssessmentResult })?.requirement;
  if (!requirement?.system) {
    return NextResponse.json({ error: "الاحتياج المحسوب مفقود" }, { status: 400 });
  }

  const packages = await prisma.solarPackage.findMany({
    where: { isActive: true, company: { status: "approved" } },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, slug: true, city: true } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });

  const matches = rankPackages(JSON.parse(JSON.stringify(packages)), requirement);

  return NextResponse.json({
    matches,
    bestId: matches[0]?.package.id ?? null,
  });
}
