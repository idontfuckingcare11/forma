"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MealType } from "@/lib/db-types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function revalidateDiary() {
  revalidatePath("/dashboard");
  revalidatePath("/diary");
}

export type AddEntryInput = {
  meal: MealType;
  eatenOn: string;
  name: string;
  portionGrams: number;
  // Nutrition per 100 g — the entry stores the scaled snapshot.
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  foodItemId?: string | null;
  source?: "manual" | "ai" | "duplicated";
};

export async function addFoodEntry(
  input: AddEntryInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (!MEALS.includes(input.meal)) return { ok: false, error: "Invalid meal." };
  if (!isValidDate(input.eatenOn)) return { ok: false, error: "Invalid date." };
  if (!input.name.trim()) return { ok: false, error: "Food name is required." };
  if (!Number.isFinite(input.portionGrams) || input.portionGrams <= 0 || input.portionGrams > 5000)
    return { ok: false, error: "Portion must be between 1 and 5000 g." };

  const scale = input.portionGrams / 100;
  const { data, error } = await supabase
    .from("food_entries")
    .insert({
      user_id: user.id,
      food_item_id: input.foodItemId ?? null,
      meal: input.meal,
      eaten_on: input.eatenOn,
      name: input.name.trim(),
      portion_grams: input.portionGrams,
      kcal: Math.round(input.kcalPer100g * scale * 10) / 10,
      protein: Math.round(input.proteinPer100g * scale * 10) / 10,
      carbs: Math.round(input.carbsPer100g * scale * 10) / 10,
      fat: Math.round(input.fatPer100g * scale * 10) / 10,
      source: input.source ?? "manual",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true, data: { id: data.id } };
}

export type UpdateEntryInput = {
  id: string;
  name: string;
  portionGrams: number;
  meal: MealType;
};

export async function updateFoodEntry(
  input: UpdateEntryInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (!input.name.trim()) return { ok: false, error: "Food name is required." };
  if (!Number.isFinite(input.portionGrams) || input.portionGrams <= 0 || input.portionGrams > 5000)
    return { ok: false, error: "Portion must be between 1 and 5000 g." };
  if (!MEALS.includes(input.meal)) return { ok: false, error: "Invalid meal." };

  // Fetch the existing entry to rescale macros by the portion ratio.
  const { data: existing, error: fetchError } = await supabase
    .from("food_entries")
    .select("portion_grams, kcal, protein, carbs, fat")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: false, error: "Entry not found." };

  const oldGrams = Number(existing.portion_grams);
  const ratio = oldGrams > 0 ? input.portionGrams / oldGrams : 1;

  const { error } = await supabase
    .from("food_entries")
    .update({
      name: input.name.trim(),
      portion_grams: input.portionGrams,
      meal: input.meal,
      kcal: Math.round(Number(existing.kcal) * ratio * 10) / 10,
      protein: Math.round(Number(existing.protein) * ratio * 10) / 10,
      carbs: Math.round(Number(existing.carbs) * ratio * 10) / 10,
      fat: Math.round(Number(existing.fat) * ratio * 10) / 10,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true };
}

export async function deleteFoodEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("food_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true };
}

export async function duplicateFoodEntry(
  id: string,
  targetDate: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!isValidDate(targetDate)) return { ok: false, error: "Invalid date." };

  const { data: source, error: fetchError } = await supabase
    .from("food_entries")
    .select("meal, name, portion_grams, kcal, protein, carbs, fat")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!source) return { ok: false, error: "Entry not found." };

  const { error } = await supabase.from("food_entries").insert({
    user_id: user.id,
    meal: source.meal,
    eaten_on: targetDate,
    name: source.name,
    portion_grams: source.portion_grams,
    kcal: source.kcal,
    protein: source.protein,
    carbs: source.carbs,
    fat: source.fat,
    source: "duplicated",
  });

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true };
}

export async function addWater(
  amountMl: number,
  date: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };
  if (!isValidDate(date)) return { ok: false, error: "Invalid date." };
  if (!Number.isInteger(amountMl) || amountMl <= 0 || amountMl > 5000)
    return { ok: false, error: "Amount must be between 1 and 5000 ml." };

  const { error } = await supabase.from("water_logs").insert({
    user_id: user.id,
    logged_on: date,
    amount_ml: amountMl,
  });

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true };
}

export async function deleteWaterLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("water_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidateDiary();
  return { ok: true };
}

export type SearchResult = {
  id: string | null;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingLabel: string | null;
  servingGrams: number | null;
  source: "local" | "openfoodfacts";
  externalId: string | null;
};

export async function searchFoods(
  query: string
): Promise<ActionResult<SearchResult[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  // 1. Local foods: the user's own items + global seeds.
  const localFields =
    "id, name, brand, source, external_id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_label, serving_grams";
  const [ownRes, globalRes] = await Promise.all([
    supabase
      .from("food_items")
      .select(localFields)
      .eq("user_id", user.id)
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(8),
    supabase
      .from("food_items")
      .select(localFields)
      .is("user_id", null)
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(8),
  ]);

  const local = [...(ownRes.data ?? []), ...(globalRes.data ?? [])];

  const localResults: SearchResult[] = local.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    kcalPer100g: Number(row.kcal_per_100g),
    proteinPer100g: Number(row.protein_per_100g),
    carbsPer100g: Number(row.carbs_per_100g),
    fatPer100g: Number(row.fat_per_100g),
    servingLabel: row.serving_label,
    servingGrams: row.serving_grams != null ? Number(row.serving_grams) : null,
    source: "local",
    externalId: row.external_id,
  }));

  // 2. Open Food Facts (server-side to avoid CORS; fail soft).
  let offResults: SearchResult[] = [];
  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "12");
    url.searchParams.set(
      "fields",
      "code,product_name,brands,nutriments,serving_size,serving_quantity"
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Forma/1.0 (nutrition tracker)" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as { products?: OffProduct[] };
      offResults = (json.products ?? [])
        .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
        .slice(0, 10)
        .map((p) => {
          const n = p.nutriments ?? {};
          const servingGrams =
            p.serving_quantity && Number(p.serving_quantity) > 0
              ? Number(p.serving_quantity)
              : null;
          return {
            id: null,
            name: p.product_name!.trim(),
            brand: p.brands?.split(",")[0]?.trim() ?? null,
            kcalPer100g: Number(n["energy-kcal_100g"]) || 0,
            proteinPer100g: Number(n.proteins_100g) || 0,
            carbsPer100g: Number(n.carbohydrates_100g) || 0,
            fatPer100g: Number(n.fat_100g) || 0,
            servingLabel: p.serving_size?.trim() ?? null,
            servingGrams,
            source: "openfoodfacts" as const,
            externalId: p.code ?? null,
          };
        });
    }
  } catch {
    // OFF unreachable — local results still returned.
  }

  // Dedupe OFF results that duplicate a local staple by name.
  const localNames = new Set(localResults.map((r) => r.name.toLowerCase()));
  offResults = offResults.filter(
    (r) => !localNames.has(r.name.toLowerCase())
  );

  return { ok: true, data: [...localResults, ...offResults] };
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: string;
  nutriments?: {
    "energy-kcal_100g"?: number | string;
    proteins_100g?: number | string;
    carbohydrates_100g?: number | string;
    fat_100g?: number | string;
  };
};
