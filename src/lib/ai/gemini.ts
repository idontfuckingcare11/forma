const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type FoodEstimate = {
  name: string;
  portionGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  confidence: number;
  notes: string;
};

export type AnalyzeResult =
  | { ok: true; data: FoodEstimate }
  | { ok: false; error: string; notFood?: boolean };

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    is_food: {
      type: "boolean",
      description:
        "True only if the photo clearly shows edible food or a drink.",
    },
    name: {
      type: "string",
      description:
        "Short name of the dish, e.g. 'Grilled chicken with rice'. Max 60 chars.",
    },
    portion_grams: {
      type: "number",
      minimum: 1,
      maximum: 5000,
      description: "Estimated weight of the whole visible serving in grams.",
    },
    kcal_per_100g: {
      type: "number",
      minimum: 0,
      maximum: 950,
      description: "Energy per 100 g as eaten, including oils and sauces.",
    },
    protein_per_100g: { type: "number", minimum: 0, maximum: 100 },
    carbs_per_100g: { type: "number", minimum: 0, maximum: 100 },
    fat_per_100g: { type: "number", minimum: 0, maximum: 100 },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description:
        "How certain you are about food identity and portion, 0 to 1.",
    },
    notes: {
      type: "string",
      description:
        "One short sentence stating key assumptions, e.g. 'assumed grilled, light oil'.",
    },
  },
  required: [
    "is_food",
    "name",
    "portion_grams",
    "kcal_per_100g",
    "protein_per_100g",
    "carbs_per_100g",
    "fat_per_100g",
    "confidence",
    "notes",
  ],
} as const;

const PROMPT = `You are a nutrition analyst for a calorie-tracking app.
Analyze the photo and estimate nutrition for the visible food or drink.

Rules:
- portion_grams is the total weight of ONE realistic serving of what is visible.
- All *_per_100g values are per 100 grams AS EATEN (include visible oil, butter, sauce, dressing).
- Assume plain preparation (grilled/baked, minimal added fat) unless fat or sauce is visible.
- If the photo does not clearly show food or a drink, set is_food to false and leave other fields as best guesses.
- confidence reflects certainty about both identity and portion size.
- notes states your single biggest assumption in one sentence.
- Never invent a brand name.`;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function toFinite(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON.");
  }
}

function httpError(status: number, model: string): string {
  if (status === 400 || status === 404)
    return `Gemini rejected the request — check GEMINI_MODEL ("${model}") in .env.local.`;
  if (status === 401 || status === 403)
    return "Gemini rejected the API key — check GEMINI_API_KEY in .env.local.";
  if (status === 429)
    return "Gemini rate limit reached — wait a minute and try again.";
  if (status >= 500) return "Gemini is temporarily unavailable — try again.";
  return `Gemini request failed (HTTP ${status}).`;
}

export async function analyzeFoodImage(
  imageBase64: string,
  mimeType: string
): Promise<AnalyzeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI analysis is not configured — set GEMINI_API_KEY in .env.local.",
    };
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Analysis timed out — try a smaller photo." };
    }
    return { ok: false, error: "Could not reach Gemini — check your connection." };
  }
  clearTimeout(timer);

  if (!res.ok) return { ok: false, error: httpError(res.status, model) };

  type GeminiResponse = {
    candidates?: {
      content?: { parts?: { text?: string }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };

  let payload: GeminiResponse;
  try {
    payload = (await res.json()) as GeminiResponse;
  } catch {
    return { ok: false, error: "Gemini returned an unreadable response." };
  }

  if (payload.promptFeedback?.blockReason) {
    return { ok: false, error: "The image could not be analyzed — try another photo." };
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) return { ok: false, error: "Gemini returned an empty response." };

  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { ok: false, error: "Could not parse the analysis result." };
  }

  const o = raw as Record<string, unknown>;
  if (o.is_food !== true) {
    return {
      ok: false,
      notFood: true,
      error: "No meal detected in this photo — try a clearer shot of the food.",
    };
  }

  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  if (!name) return { ok: false, error: "Could not identify the food in this photo." };

  const estimate: FoodEstimate = {
    name,
    portionGrams: Math.round(clamp(toFinite(o.portion_grams, 150), 1, 5000)),
    kcalPer100g: Math.round(clamp(toFinite(o.kcal_per_100g, 0), 0, 950)),
    proteinPer100g: Math.round(clamp(toFinite(o.protein_per_100g, 0), 0, 100)),
    carbsPer100g: Math.round(clamp(toFinite(o.carbs_per_100g, 0), 0, 100)),
    fatPer100g: Math.round(clamp(toFinite(o.fat_per_100g, 0), 0, 100)),
    confidence: Math.round(clamp(toFinite(o.confidence, 0.5), 0, 1) * 100) / 100,
    notes: typeof o.notes === "string" ? o.notes.trim().slice(0, 160) : "",
  };

  return { ok: true, data: estimate };
}

// ---------------------------------------------------------
// Text generation (assistant)
// ---------------------------------------------------------

export type ChatMessage = { role: "user" | "model"; text: string };

export type TextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function requireApiKey(): { key: string; model: string } | TextResult {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "AI assistant is not configured — set GEMINI_API_KEY in .env.local.",
    };
  }
  return { key, model: process.env.GEMINI_MODEL || "gemini-3.8-flash" };
}

export async function generateText(
  system: string,
  messages: ChatMessage[]
): Promise<TextResult> {
  const config = requireApiKey();
  if ("ok" in config) return config;
  const { key: apiKey, model } = config;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "The assistant timed out — try again." };
    }
    return { ok: false, error: "Could not reach Gemini — check your connection." };
  }
  clearTimeout(timer);

  if (!res.ok) return { ok: false, error: httpError(res.status, model) };

  type GeminiResponse = {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  let payload: GeminiResponse;
  try {
    payload = (await res.json()) as GeminiResponse;
  } catch {
    return { ok: false, error: "Gemini returned an unreadable response." };
  }

  if (payload.promptFeedback?.blockReason) {
    return { ok: false, error: "The request was blocked — try rephrasing." };
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) return { ok: false, error: "Gemini returned an empty response." };

  return { ok: true, text };
}
