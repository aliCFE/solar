import { prisma } from "@/lib/db";

export type PriceCategory = "panel" | "battery" | "inverter";

export interface PriceAnchor {
  brand: string | null;
  model: string | null;
  specValue: number;
  priceUSD: number;
  includesInstallation: boolean;
  source: string;
  sourceDate: string;
  city: string | null;
}

// How close a stored price's spec has to be to the target spec to count as
// relevant (e.g. a panel priced at 500W is still a reasonable anchor for a
// 550W estimate; a 100W panel isn't).
const SPEC_TOLERANCE_RATIO = 0.25;

/**
 * Looks up admin-entered, source-tracked prices near the given spec value.
 * Returns nothing fabricated — only real entries someone verified and dated.
 * Used to anchor cost estimates to actual Iraqi-market data instead of an AI
 * model's unverified general knowledge, per the "no invented supplier prices"
 * rule this project runs on.
 */
export async function findPriceAnchors(category: PriceCategory, specValue: number): Promise<PriceAnchor[]> {
  const lo = specValue * (1 - SPEC_TOLERANCE_RATIO);
  const hi = specValue * (1 + SPEC_TOLERANCE_RATIO);

  const rows = await prisma.productPrice.findMany({
    where: { category, isActive: true, specValue: { gte: lo, lte: hi } },
    orderBy: { sourceDate: "desc" },
    take: 5,
  });

  return rows.map((r) => ({
    brand: r.brand,
    model: r.model,
    specValue: r.specValue,
    priceUSD: r.priceUSD,
    includesInstallation: r.includesInstallation,
    source: r.source,
    sourceDate: r.sourceDate.toISOString().slice(0, 10),
    city: r.city,
  }));
}

export async function findAllPriceAnchors(panelWattage: number, batteryCapacityKWh: number, inverterSizeKW: number) {
  const [panels, batteries, inverters] = await Promise.all([
    findPriceAnchors("panel", panelWattage),
    findPriceAnchors("battery", batteryCapacityKWh),
    findPriceAnchors("inverter", inverterSizeKW),
  ]);
  return { panels, batteries, inverters };
}

/** Human-readable block to splice into the AI prompt when real anchors exist. */
export function formatAnchorsForPrompt(anchors: { panels: PriceAnchor[]; batteries: PriceAnchor[]; inverters: PriceAnchor[] }): string {
  const lines: string[] = [];
  const section = (label: string, rows: PriceAnchor[], unit: string) => {
    if (rows.length === 0) return;
    lines.push(`${label} (أسعار حقيقية موثقة من الإدارة، استخدمها كمرجع أساسي بدل معرفتك العامة):`);
    for (const r of rows) {
      lines.push(
        `- ${r.brand ?? "بدون ماركة"} ${r.model ?? ""} (${r.specValue}${unit}): $${r.priceUSD}${r.includesInstallation ? " شامل التركيب" : ""} — المصدر: ${r.source}، بتاريخ ${r.sourceDate}${r.city ? `، ${r.city}` : ""}`
      );
    }
  };
  section("أسعار ألواح", anchors.panels, "W");
  section("أسعار بطاريات", anchors.batteries, "kWh");
  section("أسعار انفيرترات", anchors.inverters, "kW");

  if (lines.length === 0) {
    return "ما فيه أسعار عراقية موثقة مسجلة بالنظام قريبة من هذا الحجم — استخدم تقدير عام واضح أنه تقريبي، ولا تدّعي دقة أعلى مما تملك.";
  }
  return lines.join("\n");
}
