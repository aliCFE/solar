import type { MonthlyIrradiance } from "@/types";

const MONTH_KEYS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_LABELS_AR = [
  "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
  "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
];

// Fallback used only if the NASA POWER API is unreachable (e.g. offline dev).
// Rough global-average peak sun hours; real requests always try the API first.
const FALLBACK_PSH = 4.5;

interface NasaPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: Record<string, number>;
    };
  };
}

/**
 * Fetches climatological (long-term monthly average) solar irradiance for a
 * location from NASA POWER, in kWh/m^2/day — numerically equal to "peak sun
 * hours" per day, which is the standard unit for off-grid PV sizing.
 */
export async function getMonthlyPeakSunHours(
  latitude: number,
  longitude: number
): Promise<MonthlyIrradiance[]> {
  const url = new URL("https://power.larc.nasa.gov/api/temporal/climatology/point");
  url.searchParams.set("parameters", "ALLSKY_SFC_SW_DWN");
  url.searchParams.set("community", "RE");
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("format", "JSON");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
    const data: NasaPowerResponse = await res.json();
    const values = data.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    if (!values) throw new Error("Unexpected NASA POWER response shape");

    return MONTH_KEYS.map((key, i) => ({
      month: MONTH_LABELS_AR[i],
      peakSunHours: Number(values[key]?.toFixed(2) ?? FALLBACK_PSH),
    }));
  } catch {
    return MONTH_KEYS.map((_, i) => ({
      month: MONTH_LABELS_AR[i],
      peakSunHours: FALLBACK_PSH,
    }));
  }
}
