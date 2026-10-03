import { timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE_NAME = "solar_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET غير معرف. أضفه بمتغيرات البيئة قبل النشر.");
    }
    return "dev-only-insecure-secret-do-not-use-in-production";
  }
  return secret;
}

function safeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) return false;
  return safeStringEqual(username, expectedUsername) && safeStringEqual(password, expectedPassword);
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createAdminSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ admin: true, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return data.admin === true;
  } catch {
    return false;
  }
}

export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
};
