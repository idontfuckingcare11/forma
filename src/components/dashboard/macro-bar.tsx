import { clampProgress } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const COLORS = {
  protein: "bg-primary",
  carbs: "bg-chart-2",
  fat: "bg-chart-3",
  water: "bg-chart-2",
} as const;

export function MacroBar({
  label,
  value,
  target,
  unit = "g",
  color = "protein",
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: keyof typeof COLORS;
}) {
  const pct = clampProgress(value, target);
  const over = value > target && target > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          <span className={cn("font-medium text-foreground", over && "text-destructive")}>
            {Math.round(value)}
          </span>{" "}
          / {Math.round(target)} {unit}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        aria-label={`${label}: ${Math.round(value)} of ${Math.round(target)} ${unit}`}
      >
        <div
          className={cn(
            "bar-animate h-full rounded-full",
            over ? "bg-destructive" : COLORS[color]
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
