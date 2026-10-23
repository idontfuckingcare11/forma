"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeFoodImage } from "@/lib/actions/ai";
import { addFoodEntry } from "@/lib/actions/food";
import type { FoodEstimate, FoodComponent } from "@/lib/ai/gemini";
import type { MealType } from "@/lib/db-types";
import { todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MacroPreview,
  MealSelect,
} from "@/components/diary/food-fields";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from "lucide-react";

type Stage = "idle" | "camera" | "analyzing" | "review";

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.85;

const COMMON_UNITS = [
  "scoop",
  "serving",
  "slice",
  "piece",
  "bar",
  "can",
  "bottle",
  "cup",
  "bowl",
  "packet",
  "tbsp",
];

function formatUnit(unit: string, count: number): string {
  const normalized = unit.trim().toLowerCase();
  if (count === 1) return normalized;
  if (normalized.endsWith("s")) return normalized;
  if (
    normalized.endsWith("ch") ||
    normalized.endsWith("sh") ||
    normalized.endsWith("x") ||
    normalized.endsWith("z")
  ) {
    return `${normalized}es`;
  }
  return `${normalized}s`;
}

function guessMeal(): MealType {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 21) return "dinner";
  return "snacks";
}

function confidenceMeta(confidence: number): { label: string; className: string } {
  if (confidence >= 0.75) return { label: "High confidence", className: "bg-primary/10 text-primary" };
  if (confidence >= 0.5) return { label: "Medium confidence", className: "bg-amber-500/10 text-amber-400" };
  return { label: "Low confidence", className: "bg-red-500/10 text-red-400" };
}

function toJpeg(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function ScanAnalyzer({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FoodEstimate | null>(null);
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [meal, setMeal] = useState<MealType>(guessMeal);
  const [saving, setSaving] = useState(false);
  const [components, setComponents] = useState<FoodComponent[]>([]);

  // Serving & portion calculator state
  const [servings, setServings] = useState("1");
  const [servingUnit, setServingUnit] = useState("serving");
  const [servingWeight, setServingWeight] = useState(100);
  const [servingWeightStr, setServingWeightStr] = useState("100");
  const [showUnitSettings, setShowUnitSettings] = useState(false);
  const [customUnit, setCustomUnit] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  // Attach the camera stream once the video element is on screen.
  useEffect(() => {
    if (stage === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage]);

  // Sync meal with local browser time on mount to prevent SSR UTC drift
  useEffect(() => {
    setMeal(guessMeal());
  }, []);

  // Stop the camera on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function reset() {
    requestRef.current++;
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setStage("idle");
    setPreview(null);
    setEstimate(null);
    setName("");
    setPortion("");
    setComponents([]);
    setServings("1");
    setServingUnit("serving");
    setServingWeight(100);
    setServingWeightStr("100");
    setShowUnitSettings(false);
    setCustomUnit("");
    setMeal(guessMeal());
    setSaving(false);
  }

  async function openCamera() {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
    } catch {
      // On mobile iOS PWA / standalone homescreen, getUserMedia can fail or be restricted.
      // Trigger the native device camera directly via capture="environment".
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        toast.info("Camera unavailable â€” upload a photo instead.");
        fileInputRef.current?.click();
      }
    }
  }

  function cancelCamera() {
    stopCamera();
    setStage("idle");
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("Camera is not ready yet.");
      return;
    }
    try {
      const dataUrl = toJpeg(video, video.videoWidth, video.videoHeight);
      stopCamera();
      setStage("idle");
      void runAnalyze(dataUrl);
    } catch {
      toast.error("Capture failed â€” try again.");
    }
  }

  function handleFile(file: File) {
    const isImage =
      (file.type && file.type.startsWith("image/")) ||
      /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name);
    if (!isImage) {
      toast.error("Please choose an image file.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        void runAnalyze(toJpeg(img, img.naturalWidth, img.naturalHeight));
      } catch {
        toast.error("Could not read that photo.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback: attempt FileReader decoding if object URL failed
      const reader = new FileReader();
      reader.onload = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          try {
            void runAnalyze(
              toJpeg(fallbackImg, fallbackImg.naturalWidth, fallbackImg.naturalHeight)
            );
          } catch {
            toast.error("Could not read that photo.");
          }
        };
        fallbackImg.onerror = () => {
          toast.error("Could not read that photo.");
        };
        fallbackImg.src = reader.result as string;
      };
      reader.onerror = () => {
        toast.error("Could not read that photo.");
      };
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  }

  async function runAnalyze(dataUrl: string) {
    const requestId = ++requestRef.current;
    const commaIndex = dataUrl.indexOf(",");
    const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
    const mimeMatch = dataUrl.match(/^data:([^;,]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    if (!base64) {
      toast.error("Photo data is missing â€” retake it.");
      return;
    }

    setPreview(dataUrl);
    setEstimate(null);
    setStage("analyzing");

    const result = await analyzeFoodImage({ imageBase64: base64, mimeType });
    if (requestId !== requestRef.current) return; // superseded by cancel/reset

    if (!result.ok) {
      toast.error(result.error);
      setStage("idle");
      setPreview(null);
      return;
    }

    const data = result.data;
    if (!data) {
      toast.error("Analysis returned no result â€” try again.");
      setStage("idle");
      setPreview(null);
      return;
    }

    setEstimate(data);
    setName(data.name);

    const detectedUnit = data.servingUnit || "serving";
    const detectedUnitWeight =
      typeof data.servingWeightGrams === "number" && data.servingWeightGrams > 0
        ? data.servingWeightGrams
        : 100;
    const detectedCount =
      typeof data.servingCount === "number" && data.servingCount > 0
        ? data.servingCount
        : 1;
    const initialPortion =
      typeof data.portionGrams === "number" && data.portionGrams > 0
        ? data.portionGrams
        : Math.round(detectedUnitWeight * detectedCount * 10) / 10;

    const detectedComps = data.components && data.components.length > 0 ? data.components : [];
    setComponents(detectedComps);

    setServingUnit(detectedUnit);
    setServingWeight(detectedUnitWeight);
    setServingWeightStr(String(detectedUnitWeight));
    setServings(String(detectedCount));
    setPortion(String(initialPortion));
    setShowUnitSettings(false);
    setCustomUnit("");
    setMeal(guessMeal());
    setStage("review");
  }

  function cancelAnalysis() {
    requestRef.current++;
    setStage("idle");
    setPreview(null);
    setEstimate(null);
  }

  function scaleComponents(newTotalGrams: number, oldTotalGrams: number) {
    if (components.length <= 1 || oldTotalGrams <= 0 || newTotalGrams <= 0) return;
    const ratio = newTotalGrams / oldTotalGrams;
    setComponents((prev) =>
      prev.map((c) => ({
        ...c,
        portionGrams: Math.max(1, Math.round(c.portionGrams * ratio)),
      }))
    );
  }

  function handleComponentGramsChange(idx: number, gramsStr: string) {
    const g = parseFloat(gramsStr);
    const safeGrams = Number.isFinite(g) && g >= 0 ? g : 0;
    const updated = components.map((comp, i) =>
      i === idx ? { ...comp, portionGrams: safeGrams } : comp
    );
    setComponents(updated);

    const newTotal = updated.reduce((sum, c) => sum + (c.portionGrams || 0), 0);
    setPortion(String(Math.round(newTotal)));
    if (servingWeight > 0) {
      setServings(String(Math.round((newTotal / servingWeight) * 10) / 10));
    }
  }

  function handleComponentNameChange(idx: number, newName: string) {
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, name: newName } : c))
    );
  }

  function handleRemoveComponent(idx: number) {
    const updated = components.filter((_, i) => i !== idx);
    setComponents(updated);
    const newTotal = updated.reduce((sum, c) => sum + (c.portionGrams || 0), 0);
    setPortion(String(Math.round(newTotal)));
    if (servingWeight > 0) {
      setServings(String(Math.round((newTotal / servingWeight) * 10) / 10));
    }
  }

  function handleAddComponent() {
    const newComp: FoodComponent = {
      name: "Side dish",
      portionGrams: 100,
      kcalPer100g: 130,
      proteinPer100g: 3,
      carbsPer100g: 25,
      fatPer100g: 1,
    };
    const updated = [...components, newComp];
    setComponents(updated);
    const newTotal = updated.reduce((sum, c) => sum + (c.portionGrams || 0), 0);
    setPortion(String(Math.round(newTotal)));
    if (servingWeight > 0) {
      setServings(String(Math.round((newTotal / servingWeight) * 10) / 10));
    }
  }

  function handleServingsChange(val: string) {
    setServings(val);
    const n = parseFloat(val);
    if (Number.isFinite(n) && n > 0 && servingWeight > 0) {
      const oldG = parseFloat(portion) || 0;
      let calculatedGrams: number;
      if (
        estimate?.servingCount &&
        Math.abs(n - estimate.servingCount) < 0.001 &&
        estimate.portionGrams
      ) {
        calculatedGrams = estimate.portionGrams;
      } else {
        calculatedGrams = Math.round(n * servingWeight * 10) / 10;
      }
      setPortion(String(calculatedGrams));
      scaleComponents(calculatedGrams, oldG);
    }
  }

  function handleStepServings(delta: number) {
    const current = parseFloat(servings) || 1;
    const next = Math.max(0.25, Math.round((current + delta) * 100) / 100);
    setServings(String(next));
    if (servingWeight > 0) {
      const oldG = parseFloat(portion) || 0;
      let calculatedGrams: number;
      if (
        estimate?.servingCount &&
        Math.abs(next - estimate.servingCount) < 0.001 &&
        estimate.portionGrams
      ) {
        calculatedGrams = estimate.portionGrams;
      } else {
        calculatedGrams = Math.round(next * servingWeight * 10) / 10;
      }
      setPortion(String(calculatedGrams));
      scaleComponents(calculatedGrams, oldG);
    }
  }

  function handlePreset(mult: number) {
    setServings(String(mult));
    if (servingWeight > 0) {
      const oldG = parseFloat(portion) || 0;
      let calculatedGrams: number;
      if (
        estimate?.servingCount &&
        Math.abs(mult - estimate.servingCount) < 0.001 &&
        estimate.portionGrams
      ) {
        calculatedGrams = estimate.portionGrams;
      } else {
        calculatedGrams = Math.round(mult * servingWeight * 10) / 10;
      }
      setPortion(String(calculatedGrams));
      scaleComponents(calculatedGrams, oldG);
    }
  }

  function handlePortionChange(val: string) {
    const oldG = parseFloat(portion) || 0;
    setPortion(val);
    const grams = parseFloat(val);
    if (Number.isFinite(grams) && grams > 0 && servingWeight > 0) {
      const calculatedServings = Math.round((grams / servingWeight) * 10) / 10;
      setServings(String(calculatedServings));
      scaleComponents(grams, oldG);
    }
  }

  function handleWeightChange(val: string) {
    setServingWeightStr(val);
    const w = parseFloat(val);
    if (Number.isFinite(w) && w > 0 && w <= 5000) {
      const oldG = parseFloat(portion) || 0;
      setServingWeight(w);
      const s = parseFloat(servings) || 1;
      const newG = Math.round(s * w * 10) / 10;
      setPortion(String(newG));
      scaleComponents(newG, oldG);
    }
  }

  function handleUnitSelect(val: string) {
    if (val === "custom") {
      setShowUnitSettings(true);
    } else {
      setServingUnit(val);
    }
  }

  function appendServingToName() {
    const s = parseFloat(servings) || 1;
    const unitText = formatUnit(servingUnit, s);
    const tag = `${s} ${unitText}`;
    const cleaned = name.replace(/\s*\([\d.]+\s*[^)]+\)/g, "").trim();
    setName(`${cleaned} (${tag})`);
  }

  const portionNum = Number(portion);
  const servingsNum = parseFloat(servings) || 0;
  const validPortion =
    Number.isFinite(portionNum) && portionNum > 0 && portionNum <= 5000;
  const canSave =
    estimate !== null && validPortion && name.trim().length > 0 && !saving;

  // When components are present, always derive macros from component data so
  // deletions immediately reflect in the totals. Only fall back to the raw
  // estimate when there are no components at all.
  const previewMacros =
    estimate && validPortion
      ? components.length > 0
        ? components.reduce(
            (acc, c) => {
              const scale = (c.portionGrams || 0) / 100;
              return {
                kcal: acc.kcal + Math.round(c.kcalPer100g * scale),
                protein: acc.protein + Math.round(c.proteinPer100g * scale),
                carbs: acc.carbs + Math.round(c.carbsPer100g * scale),
                fat: acc.fat + Math.round(c.fatPer100g * scale),
              };
            },
            { kcal: 0, protein: 0, carbs: 0, fat: 0 }
          )
        : (() => {
            const scale = portionNum / 100;
            return {
              kcal: Math.round(estimate.kcalPer100g * scale),
              protein: Math.round(estimate.proteinPer100g * scale),
              carbs: Math.round(estimate.carbsPer100g * scale),
              fat: Math.round(estimate.fatPer100g * scale),
            };
          })()
      : null;

  // Derive the effective per-100g values from the current component set so the
  // "kcal / plate" summary also updates when components are added or removed.
  const effectivePer100g = (() => {
    if (components.length > 0) {
      const totalGrams = components.reduce((s, c) => s + (c.portionGrams || 0), 0);
      if (totalGrams > 0 && previewMacros) {
        return {
          kcal: (previewMacros.kcal / totalGrams) * 100,
          protein: (previewMacros.protein / totalGrams) * 100,
          carbs: (previewMacros.carbs / totalGrams) * 100,
          fat: (previewMacros.fat / totalGrams) * 100,
        };
      }
    }
    return {
      kcal: estimate?.kcalPer100g ?? 0,
      protein: estimate?.proteinPer100g ?? 0,
      carbs: estimate?.carbsPer100g ?? 0,
      fat: estimate?.fatPer100g ?? 0,
    };
  })();

  async function save() {
    if (!estimate || !previewMacros || !canSave) return;
    setSaving(true);

    const totalGrams = portionNum;
    const kcalPer100g =
      totalGrams > 0
        ? Math.round((previewMacros.kcal / totalGrams) * 100)
        : estimate.kcalPer100g;
    const proteinPer100g =
      totalGrams > 0
        ? Math.round((previewMacros.protein / totalGrams) * 100)
        : estimate.proteinPer100g;
    const carbsPer100g =
      totalGrams > 0
        ? Math.round((previewMacros.carbs / totalGrams) * 100)
        : estimate.carbsPer100g;
    const fatPer100g =
      totalGrams > 0
        ? Math.round((previewMacros.fat / totalGrams) * 100)
        : estimate.fatPer100g;

    const result = await addFoodEntry({
      meal,
      eatenOn: todayKey(),
      name: name.trim(),
      portionGrams: portionNum,
      kcalPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      source: "ai",
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${name.trim()} added to ${meal}.`);
    reset();
    router.refresh();
  }

  const fileInputs = (
    <>
      {/* Standard photo picker without capture attribute so iOS opens the photo library */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Upload a food photo from library"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      {/* Mobile camera fallback with capture="environment" to directly open device camera */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take food photo with camera"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
    </>
  );

  return (
    <div className="space-y-4">
      {fileInputs}

      {stage === "idle" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ScanLine className="size-7" />
          </span>
          <div>
            <p className="text-sm font-medium">Photograph your meal</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Snap a photo or upload one â€” Gemini estimates the food, portion,
              and macros for you to review before saving.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={openCamera} disabled={!aiEnabled}>
              <Camera className="size-4" />
              Open camera
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!aiEnabled}
            >
              <Upload className="size-4" />
              Upload photo
            </Button>
          </div>
        </div>
      )}

      {stage === "camera" && (
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="aspect-[4/3] w-full object-cover"
          />
          <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
            <Button variant="ghost" size="sm" onClick={cancelCamera}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button size="lg" onClick={capture} aria-label="Capture photo">
              <Camera className="size-5" />
              Capture
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopCamera();
                setStage("idle");
                fileInputRef.current?.click();
              }}
            >
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
        </div>
      )}

      {stage === "analyzing" && preview && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL preview from live capture; next/image cannot optimize data URLs */}
          <img
            src={preview}
            alt="Captured meal preview"
            className="max-h-72 w-full rounded-lg object-cover"
          />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Analyzing with Geminiâ€¦
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={cancelAnalysis}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stage === "review" && estimate && preview && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL preview from live capture; next/image cannot optimize data URLs */}
            <img
              src={preview}
              alt="Analyzed meal"
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 space-y-1.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  confidenceMeta(estimate.confidence).className
                }`}
              >
                {confidenceMeta(estimate.confidence).label} Â·{" "}
                {Math.round(estimate.confidence * 100)}%
              </span>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {estimate.notes || "AI estimate â€” verify before saving."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="scan-name">What is it?</Label>
              {servingsNum > 0 && (
                <button
                  type="button"
                  onClick={appendServingToName}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Tag className="size-3" />
                  Add &quot;{servingsNum} {formatUnit(servingUnit, servingsNum)}&quot; to name
                </button>
              )}
            </div>
            <Input
              id="scan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Whey protein isolate powder"
            />
          </div>

          <MealSelect id="scan-meal" value={meal} onChange={setMeal} />

          {/* Multi-Component Plate Breakdown */}
          {components.length > 0 && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                    <UtensilsCrossed className="size-3.5" />
                    Meal Components
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Weigh items on your scale &amp; adjust grams for accurate tracking
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  onClick={handleAddComponent}
                >
                  <Plus className="size-3.5 mr-1" />
                  Add item
                </Button>
              </div>

              <div className="space-y-2">
                {components.map((comp, idx) => {
                  const compScale = (comp.portionGrams || 0) / 100;
                  const cKcal = Math.round(comp.kcalPer100g * compScale);
                  const cProt = Math.round(comp.proteinPer100g * compScale * 10) / 10;
                  const cCarb = Math.round(comp.carbsPer100g * compScale * 10) / 10;
                  const cFat = Math.round(comp.fatPer100g * compScale * 10) / 10;

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border/70 bg-card p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={comp.name}
                          onChange={(e) => handleComponentNameChange(idx, e.target.value)}
                          className="h-8 text-xs font-medium bg-muted/30 border-border/50 hover:border-border focus:border-primary px-2"
                          placeholder="e.g. Cooked white rice"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative w-24">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={5000}
                              value={comp.portionGrams || ""}
                              onChange={(e) => handleComponentGramsChange(idx, e.target.value)}
                              className="h-8 pr-7 text-right text-xs font-semibold"
                              placeholder="0"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground select-none">
                              g
                            </span>
                          </div>
                          {components.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-red-400"
                              onClick={() => handleRemoveComponent(idx)}
                              title="Remove item"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground px-0.5">
                        <span className="font-semibold text-foreground">{cKcal} kcal</span>
                        <span>Â·</span>
                        <span>{cProt}g P</span>
                        <span>Â·</span>
                        <span>{cCarb}g C</span>
                        <span>Â·</span>
                        <span>{cFat}g F</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Portion & Servings Recalculator */}
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Scale className="size-3.5 text-primary" />
                Portion &amp; Servings
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  1 {servingUnit} â‰ˆ{" "}
                  <span className="font-medium text-foreground">{servingWeight}g</span>
                  {estimate.servingCount && estimate.servingCount > 1 ? (
                    <span className="ml-1 text-[11px] text-muted-foreground/80">
                      ({estimate.servingCount} {formatUnit(servingUnit, estimate.servingCount)} = {estimate.portionGrams}g)
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowUnitSettings((v) => !v)}
                  title="Customize unit and single serving weight"
                >
                  <SlidersHorizontal className="size-3 mr-1" />
                  {showUnitSettings ? "Close" : "Edit unit"}
                </Button>
              </div>
            </div>

            {/* Dual synchronized controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Servings stepper field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize font-medium">
                    {formatUnit(servingUnit, servingsNum || 1)}
                  </span>
                  <span className="text-[10px]">
                    {estimate.servingCount && estimate.servingCount > 1
                      ? `label: ${estimate.servingCount} ${formatUnit(servingUnit, estimate.servingCount)}`
                      : "servings count"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={() => handleStepServings(-0.5)}
                    disabled={servingsNum <= 0.25}
                    aria-label="Decrease portion"
                  >
                    <Minus className="size-3.5" />
                  </Button>

                  <div className="relative flex-1">
                    <Input
                      id="scan-servings"
                      inputMode="decimal"
                      value={servings}
                      onChange={(e) => handleServingsChange(e.target.value)}
                      className="text-center font-semibold text-base pr-8"
                      placeholder="1"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground select-none">
                      {servingUnit.slice(0, 5)}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={() => handleStepServings(0.5)}
                    aria-label="Increase portion"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Total weight field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Total Weight</span>
                  <span className="text-[10px]">auto-calculated</span>
                </div>
                <div className="relative">
                  <Input
                    id="scan-portion"
                    inputMode="decimal"
                    value={portion}
                    onChange={(e) => handlePortionChange(e.target.value)}
                    className="pr-12 font-medium"
                    placeholder="30"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground select-none">
                    grams
                  </span>
                </div>
              </div>
            </div>

            {/* Quick multiplier presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Quick:</span>
              {(estimate.servingCount &&
              estimate.servingCount > 1 &&
              ![0.5, 1, 1.5, 2, 3].includes(estimate.servingCount)
                ? [...[0.5, 1, 1.5, 2, 3], estimate.servingCount].sort((a, b) => a - b)
                : [0.5, 1, 1.5, 2, 3]
              ).map((mult) => {
                const isSelected = Math.abs(servingsNum - mult) < 0.01;
                const isLabelServing =
                  estimate.servingCount &&
                  Math.abs(estimate.servingCount - mult) < 0.01;
                return (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => handlePreset(mult)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                    )}
                    title={isLabelServing ? "Standard label serving" : undefined}
                  >
                    {mult}x{isLabelServing && mult > 1 ? " (serving)" : ""}
                  </button>
                );
              })}
            </div>

            {/* Unit Settings Drawer (collapsible) */}
            {showUnitSettings && (
              <div className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-3 text-xs animate-in fade-in-50 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Serving Unit</Label>
                    <Select
                      value={COMMON_UNITS.includes(servingUnit) ? servingUnit : "custom"}
                      onValueChange={handleUnitSelect}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_UNITS.map((u) => (
                          <SelectItem key={u} value={u} className="text-xs capitalize">
                            {u}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-xs">
                          Customâ€¦
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Grams per 1 {servingUnit}
                    </Label>
                    <Input
                      inputMode="decimal"
                      value={servingWeightStr}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      className="h-8 text-xs font-medium"
                      placeholder="30"
                    />
                  </div>
                </div>

                {!COMMON_UNITS.includes(servingUnit) && (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Custom unit name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        placeholder="e.g. scoop, packet, muffin"
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          if (customUnit.trim()) {
                            setServingUnit(customUnit.trim().toLowerCase());
                            setCustomUnit("");
                          }
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Recalculated Macros */}
          {previewMacros && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" />
                  Recalculated for{" "}
                  <span className="text-primary font-semibold">
                    {servingsNum > 0
                      ? `${servingsNum} ${formatUnit(servingUnit, servingsNum)}`
                      : `${portionNum}g`}
                  </span>{" "}
                  ({portionNum}g)
                </span>
                {servingWeight > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {Math.round((effectivePer100g.kcal * servingWeight) / 100)} kcal / {servingUnit}
                  </span>
                )}
              </div>
              <MacroPreview preview={previewMacros} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Estimates only â€” not medical or dietary advice. Adjust portions to
            match what you actually eat.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={save}
              disabled={!canSave}
              className="flex-1 sm:flex-none"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {saving ? "Savingâ€¦" : "Save to diary"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runAnalyze(preview)}
              disabled={saving}
            >
              <RotateCcw className="size-4" />
              Re-analyze
            </Button>
            <Button variant="ghost" onClick={reset} disabled={saving}>
              <Trash2 className="size-4" />
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
