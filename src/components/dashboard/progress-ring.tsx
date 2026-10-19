import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  target,
  size = 132,
  strokeWidth = 12,
  label,
  sublabel,
  className,
}: {
  value: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const offset = circumference * (1 - progress);
  const over = value > target && target > 0;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${label} of ${target}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-secondary"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            {
              "--ring-circumference": circumference,
            } as React.CSSProperties
          }
          className={cn(
            "ring-animate",
            over ? "stroke-destructive" : "stroke-primary"
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {label}
        </span>
        {sublabel && (
          <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
