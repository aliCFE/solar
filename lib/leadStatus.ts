export const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS_AR: Record<LeadStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  quoted: "أُرسل عرض",
  won: "تم البيع",
  lost: "خسرنا الصفقة",
};
