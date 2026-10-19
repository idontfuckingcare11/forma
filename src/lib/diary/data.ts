import { createClient } from "@/lib/supabase/server";
import { DEFAULT_GOALS, emptyTotals, type GoalTargets, type MacroTotals } from "@/lib/nutrition";
import { todayKey } from "@/lib/dates";
import type { MealType } from "@/lib/db-types";

export type DiaryEntry = {
  id: string;
  meal: MealType;
  name: string;
  portion_grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  created_at: string;
};

export type WaterLog = { id: string; amount_ml: number };

export type DiaryDay = {
  goals: GoalTargets;
  totals: MacroTotals;
  entries: DiaryEntry[];
  meals: Record<MealType, DiaryEntry[]>;
  waterLogs: WaterLog[];
  waterTotalMl: number;
  entryCount: number;
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getDiaryDay(dateKey = todayKey()): Promise<DiaryDay> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthenticated");

  const [goalsRes, entriesRes, waterRes] = await Promise.all([
    supabase
      .from("nutrition_goals")
      .select("calorie_target, protein_target, carb_target, fat_target, water_target_ml")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("food_entries")
      .select("id, meal, name, portion_grams, kcal, protein, carbs, fat, source, created_at")
      .eq("user_id", user.id)
      .eq("eaten_on", dateKey)
      .order("created_at", { ascending: true }),
    supabase
      .from("water_logs")
      .select("id, amount_ml")
      .eq("user_id", user.id)
      .eq("logged_on", dateKey)
      .order("created_at", { ascending: true }),
  ]);

  if (entriesRes.error) throw entriesRes.error;
  if (waterRes.error) throw waterRes.error;

  const g = goalsRes.data;
  const goals: GoalTargets = {
    calorieTarget: g?.calorie_target ?? DEFAULT_GOALS.calorieTarget,
    proteinTarget: g?.protein_target ?? DEFAULT_GOALS.proteinTarget,
    carbTarget: g?.carb_target ?? DEFAULT_GOALS.carbTarget,
    fatTarget: g?.fat_target ?? DEFAULT_GOALS.fatTarget,
    waterTargetMl: g?.water_target_ml ?? DEFAULT_GOALS.waterTargetMl,
  };

  const entries = (entriesRes.data ?? []) as unknown as DiaryEntry[];
  const totals = entries.reduce<MacroTotals>((acc, e) => {
    acc.kcal += toNumber(e.kcal);
    acc.protein += toNumber(e.protein);
    acc.carbs += toNumber(e.carbs);
    acc.fat += toNumber(e.fat);
    return acc;
  }, emptyTotals());

  const meals = Object.fromEntries(
    MEALS.map((m) => [m, entries.filter((e) => e.meal === m)])
  ) as Record<MealType, DiaryEntry[]>;

  const waterLogs = (waterRes.data ?? []) as unknown as WaterLog[];
  const waterTotalMl = waterLogs.reduce((sum, w) => sum + toNumber(w.amount_ml), 0);

  return {
    goals,
    totals,
    entries,
    meals,
    waterLogs,
    waterTotalMl,
    entryCount: entries.length,
  };
}
