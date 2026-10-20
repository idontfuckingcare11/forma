import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getUserRemainingMacros } from "@/lib/places/data";
import { PlacesExplorer } from "@/components/places/places-explorer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Lightbulb, Loader2, Sparkles, UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = {
  title: "Nearby Dining & Menus",
  description: "Find nearby restaurants and match menu dishes to your daily macro and calorie targets.",
};

export const instant = false;

export default async function PlacesPage() {
  await connection();
  const remainingMacros = await getUserRemainingMacros();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Compass className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Nearby Dining & Menus</h1>
            <p className="text-sm text-muted-foreground">
              Scan your location to discover restaurants, preview nutrition facts, and find dishes that fit your goals.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-sm">Loading Nearby Dining…</span>
          </div>
        }
      >
        <PlacesExplorer initialMacros={remainingMacros} />
      </Suspense>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-primary" />
            Tips for Dining Out on Track
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
            <div className="rounded-xl border p-3 space-y-1">
              <p className="font-semibold text-foreground">Look for "⚡ High Protein"</p>
              <p>Meals with 30g+ of protein keep you satiated for hours and safeguard muscle recovery.</p>
            </div>
            <div className="rounded-xl border p-3 space-y-1">
              <p className="font-semibold text-foreground">Sauces & Dressings</p>
              <p>Dressings and dips can add 200–300 hidden calories. Asking for them on the side gives you full control.</p>
            </div>
            <div className="rounded-xl border p-3 space-y-1">
              <p className="font-semibold text-foreground">1-Tap Diary Logging</p>
              <p>Click "Log Meal" on any dish to automatically record it to your Forma Food Diary without guessing.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
