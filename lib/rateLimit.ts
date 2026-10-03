import { NextResponse } from "next/server";

interface Bucket {
  timestamps: number[];
}

// In-memory, per-process store. Correct for a single long-running Node
// server (npm run dev / npm start), which is what this project targets.
// If this ever moves to a serverless/multi-instance deployment (e.g. Vercel
// functions), each instance gets its own memory and limits won't be shared
// across them — swap this for a shared store (Upstash Redis / Vercel KV) at
// that point.
const buckets = new Map<string, Bucket>();

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - bucket.timestamps[0])) / 1000);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Checks the rate limit for this request and returns a ready-to-return 429
 * response if it's exceeded, or null if the request should proceed. Usage:
 *
 *   const limited = rateLimitOrNull(req, { key: "assess", limit: 8, windowMs: 15 * 60_000 });
 *   if (limited) return limited;
 */
export function rateLimitOrNull(
  req: Request,
  opts: { key: string; limit: number; windowMs: number }
): NextResponse | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${opts.key}:${ip}`, opts.limit, opts.windowMs);
  if (result.allowed) return null;

  const minutes = Math.ceil((result.retryAfterSeconds ?? 60) / 60);
  return NextResponse.json(
    {
      error: `تجاوزت الحد المسموح من الطلبات. حاول مرة ثانية بعد ${
        minutes <= 1 ? "دقيقة تقريباً" : `${minutes} دقائق تقريباً`
      }.`,
    },
    {
      status: 429,
      headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined,
    }
  );
}
