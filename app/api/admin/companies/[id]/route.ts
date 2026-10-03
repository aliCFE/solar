import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { COMPANY_STATUSES } from "@/lib/companyStatus";

const statusSchema = z.object({
  status: z.enum(COMPANY_STATUSES),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
  }

  const company = await prisma.company.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(company);
}
