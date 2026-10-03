import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { rateLimitOrNull } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const limited = rateLimitOrNull(req, { key: "company-login", limit: 10, windowMs: 15 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل بريد إلكتروني وكلمة مرور صحيحين" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  const genericError = () =>
    NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 401 });

  if (!company) return genericError();

  const valid = await verifyPassword(parsed.data.password, company.passwordHash);
  if (!valid) return genericError();

  const res = NextResponse.json({ id: company.id, name: company.name, slug: company.slug });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(company.id), sessionCookieOptions);
  return res;
}
