import { prisma } from "@/lib/db";

function baseSlugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "company";
}

export async function generateUniqueCompanySlug(name: string): Promise<string> {
  const base = baseSlugify(name);
  let candidate = base;
  let suffix = 1;

  while (await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}
