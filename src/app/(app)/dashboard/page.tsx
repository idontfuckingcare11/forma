import Link from "next/link";
import type { Metadata } from "next";
import { getDashboardData } from "@/lib/dashboard/data";
import { isValidDateKey, todayKey } from "@/lib/dates";
import { remaining, round1 } from "@/lib/nutrition";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { MacroBar } from "@/components/dashboard/macro-bar";
import { DateNav } from "@/components/dashboard/date-nav";
import { CalorieChart, WeightChart } from "@/components/dashboard/charts";
import {
  MealsSection,
  ProteinConsistency,
  RecentEntries,
} from "@/components/dashboard/meals";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { io } from "next/cache";
import { AlertTriangle, Droplets } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

// Page fetches per-request user data — opt out of instant/prefetch navigation.
export const instant = false;

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  await io();
  const params = await searchParams;
  const rawDate = typeof params.date === "string" ? params.date : undefined;
  const dateKey = isValidDateKey(rawDate) ? rawDate : todayKey();

  const data = await getDashboardData(dateKey);
  const { goals, totals, waterMl, entryCount } = data.day;
  const kcalLeft = remaining(totals.kcal, goals.calorieTarget);
  const water = round1(waterMl / 1000);
  const waterGoal = round1(goals.waterTargetMl / 1000);
  const userName = data.user.displayName || data.user.email.split("@")[0] || "Athlete";

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <Link
            href="/profile"
            className="group relative transition-transform hover:scale-105"
            title="View Profile & Settings"
          >
            <UserAvatar
              avatarUrl={data.user.avatarUrl}
              name={data.user.displayName}
              email={data.user.email}
              size="lg"
              showOnlineStatus
            />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Hey, {userName} 👋
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {entryCount === 0
                ? "No meals logged for this day yet."
                : `${entryCount} meal${entryCount === 1 ? "" : "s"} logged.`}{" "}
              <span className="font-medium text-foreground">{Math.round(kcalLeft)} kcal</span>{" "}
              remaining.
            </p>
          </div>
        </div>
        <DateNav dateKey={dateKey} />
      </div>

      <section
        aria-label="Daily nutrition summary"
        className="grid gap-4 lg:grid-cols-5"
      >
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <ProgressRing
              value={totals.kcal}
              target={goals.calorieTarget}
              label={Math.round(totals.kcal).toLocaleString()}
              sublabel={`of ${goals.calorieTarget.toLocaleString()} kcal`}
              size={148}
            />
            <div className="grid w-full grid-cols-3 divide-x divide-border text-center">
              <div className="px-2">
                <p className="text-lg font-semibold tabular-nums">
                  {Math.round(remaining(totals.kcal, goals.calorieTarget))}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Remaining
                </p>
              </div>
              <div className="px-2">
                <p className="text-lg font-semibold tabular-nums">{entryCount}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Meals
                </p>
              </div>
              <div className="px-2">
                <p className="text-lg font-semibold tabular-nums">{water}L</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Water
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-5 py-6">
            <MacroBar
              label="Protein"
              value={totals.protein}
              target={goals.proteinTarget}
              color="protein"
            />
            <MacroBar
              label="Carbohydrates"
              value={totals.carbs}
              target={goals.carbTarget}
              color="carbs"
            />
            <MacroBar
              label="Fat"
              value={totals.fat}
              target={goals.fatTarget}
              color="fat"
            />
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Droplets className="size-4 shrink-0 text-chart-2" />
              <div className="flex-1 text-sm">
                <span className="font-medium tabular-nums">{water} L</span>
                <span className="text-muted-foreground"> / {waterGoal} L water</span>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(remaining(waterMl, goals.waterTargetMl))} ml to go
              </span>
            </div>
            {!goals.waterTargetMl && (
              <p className="text-xs text-muted-foreground">Water goal not set.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <QuickActions />

      <MealsSection meals={data.day.meals} />

      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-2">
        <CalorieChart data={data.weeklyCalories} />
        <WeightChart
          data={data.weightSeries.slice(-30)}
          unitSystem={data.unitSystem}
        />
      </section>

      <section aria-label="Consistency and recent activity" className="grid gap-4 lg:grid-cols-2">
        <ProteinConsistency days={data.proteinDays} />
        <RecentEntries entries={data.recentEntries} />
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Calorie targets shown here are estimates from onboarding defaults until
        you customize them. They are not medical advice.
      </p>
    </div>
  );
}
