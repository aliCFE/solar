import { z } from "zod";
import { callAi, extractJson } from "@/lib/aiProvider";

const SERPER_ENDPOINT = "https://google.serper.dev/search";

interface RawSearchResult {
  title: string;
  url: string;
  content: string;
}

const candidateSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  city: z.string().nullable(),
});
export type DiscoveredCandidate = z.infer<typeof candidateSchema>;

// Rotate the query each run so repeated clicks surface different slices of
// the market instead of the same top results every time.
const SEARCH_QUERIES = [
  "شركات تركيب انظمة الطاقة الشمسية في العراق",
  "افضل شركات الالواح الشمسية بغداد البصرة اربيل",
  "solar panel installation company Iraq contact",
  "شركة طاقة شمسية عراقية اسعار تركيب",
];

async function fetchSearchResults(query: string): Promise<RawSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY غير معرف. سجل حساب مجاني بـ serper.dev وخذ مفتاح API وحطه بملف .env.local عشان يشتغل البحث التلقائي."
    );
  }

  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ q: query, num: 10 }),
  });

  if (!res.ok) {
    throw new Error(`فشل طلب البحث (رمز ${res.status})`);
  }

  const data = await res.json();
  const results = Array.isArray(data.organic) ? data.organic : [];
  return results.map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    content: r.snippet ?? "",
  }));
}

async function extractCompaniesFromResults(results: RawSearchResult[]): Promise<DiscoveredCandidate[]> {
  if (results.length === 0) return [];

  const text = await callAi({
    system:
      "انت مساعد بحث تجاري. تستلم نتائج بحث ويب خام وتستخرج منها فقط شركات حقيقية تعمل بمجال تركيب أو بيع أنظمة الطاقة الشمسية بالعراق. تجاهل أي نتيجة مو شركة فعلية (مقالات، أخبار عامة، منتديات، منصات تسوق عامة). لا تخترع معلومة غير مذكورة صراحة بالنص — استخدم null. جاوب بصيغة JSON فقط بدون أي نص إضافي.",
    // Same reasoning-token-budget issue as the solar-sizing and panel-layout
    // calls: Kimi burns most of a small budget on internal reasoning before
    // ever emitting the JSON, so this needs real headroom too.
    maxTokens: 8000,
    userText: `نتائج البحث:\n${JSON.stringify(results, null, 2)}\n\nطلع مصفوفة JSON بهذا الشكل بالضبط:\n[{"name": string, "phone": string | null, "website": string | null, "city": string | null}]\n\nإذا ما فيه أي شركة حقيقية بالنتائج، رجع مصفوفة فارغة [].`,
  });

  const parsed = extractJson<unknown>(text);
  const validated = z.array(candidateSchema).safeParse(parsed);
  return validated.success ? validated.data : [];
}

export async function discoverNewCompanies(): Promise<DiscoveredCandidate[]> {
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
  const results = await fetchSearchResults(query);
  return extractCompaniesFromResults(results);
}
