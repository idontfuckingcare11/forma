"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAvatar, uploadAvatarFile } from "@/lib/actions/profile";
import {
  PRESET_AVATARS,
  UserAvatar,
} from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Check,
  FlipHorizontal,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AvatarUploaderProps = {
  userId: string;
  currentAvatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
};

// Resize & compress an image in-browser to a square 256x256 WebP or JPEG
async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        const targetSize = 256;
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        ctx.drawImage(
          img,
          startX,
          startY,
          size,
          size,
          0,
          0,
          targetSize,
          targetSize
        );

        // Try WebP first, fallback to JPEG
        let dataUrl = canvas.toDataURL("image/webp", 0.85);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Convert dataURL to Blob
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/webp";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export function AvatarUploader({
  userId,
  currentAvatarUrl,
  displayName,
  email,
}: AvatarUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    currentAvatarUrl ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Camera modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Keep state in sync if prop changes
  useEffect(() => {
    setAvatarUrl(currentAvatarUrl ?? null);
  }, [currentAvatarUrl]);

  // Clean up camera stream when modal closes
  useEffect(() => {
    if (!isCameraOpen && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [isCameraOpen, cameraStream]);

  async function startCamera() {
    setIsCameraOpen(true);
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not supported in this browser.");
      }

      // Stop any existing stream first
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: unknown) {
      console.warn("Unable to access live webcam:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to access camera. Please allow camera permissions.";
      setCameraError(msg);
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCameraError(null);
  }

  function flipCamera() {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: nextMode, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      })
      .then((stream) => {
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn("Could not switch camera:", err);
      });
  }

  function captureSnapshot() {
    const video = videoRef.current;
    if (!video) return;

    try {
      const targetSize = Math.min(video.videoWidth || 480, video.videoHeight || 480);
      const canvas = document.createElement("canvas");
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sx = ((video.videoWidth || targetSize) - targetSize) / 2;
      const sy = ((video.videoHeight || targetSize) - targetSize) / 2;

      // Mirror selfie preview if user-facing
      if (facingMode === "user") {
        ctx.translate(targetSize, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, targetSize, targetSize, 0, 0, targetSize, targetSize);

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Could not capture photo.");
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopCamera();
        handleFile(file);
      }, "image/jpeg", 0.9);
    } catch (err) {
      console.error("Capture snapshot failed:", err);
      toast.error("Could not capture photo from webcam.");
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large. Please select a file under 8 MB.");
      return;
    }

    setUploading(true);
    // Reset inputs so the same file can be re-selected after an error
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";

    try {
      // 1. Resize & compress image in client (crops to square, 256x256 WebP/JPEG)
      const processedDataUrl = await processImage(file);
      const blob = dataUrlToBlob(processedDataUrl);
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const processedFile = new File([blob], `avatar-${Date.now()}.${ext}`, {
        type: blob.type,
      });

      // 2. Upload via Server Action (bypasses browser client RLS issues, falls back to dataUrl if storage unavailable)
      const formData = new FormData();
      formData.append("file", processedFile);
      formData.append("dataUrl", processedDataUrl);

      const res = await uploadAvatarFile(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setAvatarUrl(res.url);
      toast.success("Profile photo updated!");
      router.refresh();
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error(
        err instanceof Error
          ? `Could not upload photo: ${err.message}`
          : "Could not process this image. Please try another."
      );
    } finally {
      setUploading(false);
    }
  }

  async function selectPreset(presetId: string) {
    setUploading(true);
    const res = await updateAvatar(presetId);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAvatarUrl(presetId);
    toast.success("Avatar updated!");
    router.refresh();
  }

  async function removeAvatar() {
    setUploading(true);
    const res = await updateAvatar(null);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAvatarUrl(null);
    toast.success("Avatar removed.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      {/* Avatar Preview & Dropzone */}
      <div
        className={cn(
          "group relative flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all",
          isDragging && "ring-4 ring-primary/30 scale-105"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        title="Click or drag and drop to upload photo"
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          name={displayName}
          email={email}
          size="2xl"
          showOnlineStatus
          className="transition-transform group-hover:scale-102"
        />

        {/* Hover overlay with camera icon */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-white" />
          ) : (
            <>
              <Camera className="size-6 text-white mb-1" />
              <span className="text-[11px] font-medium text-white">Change</span>
            </>
          )}
        </div>

        {/* Standard File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {/* Mobile Camera Capture Fallback */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Action Controls & Presets */}
      <div className="flex-1 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base tracking-tight">Profile Photo</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" /> Lively
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload your picture, snap with your camera, or pick a fitness persona.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs shadow-xs"
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Upload photo
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={startCamera}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Camera className="size-3.5" />
            Take photo
          </Button>

          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={removeAvatar}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          )}
        </div>

        {/* Fun Persona Presets */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            Or pick a quick fitness avatar:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_AVATARS.map((p) => {
              const isSelected = avatarUrl === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={uploading}
                  onClick={() => selectPreset(p.id)}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                    isSelected
                      ? "border-primary bg-primary/15 font-semibold text-foreground ring-1 ring-primary shadow-xs"
                      : "border-border/70 bg-card hover:border-primary/40 hover:bg-accent/50 text-muted-foreground"
                  )}
                >
                  <span className="text-sm">{p.emoji}</span>
                  <span>{p.label}</span>
                  {isSelected && <Check className="size-3 text-primary ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Camera Modal */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="size-5 text-primary" />
              Take Profile Photo
            </DialogTitle>
            <DialogDescription>
              Center your face in the circle, then click Capture.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-black aspect-square max-h-[360px] mx-auto w-full">
            {cameraError ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                <VideoOff className="size-10 text-muted-foreground" />
                <p className="text-sm font-medium">{cameraError}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      stopCamera();
                      cameraInputRef.current?.click();
                    }}
                    className="gap-1.5 text-xs"
                  >
                    <Camera className="size-3.5" />
                    Use Device Camera
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={startCamera}
                    className="gap-1.5 text-xs text-white border-white/20 hover:bg-white/10"
                  >
                    <RefreshCw className="size-3.5" />
                    Retry Camera
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "h-full w-full object-cover",
                    facingMode === "user" && "-scale-x-100"
                  )}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    v.play().catch(() => {});
                  }}
                />

                {/* Circular face guide overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="size-56 rounded-full border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                </div>

                {/* Flip camera control if supported */}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white backdrop-blur-xs hover:bg-black/80 transition-colors"
                  title="Switch camera"
                >
                  <FlipHorizontal className="size-4" />
                </button>
              </>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={stopCamera}
            >
              Cancel
            </Button>

            {!cameraError && (
              <Button
                type="button"
                size="sm"
                onClick={captureSnapshot}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold px-5 shadow-md hover:bg-primary/90"
              >
                <Camera className="size-4" />
                Capture Photo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
