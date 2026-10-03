import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/session";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const companyId = await getSessionCompanyId();
  if (!companyId) redirect("/login");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) redirect("/login");

  const [packages, totalLeads, newLeads, wonLeads] = await Promise.all([
    prisma.solarPackage.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({ where: { companyId, status: "new" } }),
    prisma.lead.count({ where: { companyId, status: "won" } }),
  ]);

  return (
    <DashboardClient
      company={{
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        phone: company.phone,
        city: company.city,
        description: company.description,
        website: company.website,
        status: company.status,
      }}
      initialPackages={JSON.parse(JSON.stringify(packages))}
      leadStats={{ total: totalLeads, new: newLeads, won: wonLeads }}
    />
  );
}
