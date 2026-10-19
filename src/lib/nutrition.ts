import type { GoalType } from "@/lib/db-types";

// ---------------------------------------------------------
// Shared dashboard types & helpers
// ---------------------------------------------------------

export const DEFAULT_GOALS = {
  calorieTarget: 2000,
  proteinTarget: 140,
  carbTarget: 200,
  fatTarget: 60,
  waterTargetMl: 2500,
} as const;

export type MacroTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type GoalTargets = {
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTargetMl: number;
};

export function emptyTotals(): MacroTotals {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export function clampProgress(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

export function remaining(value: number, target: number): number {
  return Math.max(0, target - value);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very_active"
  | "athlete";

export type Sex = "male" | "female" | "unspecified";

export type UnitSystem = "metric" | "imperial";

export const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  description: string;
  multiplier: number;
}[] = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Little or no exercise, desk job",
    multiplier: 1.2,
  },
  {
    value: "light",
    label: "Lightly active",
    description: "Light exercise 1–3 days/week",
    multiplier: 1.375,
  },
  {
    value: "moderate",
    label: "Moderately active",
    description: "Exercise 3–5 days/week",
    multiplier: 1.55,
  },
  {
    value: "very_active",
    label: "Very active",
    description: "Hard exercise 6–7 days/week",
    multiplier: 1.725,
  },
  {
    value: "athlete",
    label: "Athlete",
    description: "Training twice daily, physical job",
    multiplier: 1.9,
  },
];

export const GOAL_OPTIONS: {
  value: GoalType;
  label: string;
  description: string;
}[] = [
  {
    value: "fat_loss",
    label: "Lose fat",
    description: "Conservative deficit to drop body fat while keeping muscle",
  },
  {
    value: "maintenance",
    label: "Maintain",
    description: "Hold your weight and track nutrition habits",
  },
  {
    value: "muscle_gain",
    label: "Build muscle",
    description: "Moderate surplus to support lean mass gains",
  },
];

export const DIETARY_OPTIONS = [
  "No restrictions",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Keto / low-carb",
  "Halal",
  "Kosher",
  "Lactose-free",
  "Gluten-free",
] as const;

export type EstimateInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  exerciseDaysPerWeek: number;
  goal: GoalType;
};

export type Estimate = {
  bmr: number;
  maintenanceCalories: number;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTargetMl: number;
  deficitPercent: number | null;
  surplusPercent: number | null;
};

const ABSOLUTE_MIN_CALORIES_MALE = 1500;
const ABSOLUTE_MIN_CALORIES_FEMALE = 1200;
const DEFICIT_PERCENT = 0.20; // Healthy 20% deficit for fat loss
const SURPLUS_PERCENT = 0.08; // Lean 8% surplus for muscle gain (~180-250 kcal/day)

/**
 * Estimated daily needs from the Mifflin-St Jeor equation,
 * calibrated for modern activity levels and evidence-based sports nutrition.
 */
export function estimateTargets(input: EstimateInput): Estimate {
  const { sex, age, heightCm, currentWeightKg, activityLevel, exerciseDaysPerWeek, goal } = input;

  // Mifflin-St Jeor formula
  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age + sexOffset;

  // Base activity factor from occupation/lifestyle
  const baseMultiplier =
    ACTIVITY_OPTIONS.find((a) => a.value === activityLevel)?.multiplier ?? 1.35;

  // Exercise factor refinement based on weekly workout frequency (0.03 per day of exercise)
  const exerciseBonus = Math.min(0.25, Math.max(0, (exerciseDaysPerWeek ?? 0) * 0.03));
  
  // Calibrated multiplier clamped to realistic metabolic bounds
  const activity = Math.min(1.85, Math.max(1.15, (baseMultiplier * 0.85) + exerciseBonus + 0.15));

  const maintenanceCalories = Math.round(bmr * activity);

  let calorieTarget = maintenanceCalories;
  let deficitPercent: number | null = null;
  let surplusPercent: number | null = null;

  const minFloor = sex === "female" ? ABSOLUTE_MIN_CALORIES_FEMALE : ABSOLUTE_MIN_CALORIES_MALE;

  if (goal === "fat_loss") {
    deficitPercent = DEFICIT_PERCENT;
    calorieTarget = Math.round(maintenanceCalories * (1 - DEFICIT_PERCENT));
    calorieTarget = Math.max(calorieTarget, minFloor);
  } else if (goal === "muscle_gain") {
    surplusPercent = SURPLUS_PERCENT;
    // Lean surplus of 8% (approx 150-250 kcal/day) to prioritize muscle hypertrophy over adipose gain
    calorieTarget = Math.round(maintenanceCalories * (1 + SURPLUS_PERCENT));
  }

  // Protein targets: 2.0-2.2 g/kg on a cut to protect lean mass; 1.8-2.0 g/kg for muscle gain/maintenance
  const proteinPerKg = goal === "fat_loss" ? 2.1 : goal === "muscle_gain" ? 1.9 : 1.7;
  const proteinWeightKg = goal === "fat_loss" && input.targetWeightKg > 0 ? input.targetWeightKg : currentWeightKg;
  const proteinTarget = Math.round(proteinPerKg * proteinWeightKg);

  // Healthy dietary fats: 25% of total calories, minimum 40g/day
  const fatTarget = Math.max(40, Math.round((calorieTarget * 0.25) / 9));

  // Carbs: remaining calories
  const carbCalories = calorieTarget - proteinTarget * 4 - fatTarget * 9;
  const carbTarget = Math.max(40, Math.round(carbCalories / 4));

  // Hydration: ~35-40 ml per kg body weight
  const waterTargetMl = Math.max(2000, Math.round((currentWeightKg * 38) / 100) * 100);

  return {
    bmr: Math.round(bmr),
    maintenanceCalories,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    waterTargetMl,
    deficitPercent,
    surplusPercent,
  };
}

// ---------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------

export function kgToLb(kg: number): number {
  return kg * 2.2046226218;
}

export function lbToKg(lb: number): number {
  return lb / 2.2046226218;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches: inches === 12 ? 11 : inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function formatWeight(kg: number, units: UnitSystem): string {
  if (units === "imperial") return `${Math.round(kgToLb(kg))} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function formatHeight(cm: number, units: UnitSystem): string {
  if (units === "imperial") {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}' ${inches}"`;
  }
  return `${cm.toFixed(0)} cm`;
}
