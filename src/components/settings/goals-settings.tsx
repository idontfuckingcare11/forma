"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGoals, recalculateUserTargets } from "@/lib/actions/profile";
import type { GoalType } from "@/lib/db-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Info, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type NumericKey =
  | "calorieTarget"
  | "proteinTarget"
  | "carbTarget"
  | "fatTarget"
  | "waterTargetMl";

const GOAL_OPTIONS: { id: GoalType; label: string; desc: string }[] = [
  { id: "fat_loss", label: "Lose Fat", desc: "Healthy 20% deficit to drop weight while keeping muscle" },
  { id: "maintenance", label: "Maintain", desc: "Eat at your daily expenditure to maintain body weight" },
  { id: "muscle_gain", label: "Build Muscle", desc: "Lean 8% surplus to fuel muscle hypertrophy" },
];

export function GoalsSettings({
  calorieTarget,
  proteinTarget,
  carbTarget,
  fatTarget,
  waterTargetMl,
  maintenanceCalories,
  currentGoalType = "fat_loss",
}: {
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTargetMl: number;
  maintenanceCalories: number | null;
  currentGoalType?: GoalType;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalType>(currentGoalType);
  const [form, setForm] = useState<Record<NumericKey, string>>({
    calorieTarget: String(calorieTarget),
    proteinTarget: String(proteinTarget),
    carbTarget: String(carbTarget),
    fatTarget: String(fatTarget),
    waterTargetMl: String(waterTargetMl),
  });
  const [error, setError] = useState<string | null>(null);

  const dirty =
    Number(form.calorieTarget) !== calorieTarget ||
    Number(form.proteinTarget) !== proteinTarget ||
    Number(form.carbTarget) !== carbTarget ||
    Number(form.fatTarget) !== fatTarget ||
    Number(form.waterTargetMl) !== waterTargetMl;

  function set(key: NumericKey, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function handleRecalculate(goalToUse: GoalType = selectedGoal) {
    setRecalculating(true);
    setError(null);
    try {
      const res = await recalculateUserTargets(goalToUse);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.targets) {
        toast.error("Could not recalculate targets.");
        return;
      }
      setForm({
        calorieTarget: String(res.targets.calorieTarget),
        proteinTarget: String(res.targets.proteinTarget),
        carbTarget: String(res.targets.carbTarget),
        fatTarget: String(res.targets.fatTarget),
        waterTargetMl: String(res.targets.waterTargetMl),
      });
      toast.success(
        `Targets recalculated for ${GOAL_OPTIONS.find((g) => g.id === goalToUse)?.label}: ${res.targets.calorieTarget.toLocaleString()} kcal!`
      );
      router.refresh();
    } catch {
      toast.error("Failed to recalculate targets.");
    } finally {
      setRecalculating(false);
    }
  }

  async function save() {
    const values: Record<NumericKey, number> = {
      calorieTarget: Number(form.calorieTarget),
      proteinTarget: Number(form.proteinTarget),
      carbTarget: Number(form.carbTarget),
      fatTarget: Number(form.fatTarget),
      waterTargetMl: Number(form.waterTargetMl),
    };

    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0)) {
      setError("All targets must be positive numbers.");
      return;
    }
    if (values.calorieTarget < 800) {
      setError("Calories cannot be set below 800 kcal.");
      return;
    }
    if (values.waterTargetMl < 250) {
      setError("Water goal seems too low — enter at least 250 ml.");
      return;
    }

    setSaving(true);
    const result = await updateGoals(values);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Targets updated.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition targets</CardTitle>
        <CardDescription>
          Daily goals used across your dashboard and food diary.
          {maintenanceCalories != null && (
            <> Your estimated daily maintenance is <strong>{maintenanceCalories.toLocaleString()} kcal</strong>.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Goal Selector */}
        <div className="space-y-2.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Fitness Goal
          </Label>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {GOAL_OPTIONS.map((g) => {
              const active = selectedGoal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setSelectedGoal(g.id);
                    handleRecalculate(g.id);
                  }}
                  disabled={recalculating}
                  className={cn(
                    "flex flex-col text-left rounded-xl border p-3 transition-all",
                    active
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <span className={cn("font-semibold text-sm", active && "text-primary")}>
                    {g.label}
                  </span>
                  <span className="mt-1 text-[11px] leading-tight text-muted-foreground">
                    {g.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Numeric Target Inputs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="calories"
            label="Calories"
            unit="kcal"
            value={form.calorieTarget}
            onChange={(v) => set("calorieTarget", v)}
          />
          <NumberField
            id="protein"
            label="Protein"
            unit="g"
            value={form.proteinTarget}
            onChange={(v) => set("proteinTarget", v)}
          />
          <NumberField
            id="carbs"
            label="Carbohydrates"
            unit="g"
            value={form.carbTarget}
            onChange={(v) => set("carbTarget", v)}
          />
          <NumberField
            id="fat"
            label="Fat"
            unit="g"
            value={form.fatTarget}
            onChange={(v) => set("fatTarget", v)}
          />
          <NumberField
            id="water"
            label="Water"
            unit="ml"
            value={form.waterTargetMl}
            onChange={(v) => set("waterTargetMl", v)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            You can either fine-tune numbers manually or click <strong>Recalculate</strong> above to apply evidence-based sports science recommendations anytime your weight or activity changes.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save Custom Targets"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleRecalculate(selectedGoal)}
            disabled={recalculating}
            className="gap-1.5 text-xs"
          >
            {recalculating ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 text-primary" />
            )}
            Recalculate targets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
