import { getDiaryDay } from "@/lib/diary/data";
import { todayKey } from "@/lib/dates";
import { remaining } from "@/lib/nutrition";
import type { MacroComparison } from "./types";

export async function getUserRemainingMacros(): Promise<MacroComparison | null> {
  try {
    const dateKey = todayKey();
    const day = await getDiaryDay(dateKey);
    const kcalLeft = remaining(day.totals.kcal, day.goals.calorieTarget);
    const proteinLeft = remaining(day.totals.protein, day.goals.proteinTarget);
    const carbLeft = remaining(day.totals.carbs, day.goals.carbTarget);
    const fatLeft = remaining(day.totals.fat, day.goals.fatTarget);

    return {
      kcalRemaining: Math.round(kcalLeft),
      proteinRemaining: Math.round(proteinLeft),
      carbRemaining: Math.round(carbLeft),
      fatRemaining: Math.round(fatLeft),
      calorieTarget: Math.round(day.goals.calorieTarget),
      proteinTarget: Math.round(day.goals.proteinTarget),
    };
  } catch {
    return null;
  }
}
