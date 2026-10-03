export interface CityPreset {
  label: string;
  latitude: number;
  longitude: number;
}

export const IRAQ_CITY_PRESETS: CityPreset[] = [
  { label: "بغداد", latitude: 33.3152, longitude: 44.3661 },
  { label: "البصرة", latitude: 30.5081, longitude: 47.7835 },
  { label: "الموصل", latitude: 36.3489, longitude: 43.1577 },
  { label: "أربيل", latitude: 36.191, longitude: 44.0093 },
  { label: "النجف", latitude: 31.9958, longitude: 44.3245 },
  { label: "كربلاء", latitude: 32.6149, longitude: 44.0246 },
  { label: "السليمانية", latitude: 35.5647, longitude: 45.4164 },
  { label: "الناصرية", latitude: 31.0578, longitude: 46.2581 },
  { label: "الرمادي", latitude: 33.4207, longitude: 43.3006 },
  { label: "كركوك", latitude: 35.4681, longitude: 44.3922 },
  { label: "دهوك", latitude: 36.8642, longitude: 42.9989 },
  { label: "الديوانية", latitude: 31.9889, longitude: 44.9247 },
];
