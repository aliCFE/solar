import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { hashPassword } from "@/lib/password";
import { generateUniqueCompanySlug } from "@/lib/slugify";
import { rateLimitOrNull } from "@/lib/rateLimit";

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { packages: true } } },
  });

  return NextResponse.json(companies);
}

const createSchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة قصير جداً"),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").optional(),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  description: z.string().trim().optional(),
  website: z.string().trim().url("رابط غير صحيح").optional().or(z.literal("")),
});

// Lets the admin onboard a company directly (e.g. a partner they negotiated
// with by phone) without the company self-registering via /register first.
// Skips the pending-review status since the admin is vouching for it.
export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const limited = rateLimitOrNull(req, { key: "admin-create-company", limit: 20, windowMs: 15 * 60_000 });
  if (limited) return limited;

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

  const { name, email, phone, city, description, website } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.company.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "هذا البريد الإلكتروني مسجل مسبقاً" }, { status: 409 });
  }

  // Auto-generate a password if the admin didn't set one, so it can be
  // handed to the company to log in and change it themselves.
  const generatedPassword = parsed.data.password ?? randomBytes(6).toString("base64url");
  const slug = await generateUniqueCompanySlug(name);
  const passwordHash = await hashPassword(generatedPassword);

  const company = await prisma.company.create({
    data: {
      name,
      slug,
      email: normalizedEmail,
      passwordHash,
      phone: phone || null,
      city: city || null,
      description: description || null,
      website: website || null,
      status: "approved",
    },
    include: { _count: { select: { packages: true } } },
  });

  return NextResponse.json({
    id: company.id,
    name: company.name,
    slug: company.slug,
    email: company.email,
    phone: company.phone,
    city: company.city,
    description: company.description,
    website: company.website,
    status: company.status,
    createdAt: company.createdAt.toISOString(),
    packageCount: company._count.packages,
    generatedPassword: parsed.data.password ? undefined : generatedPassword,
  });
}
