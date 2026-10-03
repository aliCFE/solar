import Link from "next/link";
import { prisma } from "@/lib/db";
import AdSlot from "@/components/AdSlot";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    where: { status: "approved" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { packages: { where: { isActive: true } } } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-xl font-bold">الشركات المسجلة</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        تصفح شركات الطاقة الشمسية المسجلة بالمنصة وباقاتها المنشورة.
      </p>

      {companies.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          ما فيه شركات مسجلة بعد.{" "}
          <Link href="/register" className="text-[var(--color-accent)] underline">
            كن أول شركة تسجل
          </Link>
        </p>
      )}

      <div className="space-y-3">
        {companies.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.slug}`}
            className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {c._count.packages} باقة منشورة
              </div>
            </div>
            {c.city && <div className="mt-1 text-sm text-[var(--color-text-muted)]">{c.city}</div>}
            {c.description && <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-muted)]">{c.description}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <AdSlot slot="9876543210" />
      </div>
    </main>
  );
}
