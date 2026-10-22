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
  servingUnit?: string;
  servingWeightGrams?: number;
  servingCount?: number;
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
        "True only if the photo clearly shows edible food, drink, or a nutrition facts label.",
    },
    name: {
      type: "string",
      description:
        "Short name of the dish or product, e.g. 'Whey protein isolate powder'. Max 60 chars.",
    },
    portion_grams: {
      type: "number",
      minimum: 1,
      maximum: 5000,
      description: "Total weight of ONE full labeled serving or whole visible dish in grams (e.g. 31g for a 3-scoop serving).",
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
        "One short sentence stating key assumptions or nutrition facts label details.",
    },
    serving_unit: {
      type: "string",
      description:
        "The discrete singular unit name if known (lowercase singular, e.g. 'scoop', 'slice', 'piece', 'cookie', 'bar', 'can', 'bottle', 'cup', 'serving').",
    },
    units_per_serving: {
      type: "number",
      minimum: 0.1,
      maximum: 500,
      description:
        "How many discrete units constitute 1 labeled serving. For example: if the label says 'About 3 Scoops (31g)', this is 3. If '2 Slices (56g)', this is 2. If '1 Scoop (30g)', this is 1. If not specified or cooked meal on plate, default to 1.",
    },
    serving_weight_grams: {
      type: "number",
      minimum: 0.1,
      maximum: 5000,
      description:
        "Weight in grams of ONE SINGLE INDIVIDUAL UNIT. CRITICAL: If 3 scoops = 31g, ONE scoop is 31 / 3 = 10.33g! NEVER set this to 31g when 3 scoops = 31g.",
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

const PROMPT = `You are a world-class, highly precise nutrition analyst for a calorie-tracking app.
Analyze the photo and accurately extract or estimate nutrition for the visible food, drink, or packaged Nutrition Facts / Supplement Facts label.

CRITICAL RULES FOR NUTRITION FACTS & SUPPLEMENT FACTS LABELS:
- READ THE "Serving size" CAREFULLY:
  * If the label states multi-unit servings like "About 3 Scoops (31g)", "2 Slices (56g)", "4 Cookies (40g)", or "15 Crackers (30g)":
    - serving_unit: The singular unit (e.g. 'scoop', 'slice', 'cookie', 'cracker').
    - units_per_serving: The exact number of units in that serving (e.g. 3 for "About 3 Scoops (31g)", 2 for "2 Slices (56g)").
    - serving_weight_grams: The weight in grams of ONE INDIVIDUAL UNIT = (total serving weight in grams) / (units_per_serving).
      * CRITICAL: For "About 3 Scoops (31g)", 1 scoop = 31 / 3 = 10.33 grams. NEVER output 31g for 1 scoop! 31g is for 3 scoops!
    - portion_grams: The full labeled serving weight in grams (e.g. 31 for 3 scoops).
    - notes: State the serving details clearly (e.g. 'Values calculated from nutrition facts label showing 120 kcal per 31g serving (3 scoops @ ~10.3g each)').
  * If the label states a single unit serving like "1 Scoop (30g)" or "1 Bar (60g)":
    - serving_unit: 'scoop', 'bar', etc.
    - units_per_serving: 1.
    - serving_weight_grams: weight of 1 unit (e.g. 30).
    - portion_grams: 30.
- Calculate nutrition values per 100 grams:
  * kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g must be computed accurately from the label's per-serving values divided by the total serving weight in grams * 100.
  * Example: 120 kcal for 31g -> (120 / 31) * 100 = 387 kcal per 100g. 24g protein for 31g -> (24 / 31) * 100 = 77.4g per 100g.

RULES FOR MEAL / FOOD PHOTOS (NO LABEL):
- Estimate total portion weight in portion_grams.
- serving_unit: 'serving', 'bowl', 'slice', 'piece', 'cup', etc.
- units_per_serving: 1.
- serving_weight_grams: same as portion_grams (or weight of 1 piece/slice if countable).
- All *_per_100g values are per 100 grams AS EATEN (include visible oil, butter, sauce, dressing).
- Assume plain preparation unless fat or sauce is visible.
- If the photo does not clearly show food, drink, or a nutrition facts label, set is_food to false.
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

  const portionGrams = Math.round(clamp(toFinite(o.portion_grams, 150), 1, 5000));
  const rawNotes = typeof o.notes === "string" ? o.notes.trim().slice(0, 160) : "";

  // Smart unit, units_per_serving, and serving weight inference
  let servingUnit =
    typeof o.serving_unit === "string" && o.serving_unit.trim()
      ? o.serving_unit.trim().toLowerCase().slice(0, 30)
      : "";
  let unitsPerServing =
    typeof o.units_per_serving === "number" && Number.isFinite(o.units_per_serving)
      ? clamp(o.units_per_serving, 0.1, 500)
      : 1;
  let servingWeight =
    typeof o.serving_weight_grams === "number" && Number.isFinite(o.serving_weight_grams)
      ? clamp(o.serving_weight_grams, 0.1, 5000)
      : 0;

  function parseNum(str: string): number {
    if (!str) return 0;
    const trimmed = str.trim();
    if (trimmed.includes("/")) {
      const parts = trimmed.split("/");
      const nom = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (Number.isFinite(nom) && Number.isFinite(den) && den > 0) {
        return Math.round((nom / den) * 100) / 100;
      }
    }
    const val = parseFloat(trimmed);
    return Number.isFinite(val) ? val : 0;
  }

  // Search for multi-unit patterns in notes (e.g. "per 31g serving (3 scoops)", "about 3 scoops (31g)", "1/2 cup (120g)", "3 scoops @ 10.3g")
  const combined = `${name} ${rawNotes}`.toLowerCase();

  // Pattern 1: "... per 31g serving (3 scoops)" or "... per 31g (3 scoops)"
  const p1 = rawNotes.match(/(?:per|\/)?\s*([\d.]+)\s*(?:g|ml)\s*(?:serving)?\s*\(\s*(?:about\s+)?(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)s?\s*\)/i);
  // Pattern 2: "about 3 scoops (31g)" or "3 scoops (31g)" or "serving size: 3 scoops (31g)"
  const p2 = rawNotes.match(/(?:serving\s+size:?\s*)?(?:about\s+)?(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)s?\s*\(\s*([\d.]+)\s*(?:g|ml)\s*\)/i);
  // Pattern 3: "3 scoops = 31g" or "3 scoops for 31g" or "3 scoops ~ 31g"
  const p3 = rawNotes.match(/(?:about\s+)?(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)s?\s*(?:=|for|is|showing|about|~)\s*([\d.]+)\s*(?:g|ml)/i);
  // Pattern 4: "(3 scoops)" or "3 scoops"
  const p4 = rawNotes.match(/\(\s*(?:about\s+)?(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)s?\s*\)/i);

  let detectedUnitsCount = unitsPerServing;
  let detectedUnitName = servingUnit;
  let detectedTotalGrams = portionGrams;

  if (p1) {
    const g = parseNum(p1[1]);
    const cnt = parseNum(p1[2]);
    const u = p1[3].toLowerCase();
    if (g > 0) detectedTotalGrams = g;
    if (cnt > 0) detectedUnitsCount = cnt;
    if (u) detectedUnitName = u;
  } else if (p2) {
    const cnt = parseNum(p2[1]);
    const u = p2[2].toLowerCase();
    const g = parseNum(p2[3]);
    if (g > 0) detectedTotalGrams = g;
    if (cnt > 0) detectedUnitsCount = cnt;
    if (u) detectedUnitName = u;
  } else if (p3) {
    const cnt = parseNum(p3[1]);
    const u = p3[2].toLowerCase();
    const g = parseNum(p3[3]);
    if (g > 0) detectedTotalGrams = g;
    if (cnt > 0) detectedUnitsCount = cnt;
    if (u) detectedUnitName = u;
  } else if (p4) {
    const cnt = parseNum(p4[1]);
    const u = p4[2].toLowerCase();
    if (cnt > 0) detectedUnitsCount = cnt;
    if (u) detectedUnitName = u;
  }

  // Fallback unit naming if still generic
  if (!detectedUnitName || detectedUnitName === "serving" || detectedUnitName === "portion") {
    if (
      combined.includes("scoop") ||
      combined.includes("powder") ||
      combined.includes("whey") ||
      combined.includes("isolate") ||
      combined.includes("creatine") ||
      combined.includes("bcaa") ||
      combined.includes("pre-workout") ||
      combined.includes("preworkout")
    ) {
      detectedUnitName = "scoop";
    } else if (
      combined.includes("slice") ||
      combined.includes("bread") ||
      combined.includes("toast") ||
      combined.includes("pizza")
    ) {
      detectedUnitName = "slice";
    } else if (combined.includes("bar")) {
      detectedUnitName = "bar";
    } else if (combined.includes("can") || combined.includes("soda")) {
      detectedUnitName = "can";
    } else if (combined.includes("bottle")) {
      detectedUnitName = "bottle";
    } else if (
      combined.includes("piece") ||
      combined.includes("egg") ||
      combined.includes("cookie") ||
      combined.includes("wing")
    ) {
      detectedUnitName = "piece";
    } else if (combined.includes("cup") || combined.includes("bowl")) {
      detectedUnitName = "cup";
    } else {
      detectedUnitName = "serving";
    }
  }

  // Standardize single unit weight
  if (detectedUnitsCount > 1) {
    // If Gemini mistakenly reported servingWeight as the full portion (e.g. 31g instead of 10.33g)
    // or if servingWeight was 0/missing:
    if (
      servingWeight <= 0 ||
      Math.abs(servingWeight - detectedTotalGrams) <= 2 ||
      servingWeight > (detectedTotalGrams / detectedUnitsCount) * 1.5
    ) {
      servingWeight = Math.round((detectedTotalGrams / detectedUnitsCount) * 10) / 10;
    } else {
      servingWeight = Math.round(servingWeight * 10) / 10;
    }
  } else {
    // Single unit serving (e.g. 1 scoop, 1 bar, 1 serving)
    if (servingWeight <= 0) {
      const match =
        rawNotes.match(/per\s+([\d.]+)\s*g/i) ||
        rawNotes.match(/([\d.]+)\s*g\s+(?:serving|scoop|portion)/i);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 5000) {
          servingWeight = Math.round(parsed * 10) / 10;
        }
      }
    }
    if (servingWeight <= 0) {
      servingWeight = detectedTotalGrams;
    }
  }

  const finalPortionGrams = Math.round(detectedTotalGrams);
  const finalServingCount = detectedUnitsCount > 1 ? detectedUnitsCount : 1;

  const estimate: FoodEstimate = {
    name,
    portionGrams: finalPortionGrams,
    kcalPer100g: Math.round(clamp(toFinite(o.kcal_per_100g, 0), 0, 950)),
    proteinPer100g: Math.round(clamp(toFinite(o.protein_per_100g, 0), 0, 100)),
    carbsPer100g: Math.round(clamp(toFinite(o.carbs_per_100g, 0), 0, 100)),
    fatPer100g: Math.round(clamp(toFinite(o.fat_per_100g, 0), 0, 100)),
    confidence: Math.round(clamp(toFinite(o.confidence, 0.5), 0, 1) * 100) / 100,
    notes: rawNotes,
    servingUnit: detectedUnitName,
    servingWeightGrams: servingWeight,
    servingCount: finalServingCount,
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
