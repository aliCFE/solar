export type BatteryType = "lithium" | "lead-acid";

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  city: string | null;
  description: string | null;
  website: string | null;
  status: string;
}

export interface PackageDTO {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  systemSizeKW: number | null;
  panelBrand: string | null;
  panelWattage: number | null;
  numberOfPanels: number | null;
  inverterBrand: string | null;
  inverterSizeKW: number | null;
  batteryBrand: string | null;
  batteryType: string | null;
  batteryCapacityKWh: number | null;
  priceUSD: number | null;
  warrantyYears: number | null;
  installationIncluded: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  media: MediaDTO[];
}

export interface PublicPackageDTO extends PackageDTO {
  company: { name: string; slug: string; city: string | null };
}

export interface LeadDTO {
  id: string;
  companyId: string;
  company: { name: string; slug: string };
  packageId: string | null;
  package: { title: string; priceUSD: number | null } | null;
  customerName: string;
  customerPhone: string;
  customerCity: string | null;
  assessmentSnapshot: string | null;
  roofPlanUrl: string | null;
  status: string;
  commissionNote: string | null;
  createdAt: string;
}

export interface DiscoveredCompanyDTO {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  source: string;
  status: string;
  notes: string | null;
  linkedCompanyId: string | null;
  discoveredAt: string;
}

export interface MediaDTO {
  id: string;
  packageId: string;
  type: "image" | "video-url";
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface AdminCompanyDTO {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  city: string | null;
  description: string | null;
  website: string | null;
  status: string;
  createdAt: string;
  packageCount: number;
}

export type RoofOrientation = "south" | "southeast" | "southwest" | "east" | "west" | "north" | "flat" | "unknown";

export type ReservedCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none";

export interface PanelLayoutInput {
  roofWidthM: number;
  roofLengthM: number;
  numberOfPanels: number;
  panelWattage: number;
  inverterSizeKW: number;
  roofOrientation: RoofOrientation;
}

export interface PanelLayout {
  panelWidthM: number;
  panelLengthM: number;
  panelOrientation: "portrait" | "landscape";
  rows: number;
  columns: number;
  reservedCorner: ReservedCorner;
  reservedRows: number;
  reservedColumns: number;
  panelsPlaced: number;
  fitsAllPanels: boolean;
  obstructionSource: "image" | "assumed";
  stringGroups: number[];
  electricalNotes: string[];
  layoutSummaryAr: string;
}

export interface AssessmentInput {
  homeAreaSqm: number;
  monthlyConsumptionKWh: number;
  latitude: number;
  longitude: number;
  locationLabel: string;
  batteryAutonomyDays: number;
  preferredBatteryType: BatteryType | "auto";
  roofOrientation: RoofOrientation;
  roofPlanUrl?: string | null;
  roofWidthM?: number | null;
  roofLengthM?: number | null;
}

export interface MonthlyIrradiance {
  month: string;
  peakSunHours: number;
}

export interface AssessmentResult {
  input: AssessmentInput;
  irradiance: {
    monthly: MonthlyIrradiance[];
    worstMonth: MonthlyIrradiance;
    averagePeakSunHours: number;
  };
  system: {
    dailyConsumptionKWh: number;
    recommendedSystemSizeKW: number;
    panelWattage: number;
    numberOfPanels: number;
    actualSystemSizeKW: number;
    roofAreaNeededSqm: number;
    roofAreaSufficient: boolean;
    inverterSizeKW: number;
    batteryType: BatteryType;
    batteryCapacityKWh: number;
    batteryUsableCapacityKWh: number;
    estimatedPanelCostUSD: [number, number];
    estimatedBatteryCostUSD: [number, number];
    estimatedInverterCostUSD: [number, number];
    estimatedTotalCostUSD: [number, number];
    orientationFactor: number;
    areaSource: "plan" | "manual";
    notes: string[];
  };
}

export interface ExtractedQuote {
  supplierName: string | null;
  panelBrand: string | null;
  panelWattage: number | null;
  numberOfPanels: number | null;
  totalPanelCapacityKW: number | null;
  inverterBrand: string | null;
  inverterSizeKW: number | null;
  batteryBrand: string | null;
  batteryType: string | null;
  batteryCapacityKWh: number | null;
  totalPriceUSD: number | null;
  currency: string | null;
  warrantyYears: number | null;
  installationIncluded: boolean | null;
  additionalItems: string[];
  rawNotes: string;
}

export interface QuoteAnalysis {
  id: string;
  fileName: string;
  extracted: ExtractedQuote;
  verdict: "good-fit" | "over-sized" | "under-sized" | "overpriced" | "needs-review";
  summary: string;
  strengths: string[];
  weaknesses: string[];
  matchScorePercent: number;
}

export interface ComparisonResult {
  recommendationId: string;
  overallSummary: string;
  rankings: {
    id: string;
    rank: number;
    scoreOutOf10: number;
    strengths: string[];
    weaknesses: string[];
  }[];
}
