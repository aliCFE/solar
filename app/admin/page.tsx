import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import { getAdminStats } from "@/lib/adminStats";
import AdminClient from "@/components/AdminClient";
import type { AdminCompanyDTO } from "@/types";

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const stats = await getAdminStats();
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { packages: true } } },
  });

  const dto: AdminCompanyDTO[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    email: c.email,
    phone: c.phone,
    city: c.city,
    description: c.description,
    website: c.website,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    packageCount: c._count.packages,
  }));

  return <AdminClient initialCompanies={dto} stats={stats} />;
}
