import type { Metadata } from "next";
import Link from "next/link";
import {
  getProgressData,
  parseRange,
} from "@/lib/progress/data";
import { formatWeight, kgToLb } from "@/lib/nutrition";
import { formatDayLabel } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalorieChart, WeightChart } from "@/components/dashboard/charts";
import { WeightLogCard } from "@/components/progress/weight-log-card";
import { io } from "next/cache";
import { Activity, Flame, Ruler, Scale, Target } from "lucide-react";

export const metadata: Metadata = { title: "Progress" };

// Page fetches per-request user data — opt out of instant/prefetch navigation.
export const instant = false;

const RANGE_LABELS: Record<number, string> = { 7: "7 days", 30: "30 days", 90: "90 days" };

export default async function ProgressPage({
  searchParams,
}: PageProps<"/progress">) {
  await io();
  const params = await searchParams;
  const range = parseRange(params.range);
  const data = await getProgressData(range);
  const { stats, unitSystem, goals, rangeDays } = data;
  const isImperial = unitSystem === "imperial";

  const changeDisplay =
    stats.rangeChangeKg != null
      ? `${stats.rangeChangeKg > 0 ? "+" : ""}${
          isImperial
            ? Math.round(kgToLb(stats.rangeChangeKg))
            : Math.round(stats.rangeChangeKg * 10) / 10
        } ${isImperial ? "lb" : "kg"}`
      : null;

  const proteinHitRate = stats.loggedFoodDays
    ? stats.proteinHits / stats.loggedFoodDays
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weight trends and nutrition consistency over time.
          </p>
        </div>
        <nav aria-label="Time range" className="flex gap-2">
          {[7, 30, 90].map((r) => (
            <Button
              key={r}
              asChild
              size="sm"
              variant={range === r ? "default" : "outline"}
            >
              <Link href={`/progress?range=${r}`}>
                {RANGE_LABELS[r]}
              </Link>
            </Button>
          ))}
        </nav>
      </div>

      {/* Stats */}
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Scale}
          label="Weight now"
          value={
            stats.latestWeightKg != null
              ? formatWeight(stats.latestWeightKg, unitSystem)
              : "—"
          }
          note={
            stats.latestWeightDate
              ? `Logged ${formatDayLabel(stats.latestWeightDate)}`
              : "No weight logged"
          }
        />
        <StatCard
          icon={Activity}
          label={`Change — ${RANGE_LABELS[rangeDays]}`}
          value={changeDisplay ?? "—"}
          note={
            stats.rangeChangeKg != null
              ? `First → last log in range (${stats.loggedWeightDays} logs)`
              : "Needs at least 2 logs in range"
          }
          tone={
            stats.rangeChangeKg == null
              ? "neutral"
              : stats.rangeChangeKg < 0
                ? "good"
                : "neutral"
          }
        />
        <StatCard
          icon={Flame}
          label="Avg calories"
          value={stats.avgKcal != null ? `${stats.avgKcal.toLocaleString()} kcal` : "—"}
          note={
            stats.loggedFoodDays
              ? `On ${stats.loggedFoodDays} logged day${stats.loggedFoodDays === 1 ? "" : "s"} · target ${goals.calorieTarget.toLocaleString()}`
              : "No food logged in range"
          }
        />
        <StatCard
          icon={Target}
          label="Protein goal"
          value={
            stats.loggedFoodDays
              ? `${stats.proteinHits} / ${stats.loggedFoodDays} days`
              : "—"
          }
          note={`Days ≥ 90% of ${goals.proteinTarget} g${
            stats.avgProtein != null ? ` · avg ${stats.avgProtein} g/day` : ""
          }`}
        />
      </section>

      {/* Charts + logging */}
      <section
        aria-label="Charts and logging"
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          <WeightChart data={data.weightSeries} unitSystem={unitSystem} />
          <CalorieChart
            data={data.calorieSeries}
            title={`Calories — last ${rangeDays} days`}
          />
        </div>
        <div className="space-y-6">
          <WeightLogCard
            unitSystem={unitSystem}
            entries={[...data.weightLogs].reverse().slice(0, 10)}
            latestWeightKg={stats.latestWeightKg}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Target className="size-4 text-primary" />
                Protein consistency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums">
                    {Math.round(proteinHitRate * 100)}%
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {stats.proteinHits}/{stats.loggedFoodDays || 0} days
                  </Badge>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={Math.round(proteinHitRate * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Protein goal hit rate"
                >
                  <div
                    className="bar-animate h-full rounded-full bg-primary"
                    style={{ width: `${proteinHitRate * 100}%` }}
                  />
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Ruler className="mt-0.5 size-3.5 shrink-0" />
                Hit rate counts a day when protein reaches 90% of your{" "}
                {goals.proteinTarget} g target. Averages are estimates from what
                you logged.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "good";
}) {
  return (
    <Card>
      <CardContent className="space-y-2 py-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          <span className="text-[11px] font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p
          className={`text-xl font-semibold tracking-tight tabular-nums ${
            tone === "good" ? "text-primary" : ""
          }`}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
