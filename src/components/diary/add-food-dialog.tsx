"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFoodEntry,
  searchFoods,
  type SearchResult,
} from "@/lib/actions/food";
import type { MealType } from "@/lib/db-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MacroPreview,
  MealSelect,
  PortionField,
} from "@/components/diary/food-fields";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";

type Mode = "search" | "manual";

export function AddFoodDialog({
  meal,
  dateKey,
  children,
}: {
  meal: MealType;
  dateKey: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [saving, setSaving] = useState(false);

  // Portion state (shared between search & manual flows).
  const [portion, setPortion] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealType>(meal);

  // Manual entry fields.
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFat, setManualFat] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchDone(false);
      setSearching(false);
      return;
    }
    const requestId = ++requestRef.current;
    setSearching(true);
    const result = await searchFoods(trimmed);
    if (requestId !== requestRef.current) return; // stale response
    setSearching(false);
    setSearchDone(true);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setResults(result.data ?? []);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  function reset() {
    setQuery("");
    setResults([]);
    setSearchDone(false);
    setSelected(null);
    setPortion("");
    setSelectedMeal(meal);
    setManualName("");
    setManualKcal("");
    setManualProtein("");
    setManualCarbs("");
    setManualFat("");
    setSaving(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function selectResult(item: SearchResult) {
    setSelected(item);
    setPortion(item.servingGrams ? String(item.servingGrams) : "100");
  }

  // Live macro preview for the portion step.
  const portionNum = Number(portion);
  const preview =
    selected && Number.isFinite(portionNum) && portionNum > 0
      ? {
          kcal: Math.round((selected.kcalPer100g * portionNum) / 100),
          protein: Math.round((selected.proteinPer100g * portionNum) / 100),
          carbs: Math.round((selected.carbsPer100g * portionNum) / 100),
          fat: Math.round((selected.fatPer100g * portionNum) / 100),
        }
      : null;

  const manualPreview =
    Number.isFinite(portionNum) &&
    portionNum > 0 &&
    Number.isFinite(Number(manualKcal)) &&
    manualName.trim()
      ? {
          kcal: Math.round((Number(manualKcal) * portionNum) / 100),
          protein: Math.round((Number(manualProtein || 0) * portionNum) / 100),
          carbs: Math.round((Number(manualCarbs || 0) * portionNum) / 100),
          fat: Math.round((Number(manualFat || 0) * portionNum) / 100),
        }
      : null;

  async function saveFromSearch() {
    if (!selected || !preview) return;
    setSaving(true);
    const result = await addFoodEntry({
      meal: selectedMeal,
      eatenOn: dateKey,
      name: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
      portionGrams: portionNum,
      kcalPer100g: selected.kcalPer100g,
      proteinPer100g: selected.proteinPer100g,
      carbsPer100g: selected.carbsPer100g,
      fatPer100g: selected.fatPer100g,
      foodItemId: selected.id,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${selected.name} added to ${selectedMeal}.`);
    handleOpenChange(false);
    router.refresh();
  }

  async function saveManual() {
    if (!manualPreview) return;
    setSaving(true);
    const result = await addFoodEntry({
      meal: selectedMeal,
      eatenOn: dateKey,
      name: manualName.trim(),
      portionGrams: portionNum,
      kcalPer100g: Number(manualKcal),
      proteinPer100g: Number(manualProtein || 0),
      carbsPer100g: Number(manualCarbs || 0),
      fatPer100g: Number(manualFat || 0),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${manualName.trim()} added to ${selectedMeal}.`);
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Add food
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add food</DialogTitle>
          <DialogDescription>
            Search the database or enter nutrition manually.
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="manual">Manual entry</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Chicken, rice, yogurt…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  aria-label="Search foods"
                />
              </div>

              <MealSelect value={selectedMeal} onChange={setSelectedMeal} />

              <div className="space-y-1.5">
                {searching && (
                  <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Searching…
                  </p>
                )}

                {!searching && query.trim().length < 2 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search.
                  </p>
                )}

                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <p>No results for “{query.trim()}”.</p>
                    <button
                      type="button"
                      onClick={() => setMode("manual")}
                      className="mt-2 font-medium text-primary hover:underline"
                    >
                      Add it manually instead
                    </button>
                  </div>
                )}

                {!searching &&
                  results.map((item, i) => (
                    <button
                      key={`${item.source}-${item.id ?? item.externalId ?? i}`}
                      type="button"
                      onClick={() => selectResult(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.brand ? `${item.brand} · ` : ""}
                          {Math.round(item.kcalPer100g)} kcal / 100 g
                          {item.servingLabel ? ` · ${item.servingLabel}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          item.source === "local"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {item.source === "local" ? "Foods" : "OFF"}
                      </span>
                    </button>
                  ))}

                {searchDone && results.length > 0 && (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Values from your staples & Open Food Facts — always estimates.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-3">
              <ManualEntryFields
                name={manualName}
                setName={setManualName}
                kcal={manualKcal}
                setKcal={setManualKcal}
                protein={manualProtein}
                setProtein={setManualProtein}
                carbs={manualCarbs}
                setCarbs={setManualCarbs}
                fat={manualFat}
                setFat={setManualFat}
              />
              <MealSelect value={selectedMeal} onChange={setSelectedMeal} />
              <PortionField value={portion} onChange={setPortion} />
              {manualPreview && <MacroPreview preview={manualPreview} />}
              <Button
                type="button"
                className="w-full"
                disabled={!manualPreview || saving}
                onClick={saveManual}
              >
                {saving ? "Adding…" : "Add to diary"}
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-muted-foreground">
                {selected.brand ? `${selected.brand} · ` : ""}
                {Math.round(selected.kcalPer100g)} kcal / 100 g
                {selected.source === "openfoodfacts" &&
                  " · community data, estimate only"}
              </p>
            </div>

            <MealSelect value={selectedMeal} onChange={setSelectedMeal} />
            <PortionField
              value={portion}
              onChange={setPortion}
              servingHint={
                selected.servingLabel && selected.servingGrams
                  ? `1 serving ≈ ${selected.servingGrams} g`
                  : undefined
              }
            />
            {preview && <MacroPreview preview={preview} />}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!preview || saving}
                onClick={saveFromSearch}
              >
                {saving ? "Adding…" : "Add to diary"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryFields(props: {
  name: string;
  setName: (v: string) => void;
  kcal: string;
  setKcal: (v: string) => void;
  protein: string;
  setProtein: (v: string) => void;
  carbs: string;
  setCarbs: (v: string) => void;
  fat: string;
  setFat: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="manual-name">Food name</Label>
        <Input
          id="manual-name"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="e.g. Homemade chicken wrap"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Nutrition per 100 g — enter the label or recipe values.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <ManualField id="manual-kcal" label="Calories" value={props.kcal} onChange={props.setKcal} unit="kcal" />
        <ManualField id="manual-protein" label="Protein" value={props.protein} onChange={props.setProtein} unit="g" />
        <ManualField id="manual-carbs" label="Carbs" value={props.carbs} onChange={props.setCarbs} unit="g" />
        <ManualField id="manual-fat" label="Fat" value={props.fat} onChange={props.setFat} unit="g" />
      </div>
    </>
  );
}

function ManualField({
  id,
  label,
  value,
  onChange,
  unit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          placeholder="0"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
