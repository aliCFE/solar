import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { getAdminStats } from "@/lib/adminStats";
import AdminDiscoveredClient from "@/components/AdminDiscoveredClient";
import type { DiscoveredCompanyDTO } from "@/types";

export default async function AdminDiscoveredPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const stats = await getAdminStats();
  const companies = await prisma.discoveredCompany.findMany({
    orderBy: { discoveredAt: "desc" },
  });

  const dto: DiscoveredCompanyDTO[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    website: c.website,
    city: c.city,
    source: c.source,
    status: c.status,
    notes: c.notes,
    linkedCompanyId: c.linkedCompanyId,
    discoveredAt: c.discoveredAt.toISOString(),
  }));

  return <AdminDiscoveredClient initialCompanies={dto} stats={stats} />;
}
