"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeFoodImage } from "@/lib/actions/ai";
import { addFoodEntry } from "@/lib/actions/food";
import type { FoodEstimate } from "@/lib/ai/gemini";
import type { MealType } from "@/lib/db-types";
import { todayKey } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MacroPreview,
  MealSelect,
  PortionField,
} from "@/components/diary/food-fields";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Stage = "idle" | "camera" | "analyzing" | "review";

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.85;

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  // Attach the camera stream once the video element is on screen.
  useEffect(() => {
    if (stage === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [stage]);

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
    setStage("idle");
    setPreview(null);
    setEstimate(null);
    setName("");
    setPortion("");
    setMeal(guessMeal());
    setSaving(false);
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
    } catch {
      toast.info("Camera unavailable — upload a photo instead.");
      fileInputRef.current?.click();
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
      toast.error("Capture failed — try again.");
    }
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
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
      toast.error("Could not read that photo.");
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
      toast.error("Photo data is missing — retake it.");
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
      toast.error("Analysis returned no result — try again.");
      setStage("idle");
      setPreview(null);
      return;
    }

    setEstimate(data);
    setName(data.name);
    setPortion(String(data.portionGrams));
    setMeal(guessMeal());
    setStage("review");
  }

  function cancelAnalysis() {
    requestRef.current++;
    setStage("idle");
    setPreview(null);
    setEstimate(null);
  }

  const portionNum = Number(portion);
  const validPortion =
    Number.isFinite(portionNum) && portionNum > 0 && portionNum <= 5000;
  const canSave =
    estimate !== null && validPortion && name.trim().length > 0 && !saving;

  const previewMacros =
    estimate && validPortion
      ? (() => {
          const scale = portionNum / 100;
          return {
            kcal: Math.round(estimate.kcalPer100g * scale),
            protein: Math.round(estimate.proteinPer100g * scale),
            carbs: Math.round(estimate.carbsPer100g * scale),
            fat: Math.round(estimate.fatPer100g * scale),
          };
        })()
      : null;

  async function save() {
    if (!estimate || !previewMacros || !canSave) return;
    setSaving(true);
    const result = await addFoodEntry({
      meal,
      eatenOn: todayKey(),
      name: name.trim(),
      portionGrams: portionNum,
      kcalPer100g: estimate.kcalPer100g,
      proteinPer100g: estimate.proteinPer100g,
      carbsPer100g: estimate.carbsPer100g,
      fatPer100g: estimate.fatPer100g,
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

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-label="Upload a food photo"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) handleFile(file);
      }}
    />
  );

  return (
    <div className="space-y-4">
      {fileInput}

      {stage === "idle" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ScanLine className="size-7" />
          </span>
          <div>
            <p className="text-sm font-medium">Photograph your meal</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Snap a photo or upload one — Gemini estimates the food, portion,
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
            Analyzing with Gemini…
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
                {confidenceMeta(estimate.confidence).label} ·{" "}
                {Math.round(estimate.confidence * 100)}%
              </span>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {estimate.notes || "AI estimate — verify before saving."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-name">What is it?</Label>
            <Input
              id="scan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken burrito bowl"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortionField
              id="scan-portion"
              value={portion}
              onChange={setPortion}
            />
            <MealSelect id="scan-meal" value={meal} onChange={setMeal} />
          </div>

          {previewMacros && <MacroPreview preview={previewMacros} />}

          <p className="text-xs text-muted-foreground">
            Estimates only — not medical or dietary advice. Adjust portions to
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
              {saving ? "Saving…" : "Save to diary"}
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
