"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_OPTIONS,
  DIETARY_OPTIONS,
  GOAL_OPTIONS,
  cmToFeetInches,
  estimateTargets,
  feetInchesToCm,
  lbToKg,
  type ActivityLevel,
  type Sex,
  type UnitSystem,
} from "@/lib/nutrition";
import type { GoalType } from "@/lib/db-types";
import { saveOnboarding, type OnboardingInput } from "@/lib/actions/profile";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Ruler,
  Scale,
  Target,
  UtensilsCrossed,
} from "lucide-react";

type Step =
  | "basics"
  | "body"
  | "activity"
  | "goal"
  | "diet"
  | "review";

const STEPS: { id: Step; label: string; icon: typeof Ruler }[] = [
  { id: "basics", label: "Basics", icon: Ruler },
  { id: "body", label: "Body", icon: Scale },
  { id: "activity", label: "Activity", icon: Dumbbell },
  { id: "goal", label: "Goal", icon: Target },
  { id: "diet", label: "Diet", icon: UtensilsCrossed },
  { id: "review", label: "Targets", icon: Check },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState(""); // kg or lb depending on units
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [exerciseDays, setExerciseDays] = useState("3");
  const [goal, setGoal] = useState<GoalType>("fat_loss");
  const [diet, setDiet] = useState<string[]>([]);

  const heightFeet = heightCm ? cmToFeetInches(Number(heightCm)) : null;
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");

  const step = STEPS[stepIndex];

  const heightCmValue =
    unitSystem === "metric"
      ? Number(heightCm)
      : feetInchesToCm(Number(heightFt) || 0, Number(heightIn) || 0);
  const currentKg =
    unitSystem === "metric" ? Number(weight) : lbToKg(Number(weight) || 0);
  const targetKg =
    unitSystem === "metric"
      ? Number(targetWeight)
      : lbToKg(Number(targetWeight) || 0);

  const estimate =
    Number.isFinite(heightCmValue) &&
    Number.isFinite(currentKg) &&
    Number.isFinite(targetKg) &&
    Number(age) > 0 &&
    heightCmValue > 0 &&
    currentKg > 0 &&
    targetKg > 0
      ? estimateTargets({
          sex,
          age: Number(age),
          heightCm: heightCmValue,
          currentWeightKg: currentKg,
          targetWeightKg: targetKg,
          activityLevel,
          exerciseDaysPerWeek: Number(exerciseDays) || 0,
          goal,
        })
      : null;

  function validateStep(current: Step): boolean {
    const next: Record<string, string> = {};

    if (current === "basics") {
      const a = Number(age);
      if (!age || !Number.isFinite(a) || a < 13 || a > 100)
        next.age = "Enter an age between 13 and 100.";
    }

    if (current === "body") {
      if (unitSystem === "metric") {
        const h = Number(heightCm);
        if (!heightCm || !Number.isFinite(h) || h < 120 || h > 230)
          next.height = "Enter a height between 120 and 230 cm.";
      } else {
        const f = Number(heightFt);
        const i = Number(heightIn);
        if (!Number.isFinite(f) || f < 3 || f > 7)
          next.height = "Enter a height between 3' and 7'.";
        else if (!Number.isFinite(i) || i < 0 || i > 11)
          next.height = "Inches must be between 0 and 11.";
      }

      const w = currentKg;
      if (!weight || !Number.isFinite(w) || w < 30 || w > 300)
        next.weight =
          unitSystem === "metric"
            ? "Enter a weight between 30 and 300 kg."
            : "Enter a weight between 66 and 660 lb.";

      const tw = targetKg;
      if (!targetWeight || !Number.isFinite(tw) || tw < 30 || tw > 300)
        next.targetWeight =
          unitSystem === "metric"
            ? "Enter a target between 30 and 300 kg."
            : "Enter a target between 66 and 660 lb.";
    }

    if (current === "activity") {
      const d = Number(exerciseDays);
      if (!Number.isFinite(d) || d < 0 || d > 7)
        next.exerciseDays = "Enter a number from 0 to 7.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step.id)) return;
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function goBack() {
    setErrors({});
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function toggleDiet(option: string) {
    setDiet((prev) => {
      if (option === "No restrictions") return prev.includes(option) ? [] : [option];
      const withoutNone = prev.filter((p) => p !== "No restrictions");
      return withoutNone.includes(option)
        ? withoutNone.filter((p) => p !== option)
        : [...withoutNone, option];
    });
  }

  async function submit() {
    if (!estimate) {
      toast.error("Fill in your body measurements first.");
      return;
    }
    setSaving(true);
    const input: OnboardingInput = {
      unitSystem,
      sex,
      age: Number(age),
      heightCm: Math.round(heightCmValue * 10) / 10,
      currentWeightKg: Math.round(currentKg * 100) / 100,
      targetWeightKg: Math.round(targetKg * 100) / 100,
      activityLevel,
      exerciseDaysPerWeek: Number(exerciseDays) || 0,
      goal,
      dietaryPreferences: diet,
      overrides: {
        calorieTarget: null,
        proteinTarget: null,
        carbTarget: null,
        fatTarget: null,
        waterTargetMl: null,
      },
    };
    const result = await saveOnboarding(input);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Targets saved. Welcome to Forma.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Step indicator */}
      <ol className="mb-8 flex items-center justify-between gap-1" aria-label="Progress">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state =
            i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return (
            <li key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border transition-colors",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "todo" && "border-border text-muted-foreground"
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  state === "current" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        {step.id === "basics" && (
          <div className="space-y-6">
            <Header
              title="Let's set up your targets"
              subtitle="A few details so Forma can estimate daily calories and macros."
            />

            <div className="space-y-2">
              <Label>Preferred units</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["metric", "imperial"] as const).map((u) => (
                  <ChoiceCard
                    key={u}
                    active={unitSystem === u}
                    onClick={() => setUnitSystem(u)}
                    title={u === "metric" ? "kg / cm" : "lb / ft"}
                    description={u === "metric" ? "Kilograms, centimeters" : "Pounds, feet & inches"}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sex">Sex at birth</Label>
              <p className="text-xs text-muted-foreground">
                Used only for the calorie equation. You can skip this — we&apos;ll use a
                neutral midpoint.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                    { value: "unspecified", label: "Skip" },
                  ] as const
                ).map((s) => (
                  <ChoiceCard
                    key={s.value}
                    active={sex === s.value}
                    onClick={() => setSex(s.value)}
                    title={s.label}
                    compact
                  />
                ))}
              </div>
            </div>

            <Field
              id="age"
              label="Age"
              value={age}
              onChange={setAge}
              error={errors.age}
              suffix="years"
              inputMode="numeric"
            />
          </div>
        )}

        {step.id === "body" && (
          <div className="space-y-6">
            <Header
              title="Your body"
              subtitle="Current numbers — you can update these later in settings."
            />

            {unitSystem === "metric" ? (
              <Field
                id="height"
                label="Height"
                value={heightCm}
                onChange={setHeightCm}
                error={errors.height}
                suffix="cm"
                inputMode="decimal"
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="height-ft">Height</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="height-ft"
                    inputMode="numeric"
                    placeholder="5"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    aria-invalid={!!errors.height}
                  />
                  <Input
                    id="height-in"
                    inputMode="numeric"
                    placeholder="10"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    aria-invalid={!!errors.height}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">feet / inches</span>
                  {errors.height && (
                    <span className="text-destructive">{errors.height}</span>
                  )}
                </div>
              </div>
            )}

            <Field
              id="weight"
              label="Current weight"
              value={weight}
              onChange={setWeight}
              error={errors.weight}
              suffix={unitSystem === "metric" ? "kg" : "lb"}
              inputMode="decimal"
            />

            <Field
              id="target-weight"
              label="Target weight"
              value={targetWeight}
              onChange={setTargetWeight}
              error={errors.targetWeight}
              suffix={unitSystem === "metric" ? "kg" : "lb"}
              inputMode="decimal"
            />

            {heightFeet && unitSystem === "metric" && heightCm && (
              <p className="text-xs text-muted-foreground">
                That&apos;s about {cmToFeetInches(Number(heightCm)).feet}
                &apos;{cmToFeetInches(Number(heightCm)).inches}&quot;.
              </p>
            )}
          </div>
        )}

        {step.id === "activity" && (
          <div className="space-y-6">
            <Header
              title="How active are you?"
              subtitle="Outside of structured workouts — your daily life and training combined."
            />

            <div className="space-y-2">
              {ACTIVITY_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  active={activityLevel === option.value}
                  onClick={() => setActivityLevel(option.value)}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>

            <Field
              id="exercise-days"
              label="Workout days per week"
              value={exerciseDays}
              onChange={setExerciseDays}
              error={errors.exerciseDays}
              suffix="days"
              inputMode="numeric"
            />
          </div>
        )}

        {step.id === "goal" && (
          <div className="space-y-6">
            <Header
              title="What's the goal?"
              subtitle="This sets a conservative deficit or surplus. You can change it anytime."
            />
            <div className="space-y-2">
              {GOAL_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  active={goal === option.value}
                  onClick={() => setGoal(option.value)}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
            {goal === "fat_loss" && (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                We recommend a moderate deficit — around 15% below maintenance,
                never below your BMR. Slow and steady protects muscle.
              </p>
            )}
          </div>
        )}

        {step.id === "diet" && (
          <div className="space-y-6">
            <Header
              title="Dietary preferences"
              subtitle="Optional — helps the assistant suggest foods that fit. Pick any that apply."
            />
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleDiet(option)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    diet.includes(option)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                  aria-pressed={diet.includes(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {step.id === "review" && (
          <div className="space-y-6">
            <Header
              title="Review your targets"
              subtitle="Based on your answers. These are estimates — adjust anything that doesn't feel right."
            />

            {estimate ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Est. maintenance"
                    value={`${estimate.maintenanceCalories.toLocaleString()} kcal`}
                    hint="Burn rate to hold weight"
                  />
                  <Stat
                    label="BMR"
                    value={`${estimate.bmr.toLocaleString()} kcal`}
                    hint="Burn at complete rest"
                  />
                  <Stat
                    label="Daily target"
                    value={`${estimate.calorieTarget.toLocaleString()} kcal`}
                    hint={
                      estimate.deficitPercent
                        ? `${Math.round(estimate.deficitPercent * 100)}% below maintenance`
                        : estimate.surplusPercent
                          ? `${Math.round(estimate.surplusPercent * 100)}% above maintenance`
                          : "At maintenance"
                    }
                    accent
                  />
                  <Stat
                    label="Water"
                    value={`${(estimate.waterTargetMl / 1000).toFixed(1)} L`}
                    hint="Daily goal"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Protein" value={`${estimate.proteinTarget} g`} />
                  <Stat label="Carbs" value={`${estimate.carbTarget} g`} />
                  <Stat label="Fat" value={`${estimate.fatTarget} g`} />
                </div>

                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  These are estimates from standard formulas, not medical advice.
                  Check with a professional before making drastic changes. You can
                  fine-tune every number in Settings after onboarding.
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">
                Something&apos;s missing — go back and complete your body measurements.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={stepIndex === 0 || saving}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {stepIndex < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={saving || !estimate}>
              {saving ? "Saving…" : "Save my targets"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  description,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 text-left transition-colors",
        compact ? "py-3" : "py-3.5",
        active
          ? "border-primary bg-primary/10"
          : "border-border hover:border-border/80 hover:bg-secondary/40"
      )}
    >
      <p className={cn("text-sm font-medium", active && "text-primary")}>{title}</p>
      {description && (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
      )}
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  suffix,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  suffix?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pr-14" : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        accent ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tracking-tight tabular-nums",
          accent && "text-primary"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
