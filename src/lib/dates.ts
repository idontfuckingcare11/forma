export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export function addDaysKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

export function lastNDaysKeys(n: number, endKey: string = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDaysKey(endKey, -(n - 1 - i)));
}

export function formatDayLabel(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWeekdayShort(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", { weekday: "short" });
}

export function isValidDateKey(key: string | undefined): key is string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = parseDateKey(key);
  return !Number.isNaN(date.getTime()) && formatDateKey(date) === key;
}
