"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addDaysKey, formatDayLabel, todayKey } from "@/lib/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DateNav({
  dateKey,
  basePath = "/dashboard",
}: {
  dateKey: string;
  basePath?: string;
}) {
  const router = useRouter();
  const isToday = dateKey === todayKey();

  function go(key: string) {
    router.push(key === todayKey() ? basePath : `${basePath}?date=${key}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => go(addDaysKey(dateKey, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-40 text-center">
        <p className="text-sm font-semibold tracking-tight">
          {isToday ? "Today" : formatDayLabel(dateKey)}
        </p>
        {!isToday && (
          <button
            type="button"
            onClick={() => go(todayKey())}
            className="text-xs text-primary hover:underline"
          >
            Back to today
          </button>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-9 disabled:opacity-40"
        onClick={() => go(addDaysKey(dateKey, 1))}
        disabled={isToday}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
