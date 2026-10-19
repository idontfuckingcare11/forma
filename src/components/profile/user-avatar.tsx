"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const PRESET_AVATARS: { id: string; label: string; emoji: string; gradient: string }[] = [
  { id: "preset:electric", label: "Energy", emoji: "⚡", gradient: "from-amber-400 to-orange-500" },
  { id: "preset:runner", label: "Athlete", emoji: "🏃", gradient: "from-emerald-400 to-teal-500" },
  { id: "preset:lifter", label: "Strength", emoji: "🏋️", gradient: "from-cyan-400 to-blue-600" },
  { id: "preset:clean", label: "Nutrition", emoji: "🥑", gradient: "from-lime-400 to-emerald-600" },
  { id: "preset:fire", label: "Beast Mode", emoji: "🔥", gradient: "from-rose-400 to-red-600" },
  { id: "preset:zen", label: "Mindset", emoji: "🧘", gradient: "from-violet-400 to-purple-600" },
];

export function isPresetAvatar(url?: string | null): boolean {
  return Boolean(url && url.startsWith("preset:"));
}

export function getPresetAvatar(url?: string | null) {
  if (!url) return null;
  return PRESET_AVATARS.find((p) => p.id === url) ?? null;
}

const GRADIENTS = [
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-blue-500 via-indigo-500 to-violet-500",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-fuchsia-500 via-purple-500 to-indigo-500",
  "from-teal-400 via-emerald-500 to-green-600",
];

function getGradientForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showOnlineStatus?: boolean;
};

const SIZE_MAP = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
  "2xl": "size-24 text-3xl",
};

const STATUS_SIZE_MAP = {
  sm: "size-2 -bottom-0.5 -right-0.5",
  md: "size-2.5 bottom-0 right-0",
  lg: "size-3 bottom-0.5 right-0.5",
  xl: "size-3.5 bottom-1 right-1",
  "2xl": "size-5 bottom-1.5 right-1.5",
};

export function UserAvatar({
  avatarUrl,
  name,
  email,
  size = "md",
  className,
  showOnlineStatus = false,
}: UserAvatarProps) {
  const displayName = name?.trim() || email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  const preset = useMemo(() => getPresetAvatar(avatarUrl), [avatarUrl]);
  const gradient = useMemo(() => getGradientForName(displayName), [displayName]);

  return (
    <div className={cn("relative inline-flex shrink-0 rounded-full", className)}>
      {preset ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gradient-to-br font-semibold shadow-inner select-none transition-transform",
            preset.gradient,
            SIZE_MAP[size]
          )}
          title={displayName}
        >
          <span>{preset.emoji}</span>
        </div>
      ) : (
        <Avatar
          className={cn(
            "rounded-full transition-transform",
            SIZE_MAP[size]
          )}
        >
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt={displayName}
              className="object-cover"
            />
          )}
          <AvatarFallback
            className={cn(
              "flex size-full items-center justify-center rounded-full bg-gradient-to-tr font-bold text-white shadow-inner select-none",
              gradient
            )}
          >
            {initial}
          </AvatarFallback>
        </Avatar>
      )}

      {showOnlineStatus && (
        <span
          className={cn(
            "absolute rounded-full bg-emerald-500 ring-2 ring-background shadow-xs",
            STATUS_SIZE_MAP[size]
          )}
          aria-label="Online status"
        />
      )}
    </div>
  );
}
