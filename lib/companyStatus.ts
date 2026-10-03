export const COMPANY_STATUSES = ["pending", "approved", "rejected"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_STATUS_LABELS_AR: Record<CompanyStatus, string> = {
  pending: "قيد المراجعة",
  approved: "موافق عليها",
  rejected: "مرفوضة",
};
