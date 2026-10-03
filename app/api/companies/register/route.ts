import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { generateUniqueCompanySlug } from "@/lib/slugify";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { rateLimitOrNull } from "@/lib/rateLimit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "اسم الشركة قصير جداً"),
  email: z.string().trim().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  phone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  description: z.string().trim().optional(),
  website: z.string().trim().url("رابط غير صحيح").optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "register", limit: 5, windowMs: 60 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const { name, email, password, phone, city, description, website } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.company.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "هذا البريد الإلكتروني مسجل مسبقاً" }, { status: 409 });
  }

  const slug = await generateUniqueCompanySlug(name);
  const passwordHash = await hashPassword(password);

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
    },
  });

  const res = NextResponse.json({ id: company.id, name: company.name, slug: company.slug });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(company.id), sessionCookieOptions);
  return res;
}
