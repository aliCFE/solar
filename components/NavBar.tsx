import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";

export default async function NavBar() {
  const companyId = await getSessionCompanyId();
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    : null;

  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold">
          منصة الطاقة الشمسية
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/companies" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            الشركات
          </Link>
          {company ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 font-semibold text-[#1a1200]"
            >
              لوحة {company.name}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                دخول شركة
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 font-semibold text-[#1a1200]"
              >
                سجل شركتك
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
