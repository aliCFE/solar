import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminCredentials, createAdminSessionToken, ADMIN_SESSION_COOKIE_NAME, adminSessionCookieOptions } from "@/lib/adminAuth";
import { rateLimitOrNull } from "@/lib/rateLimit";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Stricter than other login limits — this guards the entire admin panel.
  const limited = rateLimitOrNull(req, { key: "admin-login", limit: 8, windowMs: 15 * 60_000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "أدخل اسم مستخدم وكلمة مرور" }, { status: 400 });
  }

  if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken(), adminSessionCookieOptions);
  return res;
}
