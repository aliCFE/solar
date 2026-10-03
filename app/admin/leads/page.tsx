import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { getAdminStats } from "@/lib/adminStats";
import AdminLeadsClient from "@/components/AdminLeadsClient";
import type { LeadDTO } from "@/types";

export default async function AdminLeadsPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const stats = await getAdminStats();
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, slug: true } },
      package: { select: { title: true, priceUSD: true } },
    },
  });

  const dto: LeadDTO[] = leads.map((l) => ({
    id: l.id,
    companyId: l.companyId,
    company: l.company,
    packageId: l.packageId,
    package: l.package,
    customerName: l.customerName,
    customerPhone: l.customerPhone,
    customerCity: l.customerCity,
    assessmentSnapshot: l.assessmentSnapshot,
    roofPlanUrl: l.roofPlanUrl,
    status: l.status,
    commissionNote: l.commissionNote,
    createdAt: l.createdAt.toISOString(),
  }));

  return <AdminLeadsClient initialLeads={dto} stats={stats} />;
}
