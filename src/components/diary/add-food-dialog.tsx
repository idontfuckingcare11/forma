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
import { Loader2, Minus, Plus, Search } from "lucide-react";

type Mode = "search" | "manual";
type ManualInputMode = "simple" | "per100";
type SimpleSubMode = "grams" | "pieces";

const COMMON_UNITS = ["egg", "piece", "slice", "cup", "bowl", "scoop", "bar", "pack", "banana", "apple", "serving"];

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

  const [portion, setPortion] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealType>(meal);

  const [manualName, setManualName] = useState("");
  const [manualInputMode, setManualInputMode] = useState<ManualInputMode>("simple");
  const [simpleSubMode, setSimpleSubMode] = useState<SimpleSubMode>("grams");

  // Grams sub-mode
  const [simpleKcal, setSimpleKcal] = useState("");
  const [simpleProtein, setSimpleProtein] = useState("");
  const [simpleCarbs, setSimpleCarbs] = useState("");
  const [simpleFat, setSimpleFat] = useState("");
  const [simplePortion, setSimplePortion] = useState("");

  // Pieces sub-mode
  const [pieceQty, setPieceQty] = useState(1);
  const [pieceUnit, setPieceUnit] = useState("egg");
  const [pieceGrams, setPieceGrams] = useState("");     // grams per 1 unit (optional)
  const [pieceKcal, setPieceKcal] = useState("");       // kcal per 1 unit
  const [pieceProtein, setPieceProtein] = useState(""); // protein per 1 unit
  const [pieceCarbs, setPieceCarbs] = useState("");
  const [pieceFat, setPieceFat] = useState("");

  // Per-100g mode
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
    if (requestId !== requestRef.current) return;
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
    setManualInputMode("simple");
    setSimpleSubMode("grams");
    setSimpleKcal("");
    setSimpleProtein("");
    setSimpleCarbs("");
    setSimpleFat("");
    setSimplePortion("");
    setPieceQty(1);
    setPieceUnit("egg");
    setPieceGrams("");
    setPieceKcal("");
    setPieceProtein("");
    setPieceCarbs("");
    setPieceFat("");
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

  // Search flow preview
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

  // Simple/grams preview
  const simplePNum = Number(simplePortion);
  const simpleKcalNum = Number(simpleKcal);
  const simpleProteinNum = Number(simpleProtein || 0);
  const simpleCarbsNum = Number(simpleCarbs || 0);
  const simpleFatNum = Number(simpleFat || 0);
  const simpleGramsValid =
    manualName.trim().length > 0 &&
    Number.isFinite(simpleKcalNum) &&
    simpleKcalNum >= 0 &&
    Number.isFinite(simplePNum) &&
    simplePNum > 0;
  const simpleGramsPreview = simpleGramsValid
    ? { kcal: Math.round(simpleKcalNum), protein: Math.round(simpleProteinNum), carbs: Math.round(simpleCarbsNum), fat: Math.round(simpleFatNum) }
    : null;

  // Pieces preview
  const pieceKcalNum = Number(pieceKcal);
  const pieceProteinNum = Number(pieceProtein || 0);
  const pieceCarbsNum = Number(pieceCarbs || 0);
  const pieceFatNum = Number(pieceFat || 0);
  const pieceValid =
    manualName.trim().length > 0 &&
    Number.isFinite(pieceKcalNum) &&
    pieceKcalNum >= 0 &&
    pieceQty > 0;
  const piecesPreview = pieceValid
    ? {
        kcal: Math.round(pieceKcalNum * pieceQty),
        protein: Math.round(pieceProteinNum * pieceQty),
        carbs: Math.round(pieceCarbsNum * pieceQty),
        fat: Math.round(pieceFatNum * pieceQty),
      }
    : null;

  // Per-100g preview
  const per100PNum = Number(portion);
  const per100KcalNum = Number(manualKcal);
  const per100Valid =
    manualName.trim().length > 0 &&
    Number.isFinite(per100KcalNum) &&
    Number.isFinite(per100PNum) &&
    per100PNum > 0;
  const per100Preview = per100Valid
    ? {
        kcal: Math.round((per100KcalNum * per100PNum) / 100),
        protein: Math.round((Number(manualProtein || 0) * per100PNum) / 100),
        carbs: Math.round((Number(manualCarbs || 0) * per100PNum) / 100),
        fat: Math.round((Number(manualFat || 0) * per100PNum) / 100),
      }
    : null;

  const manualPreview =
    manualInputMode === "per100"
      ? per100Preview
      : simpleSubMode === "grams"
      ? simpleGramsPreview
      : piecesPreview;

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
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(`${selected.name} added to ${selectedMeal}.`);
    handleOpenChange(false);
    router.refresh();
  }

  async function saveManual() {
    if (!manualPreview) return;
    setSaving(true);

    if (manualInputMode === "simple" && simpleSubMode === "grams") {
      const scale = simplePNum / 100;
      const result = await addFoodEntry({
        meal: selectedMeal,
        eatenOn: dateKey,
        name: manualName.trim(),
        portionGrams: simplePNum,
        kcalPer100g: scale > 0 ? simpleKcalNum / scale : simpleKcalNum,
        proteinPer100g: scale > 0 ? simpleProteinNum / scale : simpleProteinNum,
        carbsPer100g: scale > 0 ? simpleCarbsNum / scale : simpleCarbsNum,
        fatPer100g: scale > 0 ? simpleFatNum / scale : simpleFatNum,
        exactKcal: Math.round(simpleKcalNum),
        exactProtein: Math.round(simpleProteinNum),
        exactCarbs: Math.round(simpleCarbsNum),
        exactFat: Math.round(simpleFatNum),
      });
      setSaving(false);
      if (!result.ok) { toast.error(result.error); return; }

    } else if (manualInputMode === "simple" && simpleSubMode === "pieces") {
      const gramsPerUnit = Number(pieceGrams) > 0 ? Number(pieceGrams) : 50;
      const totalGrams = pieceQty * gramsPerUnit;
      const totalKcal = Math.round(pieceKcalNum * pieceQty);
      const totalProtein = Math.round(pieceProteinNum * pieceQty);
      const totalCarbs = Math.round(pieceCarbsNum * pieceQty);
      const totalFat = Math.round(pieceFatNum * pieceQty);
      const scale = totalGrams / 100;
      const unitLabel = pieceUnit.trim() || "piece";
      const entryName = `${manualName.trim()} (${pieceQty} ${pieceQty === 1 ? unitLabel : unitLabel + "s"})`;
      const result = await addFoodEntry({
        meal: selectedMeal,
        eatenOn: dateKey,
        name: entryName,
        portionGrams: totalGrams,
        kcalPer100g: scale > 0 ? totalKcal / scale : totalKcal,
        proteinPer100g: scale > 0 ? totalProtein / scale : totalProtein,
        carbsPer100g: scale > 0 ? totalCarbs / scale : totalCarbs,
        fatPer100g: scale > 0 ? totalFat / scale : totalFat,
        exactKcal: totalKcal,
        exactProtein: totalProtein,
        exactCarbs: totalCarbs,
        exactFat: totalFat,
      });
      setSaving(false);
      if (!result.ok) { toast.error(result.error); return; }

    } else {
      const result = await addFoodEntry({
        meal: selectedMeal,
        eatenOn: dateKey,
        name: manualName.trim(),
        portionGrams: per100PNum,
        kcalPer100g: per100KcalNum,
        proteinPer100g: Number(manualProtein || 0),
        carbsPer100g: Number(manualCarbs || 0),
        fatPer100g: Number(manualFat || 0),
      });
      setSaving(false);
      if (!result.ok) { toast.error(result.error); return; }
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
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="manual">Manual entry</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Chicken, rice, yogurt..."
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
                    Searching...
                  </p>
                )}
                {!searching && query.trim().length < 2 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search.
                  </p>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <p>No results for &quot;{query.trim()}&quot;.</p>
                    <button type="button" onClick={() => setMode("manual")} className="mt-2 font-medium text-primary hover:underline">
                      Add it manually instead
                    </button>
                  </div>
                )}
                {!searching && results.map((item, i) => (
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
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", item.source === "local" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                      {item.source === "local" ? "Foods" : "OFF"}
                    </span>
                  </button>
                ))}
                {searchDone && results.length > 0 && (
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Values from your staples & Open Food Facts - always estimates.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 pt-3">
              <ManualEntryForm
                name={manualName}
                setName={setManualName}
                inputMode={manualInputMode}
                setInputMode={setManualInputMode}
                simpleSubMode={simpleSubMode}
                setSimpleSubMode={setSimpleSubMode}
                simpleKcal={simpleKcal} setSimpleKcal={setSimpleKcal}
                simpleProtein={simpleProtein} setSimpleProtein={setSimpleProtein}
                simpleCarbs={simpleCarbs} setSimpleCarbs={setSimpleCarbs}
                simpleFat={simpleFat} setSimpleFat={setSimpleFat}
                simplePortion={simplePortion} setSimplePortion={setSimplePortion}
                pieceQty={pieceQty} setPieceQty={setPieceQty}
                pieceUnit={pieceUnit} setPieceUnit={setPieceUnit}
                pieceGrams={pieceGrams} setPieceGrams={setPieceGrams}
                pieceKcal={pieceKcal} setPieceKcal={setPieceKcal}
                pieceProtein={pieceProtein} setPieceProtein={setPieceProtein}
                pieceCarbs={pieceCarbs} setPieceCarbs={setPieceCarbs}
                pieceFat={pieceFat} setPieceFat={setPieceFat}
                kcal={manualKcal} setKcal={setManualKcal}
                protein={manualProtein} setProtein={setManualProtein}
                carbs={manualCarbs} setCarbs={setManualCarbs}
                fat={manualFat} setFat={setManualFat}
                portion={portion} setPortion={setPortion}
                selectedMeal={selectedMeal} setSelectedMeal={setSelectedMeal}
              />
              {manualPreview && <MacroPreview preview={manualPreview} />}
              <Button type="button" className="w-full" disabled={!manualPreview || saving} onClick={saveManual}>
                {saving ? "Adding..." : "Add to diary"}
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
                {selected.source === "openfoodfacts" && " · community data, estimate only"}
              </p>
            </div>
            <MealSelect value={selectedMeal} onChange={setSelectedMeal} />
            <PortionField
              value={portion}
              onChange={setPortion}
              servingHint={selected.servingLabel && selected.servingGrams ? `1 serving ~ ${selected.servingGrams} g` : undefined}
            />
            {preview && <MacroPreview preview={preview} />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelected(null)} disabled={saving}>Back</Button>
              <Button type="button" className="flex-1" disabled={!preview || saving} onClick={saveFromSearch}>
                {saving ? "Adding..." : "Add to diary"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Entry Form ─────────────────────────────────────────────────────────

function ManualEntryForm(props: {
  name: string; setName: (v: string) => void;
  inputMode: ManualInputMode; setInputMode: (m: ManualInputMode) => void;
  simpleSubMode: SimpleSubMode; setSimpleSubMode: (m: SimpleSubMode) => void;
  simpleKcal: string; setSimpleKcal: (v: string) => void;
  simpleProtein: string; setSimpleProtein: (v: string) => void;
  simpleCarbs: string; setSimpleCarbs: (v: string) => void;
  simpleFat: string; setSimpleFat: (v: string) => void;
  simplePortion: string; setSimplePortion: (v: string) => void;
  pieceQty: number; setPieceQty: (v: number) => void;
  pieceUnit: string; setPieceUnit: (v: string) => void;
  pieceGrams: string; setPieceGrams: (v: string) => void;
  pieceKcal: string; setPieceKcal: (v: string) => void;
  pieceProtein: string; setPieceProtein: (v: string) => void;
  pieceCarbs: string; setPieceCarbs: (v: string) => void;
  pieceFat: string; setPieceFat: (v: string) => void;
  kcal: string; setKcal: (v: string) => void;
  protein: string; setProtein: (v: string) => void;
  carbs: string; setCarbs: (v: string) => void;
  fat: string; setFat: (v: string) => void;
  portion: string; setPortion: (v: string) => void;
  selectedMeal: MealType; setSelectedMeal: (m: MealType) => void;
}) {
  const isSimple = props.inputMode === "simple";
  const isPieces = props.simpleSubMode === "pieces";
  const unitLabel = props.pieceUnit.trim() || "piece";

  return (
    <div className="space-y-4">
      {/* Food name */}
      <div className="space-y-2">
        <Label htmlFor="manual-name">Food name</Label>
        <Input
          id="manual-name"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="e.g. Boiled egg, banana, rice..."
          autoFocus
        />
      </div>

      {/* Top-level mode toggle */}
      <div className="rounded-xl border border-border bg-muted/40 p-1 flex gap-1">
        <button
          type="button"
          onClick={() => props.setInputMode("simple")}
          className={cn("flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all", isSimple ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          By total
        </button>
        <button
          type="button"
          onClick={() => props.setInputMode("per100")}
          className={cn("flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all", !isSimple ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Per 100 g (label)
        </button>
      </div>

      {isSimple ? (
        <div className="space-y-4">
          {/* Sub-mode: grams vs pieces */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => props.setSimpleSubMode("grams")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-all",
                !isPieces
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
              )}
            >
              <p className="text-sm font-semibold">By weight</p>
              <p className="text-xs mt-0.5 opacity-70">Enter grams</p>
            </button>
            <button
              type="button"
              onClick={() => props.setSimpleSubMode("pieces")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-all",
                isPieces
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
              )}
            >
              <p className="text-sm font-semibold">By quantity</p>
              <p className="text-xs mt-0.5 opacity-70">Eggs, slices...</p>
            </button>
          </div>

          {!isPieces ? (
            /* ── Grams mode ── */
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Easy:</span>{" "}
                Enter the total nutrition for exactly what you ate.
              </div>
              <div className="space-y-2">
                <Label htmlFor="simple-portion">How much did you eat?</Label>
                <div className="relative">
                  <Input id="simple-portion" inputMode="decimal" value={props.simplePortion} onChange={(e) => props.setSimplePortion(e.target.value)} className="pr-12" placeholder="e.g. 150" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">grams</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Total nutrition for that amount</p>
                <div className="grid grid-cols-2 gap-3">
                  <ManualField id="simple-kcal" label="Calories" value={props.simpleKcal} onChange={props.setSimpleKcal} unit="kcal" placeholder="e.g. 165" />
                  <ManualField id="simple-protein" label="Protein" value={props.simpleProtein} onChange={props.setSimpleProtein} unit="g" placeholder="e.g. 31" />
                  <ManualField id="simple-carbs" label="Carbs" value={props.simpleCarbs} onChange={props.setSimpleCarbs} unit="g" placeholder="e.g. 0" />
                  <ManualField id="simple-fat" label="Fat" value={props.simpleFat} onChange={props.setSimpleFat} unit="g" placeholder="e.g. 3.6" />
                </div>
              </div>
              <MealSelect value={props.selectedMeal} onChange={props.setSelectedMeal} />
            </div>
          ) : (
            /* ── Pieces/Quantity mode ── */
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Quantity mode:</span>{" "}
                Enter nutrition for <span className="font-medium text-foreground">1 {unitLabel}</span>, then pick how many you had.
              </div>

              {/* Quantity stepper + unit in one row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>How many?</Label>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 h-10">
                    <button
                      type="button"
                      onClick={() => props.setPieceQty(Math.max(1, props.pieceQty - 1))}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={props.pieceQty}
                      onChange={(e) => {
                        const v = Math.max(1, Math.round(Number(e.target.value) || 1));
                        props.setPieceQty(v);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-center text-sm font-semibold outline-none tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => props.setPieceQty(props.pieceQty + 1)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="piece-unit">Unit name</Label>
                  <Input
                    id="piece-unit"
                    value={props.pieceUnit}
                    onChange={(e) => props.setPieceUnit(e.target.value)}
                    placeholder="egg"
                    className="lowercase"
                  />
                </div>
              </div>

              {/* Common unit quick-picks */}
              <div className="flex flex-wrap gap-1.5">
                {COMMON_UNITS.slice(0, 8).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => props.setPieceUnit(u)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      props.pieceUnit === u
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* Optional grams per unit */}
              <div className="space-y-2">
                <Label htmlFor="piece-grams" className="flex items-center gap-1.5">
                  Weight per {unitLabel}
                  <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Input id="piece-grams" inputMode="decimal" value={props.pieceGrams} onChange={(e) => props.setPieceGrams(e.target.value)} className="pr-12" placeholder="e.g. 50" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">g each</span>
                </div>
              </div>

              {/* Per-unit nutrition */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Nutrition per 1 {unitLabel}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ManualField id="piece-kcal" label="Calories" value={props.pieceKcal} onChange={props.setPieceKcal} unit="kcal" placeholder="e.g. 78" />
                  <ManualField id="piece-protein" label="Protein" value={props.pieceProtein} onChange={props.setPieceProtein} unit="g" placeholder="e.g. 6" />
                  <ManualField id="piece-carbs" label="Carbs" value={props.pieceCarbs} onChange={props.setPieceCarbs} unit="g" placeholder="e.g. 0.6" />
                  <ManualField id="piece-fat" label="Fat" value={props.pieceFat} onChange={props.setPieceFat} unit="g" placeholder="e.g. 5" />
                </div>
              </div>

              <MealSelect value={props.selectedMeal} onChange={props.setSelectedMeal} />
            </div>
          )}
        </div>
      ) : (
        /* ── Per-100g label mode ── */
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Label mode:</span>{" "}
            Copy values from the nutrition label (per 100 g), then set your portion below.
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Nutrition per 100 g</p>
            <div className="grid grid-cols-2 gap-3">
              <ManualField id="per100-kcal" label="Calories" value={props.kcal} onChange={props.setKcal} unit="kcal" placeholder="e.g. 165" />
              <ManualField id="per100-protein" label="Protein" value={props.protein} onChange={props.setProtein} unit="g" placeholder="e.g. 31" />
              <ManualField id="per100-carbs" label="Carbs" value={props.carbs} onChange={props.setCarbs} unit="g" placeholder="e.g. 0" />
              <ManualField id="per100-fat" label="Fat" value={props.fat} onChange={props.setFat} unit="g" placeholder="e.g. 3.6" />
            </div>
          </div>
          <MealSelect value={props.selectedMeal} onChange={props.setSelectedMeal} />
          <div className="space-y-2">
            <Label htmlFor="per100-portion">How much did you eat?</Label>
            <div className="relative">
              <Input id="per100-portion" inputMode="decimal" value={props.portion} onChange={(e) => props.setPortion(e.target.value)} className="pr-12" placeholder="100" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">grams</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared numeric field ──────────────────────────────────────────────────────

function ManualField({ id, label, value, onChange, unit, placeholder = "0" }: {
  id: string; label: string; value: string; onChange: (v: string) => void; unit: string; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" placeholder={placeholder} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
