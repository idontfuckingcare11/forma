import type { Metadata } from "next";
import { getDiaryDay, type DiaryEntry } from "@/lib/diary/data";
import { isValidDateKey, todayKey } from "@/lib/dates";
import { remaining } from "@/lib/nutrition";
import type { MealType } from "@/lib/db-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateNav } from "@/components/dashboard/date-nav";
import { MacroBar } from "@/components/dashboard/macro-bar";
import { AddFoodDialog } from "@/components/diary/add-food-dialog";
import { EntryActions } from "@/components/diary/entry-actions";
import { WaterCard } from "@/components/diary/water-card";
import { io } from "next/cache";
import { UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = { title: "Food Diary" };

// Page fetches per-request user data — opt out of instant/prefetch navigation.
export const instant = false;

const MEAL_META: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snacks", label: "Snacks" },
];

export default async function DiaryPage({
  searchParams,
}: PageProps<"/diary">) {
  await io();
  const params = await searchParams;
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const dateKey = isValidDateKey(rawDate) ? rawDate : todayKey();

  const day = await getDiaryDay(dateKey);
  const kcalLeft = remaining(day.totals.kcal, day.goals.calorieTarget);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Food Diary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {day.entryCount === 0
              ? "Nothing logged yet."
              : `${day.entryCount} item${day.entryCount === 1 ? "" : "s"} · `}{" "}
            {Math.round(day.totals.kcal).toLocaleString()} /{" "}
            {day.goals.calorieTarget.toLocaleString()} kcal
            {day.entryCount > 0 && <> · {Math.round(kcalLeft)} left</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddFoodDialog meal="breakfast" dateKey={dateKey} />
          <DateNav dateKey={dateKey} basePath="/diary" />
        </div>
      </div>

      {/* Daily summary strip */}
      <section aria-label="Daily totals" className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardContent className="space-y-4 py-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Calories
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {Math.round(day.totals.kcal).toLocaleString()}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {day.goals.calorieTarget.toLocaleString()} kcal
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.round(kcalLeft)} kcal remaining
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="space-y-4 py-5">
            <MacroBar
              label="Protein"
              value={day.totals.protein}
              target={day.goals.proteinTarget}
            />
            <div className="grid grid-cols-2 gap-4">
              <MacroBar
                label="Carbs"
                value={day.totals.carbs}
                target={day.goals.carbTarget}
                color="carbs"
              />
              <MacroBar
                label="Fat"
                value={day.totals.fat}
                target={day.goals.fatTarget}
                color="fat"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Meals */}
        <section aria-label="Meals" className="space-y-4 lg:col-span-2">
          {MEAL_META.map(({ key, label }) => {
            const entries = day.meals[key] ?? [];
            const mealKcal = entries.reduce((s, e) => s + Number(e.kcal), 0);
            const mealProtein = entries.reduce((s, e) => s + Number(e.protein), 0);

            return (
              <Card key={key}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                    {entries.length > 0 && (
                      <Badge variant="secondary" className="font-normal tabular-nums">
                        {Math.round(mealKcal)} kcal · {Math.round(mealProtein)}g P
                      </Badge>
                    )}
                  </div>
                  <AddFoodDialog meal={key} dateKey={dateKey} />
                </CardHeader>
                <CardContent>
                  {entries.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                      <UtensilsCrossed className="size-4" />
                      Nothing logged for {label.toLowerCase()}.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {entries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          dateKey={dateKey}
                        />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Side column */}
        <section aria-label="Water and totals" className="space-y-4">
          <WaterCard
            dateKey={dateKey}
            totalMl={day.waterTotalMl}
            targetMl={day.goals.waterTargetMl}
            logs={day.waterLogs}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Day totals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <TotalRow label="Calories" value={`${Math.round(day.totals.kcal)} kcal`} />
                <TotalRow label="Protein" value={`${Math.round(day.totals.protein)} g`} />
                <TotalRow label="Carbs" value={`${Math.round(day.totals.carbs)} g`} />
                <TotalRow label="Fat" value={`${Math.round(day.totals.fat)} g`} />
                <TotalRow
                  label="Items logged"
                  value={String(day.entryCount)}
                />
              </dl>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function EntryRow({ entry, dateKey }: { entry: DiaryEntry; dateKey: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {Math.round(entry.portion_grams)} g · P {Math.round(entry.protein)} · C{" "}
          {Math.round(entry.carbs)} · F {Math.round(entry.fat)}
          {entry.source === "duplicated" && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              copied
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm font-medium tabular-nums">
          {Math.round(entry.kcal)}
        </span>
        <EntryActions
          entryId={entry.id}
          name={entry.name}
          portionGrams={Number(entry.portion_grams)}
          meal={entry.meal}
          viewDate={dateKey}
        />
      </div>
    </li>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
