import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdminSession } from "@/lib/adminAuth";
import AdminPricesClient from "@/components/AdminPricesClient";

export default async function AdminPricesPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const prices = await prisma.productPrice.findMany({
    orderBy: [{ category: "asc" }, { sourceDate: "desc" }],
  });

  const dto = prices.map((p) => ({
    id: p.id,
    category: p.category as "panel" | "battery" | "inverter",
    brand: p.brand,
    model: p.model,
    specValue: p.specValue,
    priceUSD: p.priceUSD,
    includesInstallation: p.includesInstallation,
    source: p.source,
    sourceDate: p.sourceDate.toISOString().slice(0, 10),
    city: p.city,
    isActive: p.isActive,
    notes: p.notes,
  }));

  return <AdminPricesClient initialPrices={dto} />;
}
