import { createClient } from "@/lib/supabase/server";
import { DEFAULT_GOALS, emptyTotals, type GoalTargets, type MacroTotals } from "@/lib/nutrition";
import type { UnitSystem } from "@/lib/db-types";
import { lastNDaysKeys, todayKey } from "@/lib/dates";

export type DiaryEntry = {
  id: string;
  meal: "breakfast" | "lunch" | "dinner" | "snacks";
  name: string;
  portion_grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
};

export type DayData = {
  goals: GoalTargets;
  totals: MacroTotals;
  waterMl: number;
  meals: Record<DiaryEntry["meal"], DiaryEntry[]>;
  entryCount: number;
};

export type DailyCaloriePoint = { date: string; kcal: number; target: number };
export type WeightPoint = { date: string; weight: number };

export type DashboardData = {
  unitSystem: UnitSystem;
  user: {
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  day: DayData;
  weeklyCalories: DailyCaloriePoint[];
  weightSeries: WeightPoint[];
  proteinDays: { date: string; hit: boolean; grams: number }[];
  recentEntries: DiaryEntry[];
  latestWeight: WeightPoint | null;
};

const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getDashboardData(dateKey = todayKey()): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthenticated");
  }

  const weekKeys = lastNDaysKeys(7, dateKey);

  const [profileRes, goalsRes, entriesRes, waterRes, weekEntriesRes, weightRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("unit_system, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("nutrition_goals")
        .select(
          "calorie_target, protein_target, carb_target, fat_target, water_target_ml"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("food_entries")
        .select("id, meal, name, portion_grams, kcal, protein, carbs, fat, created_at")
        .eq("user_id", user.id)
        .eq("eaten_on", dateKey)
        .order("created_at", { ascending: true }),
      supabase
        .from("water_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .eq("logged_on", dateKey),
      supabase
        .from("food_entries")
        .select("eaten_on, kcal, protein")
        .eq("user_id", user.id)
        .gte("eaten_on", weekKeys[0])
        .lte("eaten_on", weekKeys[weekKeys.length - 1]),
      supabase
        .from("weight_logs")
        .select("logged_on, weight_kg")
        .eq("user_id", user.id)
        .order("logged_on", { ascending: true })
        .limit(365),
    ]);

  if (entriesRes.error) throw entriesRes.error;
  if (weightRes.error) throw weightRes.error;

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
  ) as DayData["meals"];

  const waterMl = (waterRes.data ?? []).reduce(
    (sum, w) => sum + Number(w.amount_ml),
    0
  );

  const weekAgg = new Map<string, { kcal: number; protein: number }>();
  for (const key of weekKeys) weekAgg.set(key, { kcal: 0, protein: 0 });
  for (const row of (weekEntriesRes.data ?? []) as unknown as {
    eaten_on: string;
    kcal: unknown;
    protein: unknown;
  }[]) {
    const agg = weekAgg.get(row.eaten_on);
    if (!agg) continue;
    agg.kcal += toNumber(row.kcal);
    agg.protein += toNumber(row.protein);
  }

  const weeklyCalories: DailyCaloriePoint[] = weekKeys.map((date) => ({
    date,
    kcal: Math.round(weekAgg.get(date)?.kcal ?? 0),
    target: goals.calorieTarget,
  }));

  const proteinDays = weekKeys.map((date) => {
    const grams = Math.round(weekAgg.get(date)?.protein ?? 0);
    return {
      date,
      grams,
      hit: grams >= goals.proteinTarget * 0.9,
    };
  });

  const weightSeries: WeightPoint[] = ((weightRes.data ?? []) as unknown as {
    logged_on: string;
    weight_kg: unknown;
  }[]).map((w) => ({
    date: w.logged_on,
    weight: toNumber(w.weight_kg),
  }));

  const recentRes = await supabase
    .from("food_entries")
    .select("id, meal, name, portion_grams, kcal, protein, carbs, fat, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const recentEntries = (recentRes.data ?? []) as unknown as DiaryEntry[];

  return {
    unitSystem: (profileRes.data?.unit_system as UnitSystem) ?? "metric",
    user: {
      displayName: profileRes.data?.display_name ?? null,
      email: user.email ?? "",
      avatarUrl: profileRes.data?.avatar_url ?? null,
    },
    day: {
      goals,
      totals,
      waterMl,
      meals,
      entryCount: entries.length,
    },
    weeklyCalories,
    weightSeries,
    proteinDays,
    recentEntries,
    latestWeight: weightSeries.length
      ? weightSeries[weightSeries.length - 1]
      : null,
  };
}
