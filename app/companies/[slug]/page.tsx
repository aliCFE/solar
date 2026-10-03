import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import RequestOfferModal from "@/components/RequestOfferModal";
import PackageMediaGallery from "@/components/PackageMediaGallery";

export default async function CompanyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  // Next.js passes non-ASCII dynamic segments still percent-encoded rather than decoded.
  const slug = decodeURIComponent(rawSlug);

  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      packages: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        include: { media: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!company) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h1 className="text-xl font-bold">{company.name}</h1>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--color-text-muted)]">
          {company.city && <span>{company.city}</span>}
        </div>
        {company.description && <p className="mt-3 text-sm">{company.description}</p>}
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          ما ننشر رقم أو إيميل الشركة مباشرة — اطلب أي عرض من أزرار &quot;اطلب هذا العرض عبر المنصة&quot; وفريقنا يربطكم.
        </p>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-bold">الباقات المتوفرة ({company.packages.length})</h2>

      {company.packages.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">هذه الشركة ما نشرت باقات بعد.</p>
      )}

      <div className="space-y-3">
        {company.packages.map((pkg) => (
          <div key={pkg.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            {pkg.media.length > 0 && <PackageMediaGallery media={pkg.media} />}
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{pkg.title}</div>
              {pkg.priceUSD && <div className="font-bold text-[var(--color-accent-2)]">${pkg.priceUSD.toLocaleString()}</div>}
            </div>
            {pkg.description && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pkg.description}</p>}
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] sm:grid-cols-4">
              {pkg.systemSizeKW && <div>النظام: {pkg.systemSizeKW} kW</div>}
              {pkg.numberOfPanels && (
                <div>
                  الألواح: {pkg.numberOfPanels} × {pkg.panelWattage ?? "؟"}W {pkg.panelBrand ? `(${pkg.panelBrand})` : ""}
                </div>
              )}
              {pkg.inverterSizeKW && (
                <div>
                  الانفيرتر: {pkg.inverterSizeKW} kW {pkg.inverterBrand ? `(${pkg.inverterBrand})` : ""}
                </div>
              )}
              {pkg.batteryCapacityKWh && (
                <div>
                  البطارية: {pkg.batteryCapacityKWh} kWh {pkg.batteryType ? `(${pkg.batteryType})` : ""}
                </div>
              )}
              {pkg.warrantyYears && <div>الضمان: {pkg.warrantyYears} سنوات</div>}
              <div>{pkg.installationIncluded ? "التركيب شامل" : "بدون تركيب"}</div>
            </div>
            <div className="mt-3">
              <RequestOfferModal companyId={company.id} companyName={company.name} packageId={pkg.id} packageTitle={pkg.title} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
