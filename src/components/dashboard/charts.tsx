"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCaloriePoint, WeightPoint } from "@/lib/dashboard/data";
import { kgToLb } from "@/lib/nutrition";
import { formatWeekdayShort } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tooltipStyle = {
  backgroundColor: "#151815",
  border: "1px solid #242a23",
  borderRadius: "0.75rem",
  color: "#f2f4ef",
  fontSize: 12,
};

function formatShortDate(key: string) {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function CalorieChart({
  data,
  title = "Calories — last 7 days",
}: {
  data: DailyCaloriePoint[];
  title?: string;
}) {
  // Weekday labels for short ranges; date labels once days no longer fit.
  const useWeekday = data.length <= 14;
  const chartData = data.map((d) => ({
    ...d,
    label: formatWeekdayShort(d.date),
    short: formatShortDate(d.date),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-56 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#242a23" vertical={false} />
            <XAxis
              dataKey={useWeekday ? "label" : "short"}
              tick={{ fill: "#97a093", fontSize: 11 }}
              axisLine={{ stroke: "#242a23" }}
              tickLine={false}
              minTickGap={useWeekday ? 0 : 24}
            />
            <YAxis
              tick={{ fill: "#97a093", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(182,255,59,0.06)" }}
              formatter={(value) => [`${value} kcal`, "Consumed"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.short ?? ""}
            />
            <ReferenceLine
              y={chartData[0]?.target ?? 0}
              stroke="#b6ff3b"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Bar dataKey="kcal" fill="#b6ff3b" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WeightChart({
  data,
  unitSystem = "metric",
}: {
  data: WeightPoint[];
  unitSystem?: "metric" | "imperial";
}) {
  const unitLabel = unitSystem === "imperial" ? "lb" : "kg";
  const convert = (kg: number) =>
    unitSystem === "imperial" ? Math.round(kgToLb(kg)) : Number(kg.toFixed(1));

  const chartData = data.map((d) => ({
    ...d,
    display: convert(d.weight),
    short: formatShortDate(d.date),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Weight — last {Math.max(data.length, 1)} logs
        </CardTitle>
      </CardHeader>
      <CardContent className="h-56 pt-2">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No weight entries yet.
          </div>
        ) : data.length === 1 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {convert(data[0].weight)} {unitLabel}
            </span>
            <span>Log more weights to see a trend line.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#242a23" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fill: "#97a093", fontSize: 11 }}
                axisLine={{ stroke: "#242a23" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#97a093", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${value} ${unitLabel}`, "Weight"]}
              />
              <Line
                type="monotone"
                dataKey="display"
                stroke="#6bcbff"
                strokeWidth={2}
                dot={{ r: 3, fill: "#6bcbff", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
