import Link from "next/link";
import type { DiaryEntry } from "@/lib/dashboard/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UtensilsCrossed } from "lucide-react";

const MEAL_META: { key: DiaryEntry["meal"]; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snacks", label: "Snacks" },
];

export function MealsSection({
  meals,
}: {
  meals: Record<DiaryEntry["meal"], DiaryEntry[]>;
}) {
  return (
    <section aria-label="Today's meals">
      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_META.map(({ key, label }) => {
          const entries = meals[key] ?? [];
          const kcal = entries.reduce((s, e) => s + Number(e.kcal), 0);
          const protein = entries.reduce((s, e) => s + Number(e.protein), 0);

          return (
            <Card key={key}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                {entries.length > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(kcal)} kcal · {Math.round(protein)}g protein
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {entries.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    <UtensilsCrossed className="size-4" />
                    Nothing logged for {label.toLowerCase()}.
                    <Link href="/scan" className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline">
                      Scan food
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{entry.name}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {Math.round(entry.portion_grams)} g
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          <p className="font-medium text-foreground">
                            {Math.round(entry.kcal)} kcal
                          </p>
                          <p>P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F {Math.round(entry.fat)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function RecentEntries({ entries }: { entries: DiaryEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent entries
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your saved foods will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{entry.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {entry.meal} · {Math.round(entry.portion_grams)} g
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {Math.round(entry.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ProteinConsistency({
  days,
}: {
  days: { date: string; hit: boolean; grams: number }[];
}) {
  const hits = days.filter((d) => d.hit).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Protein consistency
          </CardTitle>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {hits}/{days.length} days
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-1.5">
          {days.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-16 w-full max-w-8 items-end justify-center overflow-hidden rounded-md",
                  day.hit ? "bg-primary/20" : "bg-secondary"
                )}
                title={`${day.grams}g protein`}
              >
                <span
                  className={cn(
                    "w-full rounded-md",
                    day.hit ? "bg-primary" : "bg-muted-foreground/40"
                  )}
                  style={{
                    height: `${Math.min(100, Math.max(8, (day.grams / 200) * 100))}%`,
                  }}
                />
              </span>
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                {day.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Bars show daily protein; bright bars hit at least 90% of your target.
        </p>
      </CardContent>
    </Card>
  );
}
