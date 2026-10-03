import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { discoverNewCompanies } from "@/lib/companySearch";
import { rateLimitOrNull } from "@/lib/rateLimit";

function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.trim().toLowerCase().replace(/\/+$/, "").replace(/^https?:\/\//, "");
}

export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Admin-only already, but still costs a Tavily search + an AI extraction
  // call each time — guard against rapid double-clicks running up the bill.
  const limited = rateLimitOrNull(req, { key: "discovered-search", limit: 5, windowMs: 10 * 60_000 });
  if (limited) return limited;

  let candidates;
  try {
    candidates = await discoverNewCompanies();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "فشل البحث" }, { status: 500 });
  }

  const [existingDiscovered, existingCompanies] = await Promise.all([
    prisma.discoveredCompany.findMany({ select: { name: true, website: true } }),
    prisma.company.findMany({ select: { name: true, website: true } }),
  ]);

  const knownNames = new Set(
    [...existingDiscovered, ...existingCompanies].map((c) => c.name.trim().toLowerCase())
  );
  const knownSites = new Set(
    [...existingDiscovered, ...existingCompanies].map((c) => normalizeWebsite(c.website)).filter(Boolean)
  );

  const toInsert = candidates.filter((c) => {
    const nameKey = c.name.trim().toLowerCase();
    const siteKey = normalizeWebsite(c.website);
    if (knownNames.has(nameKey)) return false;
    if (siteKey && knownSites.has(siteKey)) return false;
    return true;
  });

  const created = await Promise.all(
    toInsert.map((c) =>
      prisma.discoveredCompany.create({
        data: {
          name: c.name,
          phone: c.phone,
          website: c.website,
          city: c.city,
          source: "web_search",
        },
      })
    )
  );

  return NextResponse.json({
    added: created.length,
    skipped: candidates.length - toInsert.length,
    companies: created,
  });
}
