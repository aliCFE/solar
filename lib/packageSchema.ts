import { z } from "zod";

export const packageInputSchema = z.object({
  title: z.string().trim().min(2, "العنوان قصير جداً"),
  description: z.string().trim().optional(),
  systemSizeKW: z.number().positive().optional(),
  panelBrand: z.string().trim().optional(),
  panelWattage: z.number().int().positive().optional(),
  numberOfPanels: z.number().int().positive().optional(),
  inverterBrand: z.string().trim().optional(),
  inverterSizeKW: z.number().positive().optional(),
  batteryBrand: z.string().trim().optional(),
  batteryType: z.string().trim().optional(),
  batteryCapacityKWh: z.number().positive().optional(),
  priceUSD: z.number().positive().optional(),
  warrantyYears: z.number().int().positive().optional(),
  installationIncluded: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type PackageInput = z.infer<typeof packageInputSchema>;
