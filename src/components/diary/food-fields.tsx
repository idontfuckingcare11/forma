"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MealType } from "@/lib/db-types";

export const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snacks", label: "Snacks" },
];

export function MealSelect({
  value,
  onChange,
  id,
}: {
  value: MealType;
  onChange: (m: MealType) => void;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Meal</Label>
      <Select value={value} onValueChange={(v) => onChange(v as MealType)}>
        <SelectTrigger id={id} className="w-full" aria-label="Meal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEAL_OPTIONS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PortionField({
  value,
  onChange,
  servingHint,
  id = "portion",
}: {
  value: string;
  onChange: (v: string) => void;
  servingHint?: string;
  id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Portion</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-12"
          placeholder="100"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          grams
        </span>
      </div>
      {servingHint && (
        <p className="text-xs text-muted-foreground">{servingHint}</p>
      )}
    </div>
  );
}

export function MacroPreview({
  preview,
}: {
  preview: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-center">
      <div>
        <p className="text-sm font-semibold tabular-nums">{preview.kcal}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          kcal
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums">{preview.protein}g</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          protein
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums">{preview.carbs}g</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          carbs
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold tabular-nums">{preview.fat}g</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          fat
        </p>
      </div>
    </div>
  );
}
