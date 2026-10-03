import type { AssessmentResult, PublicPackageDTO } from "@/types";

export interface PackageMatch {
  package: PublicPackageDTO;
  score: number;
  reasons: string[];
  warnings: string[];
}

function packageSystemSizeKW(pkg: PublicPackageDTO): number | null {
  if (pkg.systemSizeKW) return pkg.systemSizeKW;
  if (pkg.numberOfPanels && pkg.panelWattage) return (pkg.numberOfPanels * pkg.panelWattage) / 1000;
  return null;
}

/**
 * Deterministic 0-100 match score between a published company package and a
 * customer's calculated requirement. Kept rule-based (not AI) since both
 * sides are already structured data — reliable and doesn't need an API key.
 */
export function scorePackage(pkg: PublicPackageDTO, requirement: AssessmentResult): PackageMatch {
  const { system } = requirement;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  const pkgSize = packageSystemSizeKW(pkg);
  if (pkgSize == null) {
    score -= 15;
    warnings.push("الشركة ما حددت حجم النظام بدقة");
  } else if (pkgSize < system.actualSystemSizeKW * 0.9) {
    const deficit = Math.round((1 - pkgSize / system.actualSystemSizeKW) * 100);
    score -= 30;
    warnings.push(`حجم النظام أصغر من احتياجك بنسبة ${deficit}%`);
  } else if (pkgSize > system.actualSystemSizeKW * 1.3) {
    score -= 8;
    reasons.push("حجم النظام أكبر من احتياجك (هامش أمان إضافي، لكن كلفة أعلى)");
  } else {
    score += 10;
    reasons.push(`حجم النظام (${pkgSize.toFixed(1)} kW) مطابق لاحتياجك (${system.actualSystemSizeKW} kW)`);
  }

  if (pkg.inverterSizeKW == null) {
    score -= 5;
  } else if (pkg.inverterSizeKW < system.inverterSizeKW) {
    score -= 15;
    warnings.push(`الانفيرتر (${pkg.inverterSizeKW} kW) أصغر من المطلوب (${system.inverterSizeKW} kW)`);
  } else {
    reasons.push("حجم الانفيرتر يغطي احتياجك");
  }

  if (pkg.batteryCapacityKWh == null) {
    score -= 5;
    warnings.push("ما فيه معلومات عن سعة البطارية");
  } else if (pkg.batteryCapacityKWh < system.batteryCapacityKWh * 0.85) {
    score -= 20;
    warnings.push(`سعة البطارية (${pkg.batteryCapacityKWh} kWh) أقل من احتياجك (${system.batteryCapacityKWh} kWh)`);
  } else {
    score += 8;
    reasons.push("سعة البطارية تغطي أيام الاستقلالية اللي طلبتها");
  }

  if (pkg.priceUSD == null) {
    score -= 5;
    warnings.push("الشركة ما حددت سعر واضح");
  } else {
    const [lo, hi] = system.estimatedTotalCostUSD;
    if (pkg.priceUSD <= hi) {
      const savingsPct = Math.round((1 - pkg.priceUSD / hi) * 100);
      score += pkg.priceUSD <= lo ? 15 : 8;
      reasons.push(
        pkg.priceUSD <= lo
          ? `السعر ($${pkg.priceUSD.toLocaleString()}) أقل من التقدير المتوقع`
          : `السعر ($${pkg.priceUSD.toLocaleString()}) ضمن النطاق المتوقع${savingsPct > 0 ? ` (أوفر بـ${savingsPct}% من أعلى تقدير)` : ""}`
      );
    } else {
      const overPct = Math.round((pkg.priceUSD / hi - 1) * 100);
      score -= Math.min(25, overPct);
      warnings.push(`السعر أعلى من التقدير المتوقع بنسبة ${overPct}%`);
    }
  }

  if (pkg.warrantyYears) {
    if (pkg.warrantyYears >= 10) {
      score += 5;
      reasons.push(`ضمان طويل (${pkg.warrantyYears} سنة)`);
    } else if (pkg.warrantyYears < 5) {
      score -= 5;
      warnings.push("فترة الضمان قصيرة نسبياً");
    }
  }

  if (pkg.installationIncluded) {
    score += 5;
    reasons.push("التركيب شامل بالسعر");
  }

  return {
    package: pkg,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    warnings,
  };
}

export function rankPackages(packages: PublicPackageDTO[], requirement: AssessmentResult): PackageMatch[] {
  return packages.map((p) => scorePackage(p, requirement)).sort((a, b) => b.score - a.score);
}
