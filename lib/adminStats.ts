import { prisma } from "@/lib/db";

export interface AdminStats {
  pendingCompanies: number;
  newLeads: number;
  newDiscovered: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [pendingCompanies, newLeads, newDiscovered] = await Promise.all([
    prisma.company.count({ where: { status: "pending" } }),
    prisma.lead.count({ where: { status: "new" } }),
    prisma.discoveredCompany.count({ where: { status: "new" } }),
  ]);

  return { pendingCompanies, newLeads, newDiscovered };
}
