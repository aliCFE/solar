import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AiProviderName = "anthropic" | "kimi";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_KIMI_MODEL = "kimi-k3";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * Which provider is active is decided by which API key is present — Kimi
 * takes priority since it's OpenAI-compatible and cheaper to test with, but
 * either can be swapped in by setting/removing the corresponding key. No
 * feature code should import a specific vendor SDK directly; go through
 * callAi() below so switching providers never touches the feature files.
 */
export function getActiveProvider(): AiProviderName {
  if (process.env.KIMI_API_KEY) return "kimi";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    "ما فيه مفتاح AI معرف. أضف KIMI_API_KEY أو ANTHROPIC_API_KEY بملف .env.local عشان تشتغل ميزات الذكاء الاصطناعي."
  );
}

export interface AiImageInput {
  base64: string;
  mediaType: string; // e.g. "image/png", "image/jpeg", "application/pdf"
}

interface AiCallOptions {
  system: string;
  userText: string;
  image?: AiImageInput;
  maxTokens?: number;
}

let anthropicClient: Anthropic | null = null;
let kimiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getKimiClient(): OpenAI {
  if (!kimiClient) {
    kimiClient = new OpenAI({ apiKey: process.env.KIMI_API_KEY, baseURL: KIMI_BASE_URL });
  }
  return kimiClient;
}

async function callAnthropic({ system, userText, image, maxTokens = 1536 }: AiCallOptions): Promise<string> {
  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  > = [];

  if (image) {
    if (image.mediaType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: image.base64 } });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: image.mediaType as "image/jpeg" | "image/png" | "image/webp", data: image.base64 },
      });
    }
  }
  content.push({ type: "text", text: userText });

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("لم يرجع النموذج نص");
  return textBlock.text;
}

async function callKimi({ system, userText, image, maxTokens = 1536 }: AiCallOptions): Promise<string> {
  if (image?.mediaType === "application/pdf") {
    throw new Error("Kimi ما يدعم ملفات PDF مباشرة بهذا الإعداد — ارفع صورة (JPG/PNG/WebP) بدل PDF.");
  }

  const client = getKimiClient();
  const model = process.env.KIMI_MODEL || DEFAULT_KIMI_MODEL;

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (image) {
    content.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } });
  }
  content.push({ type: "text", text: userText });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("لم يرجع النموذج نص");
  return text;
}

// Kimi's account tier only allows 1 concurrent request org-wide — a second
// call that overlaps with one still in flight gets rejected instantly with a
// 429 ("max organization concurrency: 1"), which our error handling then
// silently turned into a fast, wrong-looking fallback to the deterministic
// engine. Queuing every AI call here (any provider, in-memory/per-process —
// same scope as lib/rateLimit.ts) makes them run one at a time instead of
// racing, so a second feature call waits its turn instead of failing.
let queueTail: Promise<unknown> = Promise.resolve();

export function callAi(options: AiCallOptions): Promise<string> {
  const provider = getActiveProvider();
  const run = () => (provider === "kimi" ? callKimi(options) : callAnthropic(options));
  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/**
 * Extracts the first top-level JSON object/array from a model response,
 * tolerating stray prose or markdown code fences around it.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("لم يتم العثور على JSON بالرد");
  const trimmed = candidate.slice(start);
  return JSON.parse(trimmed) as T;
}
