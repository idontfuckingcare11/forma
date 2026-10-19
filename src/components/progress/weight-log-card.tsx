"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWeightLog, logWeight } from "@/lib/actions/progress";
import { kgToLb, lbToKg, formatWeight, type UnitSystem } from "@/lib/nutrition";
import { todayKey, parseDateKey } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Scale, Trash2 } from "lucide-react";

export type WeightEntry = {
  id: string;
  logged_on: string;
  weight_kg: number;
};

function shortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function WeightLogCard({
  unitSystem,
  entries,
  latestWeightKg,
}: {
  unitSystem: UnitSystem;
  entries: WeightEntry[];
  latestWeightKg: number | null;
}) {
  const router = useRouter();
  const today = todayKey();
  const isImperial = unitSystem === "imperial";
  const unit = isImperial ? "lb" : "kg";
  const minDisplay = isImperial ? 44 : 20;
  const maxDisplay = isImperial ? 880 : 400;

  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState(
    latestWeightKg != null
      ? String(isImperial ? Math.round(kgToLb(latestWeightKg) * 10) / 10 : latestWeightKg)
      : ""
  );
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parsed = Number(weight);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
  const weightValid =
    Number.isFinite(parsed) && parsed >= minDisplay && parsed <= maxDisplay;
  const canSubmit = dateValid && weightValid && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    const weightKg = isImperial ? lbToKg(parsed) : parsed;
    const result = await logWeight({ loggedOn: date, weightKg });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Weight logged for ${shortDate(date)}.`);
    router.refresh();
  }

  async function remove(id: string) {
    setDeletingId(id);
    const result = await deleteWeightLog(id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Weight entry removed.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Scale className="size-4 text-primary" />
          Log weight
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="weight-date">Date</Label>
            <Input
              id="weight-date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-value">Weight</Label>
            <div className="relative">
              <Input
                id="weight-value"
                inputMode="decimal"
                placeholder={isImperial ? "154" : "70"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="pr-10"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
          </div>
          <div className="col-span-2">
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {busy ? "Saving…" : "Log weight"}
            </Button>
          </div>
        </form>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries yet — your first log starts the trend line.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-muted-foreground">
                  {shortDate(entry.logged_on)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium tabular-nums">
                    {formatWeight(entry.weight_kg, unitSystem)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === entry.id}
                    onClick={() => remove(entry.id)}
                    aria-label={`Delete weight entry from ${shortDate(entry.logged_on)}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
