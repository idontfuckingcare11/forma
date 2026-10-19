"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addWater, deleteWaterLog } from "@/lib/actions/food";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Droplets, Loader2, Plus, Trash2 } from "lucide-react";

const QUICK_AMOUNTS = [250, 500, 750];

export function WaterCard({
  dateKey,
  totalMl,
  targetMl,
  logs,
}: {
  dateKey: string;
  totalMl: number;
  targetMl: number;
  logs: { id: string; amount_ml: number }[];
}) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  const pct = targetMl > 0 ? Math.min(1, totalMl / targetMl) : 0;
  const liters = (ml: number) => (ml / 1000).toFixed(1);

  async function add(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);
    const result = await addWater(Math.round(amount), dateKey);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCustom("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const result = await deleteWaterLog(id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Droplets className="size-4 text-chart-2" />
          Water
        </CardTitle>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{liters(totalMl)}</span> /{" "}
          {liters(targetMl)} L
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuenow={Math.round(totalMl)}
          aria-valuemin={0}
          aria-valuemax={targetMl}
          aria-label={`Water: ${Math.round(totalMl)} of ${targetMl} milliliters`}
        >
          <div
            className="bar-animate h-full rounded-full bg-chart-2"
            style={{ width: `${pct * 100}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => add(amount)}
            >
              <Plus className="size-3.5" />
              {amount} ml
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Input
              inputMode="numeric"
              placeholder="ml"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-20"
              aria-label="Custom water amount in milliliters"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !Number(custom) || Number(custom) <= 0}
              onClick={() => add(Number(custom))}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>

        {logs.length > 0 && (
          <ul className="space-y-1.5">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <span className="tabular-nums">{log.amount_ml} ml</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => remove(log.id)}
                  aria-label={`Remove ${log.amount_ml} ml water log`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
