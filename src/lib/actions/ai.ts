"use server";

import {
  analyzeFoodImage as runGeminiAnalysis,
  type FoodEstimate,
} from "@/lib/ai/gemini";
import { enforceCooldown } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/food";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BASE64_CHARS = 8_000_000; // ~6 MB binary — client downscales well below this.

export async function analyzeFoodImage(
  input: unknown
): Promise<ActionResult<FoodEstimate>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const cooldown = enforceCooldown("vision", user.id, 1500);
  if (cooldown) return { ok: false, error: cooldown };

  const raw = (input ?? {}) as { imageBase64?: unknown; mimeType?: unknown };
  const imageBase64 = raw.imageBase64;
  const mimeType = raw.mimeType;

  if (typeof imageBase64 !== "string" || typeof mimeType !== "string") {
    return { ok: false, error: "Invalid request." };
  }
  if (!ALLOWED_TYPES.has(mimeType)) {
    return { ok: false, error: "Please use a JPEG, PNG, or WebP photo." };
  }
  if (!imageBase64 || imageBase64.length > MAX_BASE64_CHARS) {
    return { ok: false, error: "Photo is too large — try a smaller image." };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64.slice(0, 64))) {
    return { ok: false, error: "Photo data looks corrupted — retake it." };
  }

  try {
    return await runGeminiAnalysis(imageBase64, mimeType);
  } catch {
    return { ok: false, error: "Analysis failed unexpectedly — try again." };
  }
}
