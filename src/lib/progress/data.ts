import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_GOALS,
  type GoalTargets,
} from "@/lib/nutrition";
import type { UnitSystem } from "@/lib/db-types";
import type { DailyCaloriePoint, WeightPoint } from "@/lib/dashboard/data";
import { lastNDaysKeys } from "@/lib/dates";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export type ProgressStats = {
  latestWeightKg: number | null;
  latestWeightDate: string | null;
  /** last − first weight inside the range; null when fewer than 2 logs. */
  rangeChangeKg: number | null;
  loggedWeightDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  proteinHits: number;
  loggedFoodDays: number;
};

export type WeightEntry = {
  id: string;
  logged_on: string;
  weight_kg: number;
};

export type ProgressData = {
  unitSystem: UnitSystem;
  goals: GoalTargets;
  rangeDays: RangeDays;
  weightSeries: WeightPoint[];
  weightLogs: WeightEntry[];
  calorieSeries: DailyCaloriePoint[];
  stats: ProgressStats;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseRange(value: unknown): RangeDays {
  const n = Number(value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 7;
}

export async function getProgressData(
  rangeDays: RangeDays
): Promise<ProgressData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthenticated");

  const keys = lastNDaysKeys(rangeDays);
  const first = keys[0];
  const last = keys[keys.length - 1];

  const [profileRes, goalsRes, weightRangeRes, weightLatestRes, entriesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("unit_system")
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
        .from("weight_logs")
        .select("id, logged_on, weight_kg")
        .eq("user_id", user.id)
        .gte("logged_on", first)
        .lte("logged_on", last)
        .order("logged_on", { ascending: true }),
      supabase
        .from("weight_logs")
        .select("logged_on, weight_kg")
        .eq("user_id", user.id)
        .order("logged_on", { ascending: false })
        .limit(1),
      supabase
        .from("food_entries")
        .select("eaten_on, kcal, protein")
        .eq("user_id", user.id)
        .gte("eaten_on", first)
        .lte("eaten_on", last),
    ]);

  if (weightRangeRes.error) throw weightRangeRes.error;
  if (entriesRes.error) throw entriesRes.error;

  const g = goalsRes.data;
  const goals: GoalTargets = {
    calorieTarget: g?.calorie_target ?? DEFAULT_GOALS.calorieTarget,
    proteinTarget: g?.protein_target ?? DEFAULT_GOALS.proteinTarget,
    carbTarget: g?.carb_target ?? DEFAULT_GOALS.carbTarget,
    fatTarget: g?.fat_target ?? DEFAULT_GOALS.fatTarget,
    waterTargetMl: g?.water_target_ml ?? DEFAULT_GOALS.waterTargetMl,
  };

  const weightLogs: WeightEntry[] = (weightRangeRes.data ?? []).map((w) => ({
    id: w.id,
    logged_on: w.logged_on,
    weight_kg: toNumber(w.weight_kg),
  }));
  const weightSeries: WeightPoint[] = weightLogs.map((w) => ({
    date: w.logged_on,
    weight: w.weight_kg,
  }));

  const latest = weightLatestRes.data?.[0] ?? null;

  // Per-day food aggregates.
  const perDay = new Map<string, { kcal: number; protein: number }>();
  for (const row of entriesRes.data ?? []) {
    const day = perDay.get(row.eaten_on) ?? { kcal: 0, protein: 0 };
    day.kcal += toNumber(row.kcal);
    day.protein += toNumber(row.protein);
    perDay.set(row.eaten_on, day);
  }

  const calorieSeries: DailyCaloriePoint[] = keys.map((date) => ({
    date,
    kcal: Math.round(perDay.get(date)?.kcal ?? 0),
    target: goals.calorieTarget,
  }));

  let kcalSum = 0;
  let proteinSum = 0;
  let proteinHits = 0;
  const loggedFoodDays = perDay.size;
  for (const day of perDay.values()) {
    kcalSum += day.kcal;
    proteinSum += day.protein;
    if (day.protein >= goals.proteinTarget * 0.9) proteinHits++;
  }

  const rangeChangeKg =
    weightSeries.length >= 2
      ? weightSeries[weightSeries.length - 1].weight - weightSeries[0].weight
      : null;

  return {
    unitSystem: (profileRes.data?.unit_system as UnitSystem) ?? "metric",
    goals,
    rangeDays,
    weightSeries,
    weightLogs,
    calorieSeries,
    stats: {
      latestWeightKg: latest ? toNumber(latest.weight_kg) : null,
      latestWeightDate: latest?.logged_on ?? null,
      rangeChangeKg,
      loggedWeightDays: weightSeries.length,
      avgKcal: loggedFoodDays ? Math.round(kcalSum / loggedFoodDays) : null,
      avgProtein: loggedFoodDays ? Math.round(proteinSum / loggedFoodDays) : null,
      proteinHits,
      loggedFoodDays,
    },
  };
}
