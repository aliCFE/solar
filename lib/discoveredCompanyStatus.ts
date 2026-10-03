export const DISCOVERED_STATUSES = ["new", "contacted", "negotiating", "converted", "declined"] as const;
export type DiscoveredStatus = (typeof DISCOVERED_STATUSES)[number];

export const DISCOVERED_STATUS_LABELS_AR: Record<DiscoveredStatus, string> = {
  new: "جديدة",
  contacted: "تم التواصل",
  negotiating: "قيد التفاوض",
  converted: "انضمت كشركة مسجلة",
  declined: "اعتذرت / رفضنا",
};
