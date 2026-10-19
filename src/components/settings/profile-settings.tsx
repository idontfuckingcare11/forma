"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/lib/actions/profile";
import type { UnitSystem } from "@/lib/db-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Separator } from "@/components/ui/separator";

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Lose fat",
  maintenance: "Maintain",
  muscle_gain: "Build muscle",
};

export function ProfileSettings({
  userId,
  email,
  displayName,
  avatarUrl,
  unitSystem,
  goalType,
  dietaryPreferences,
}: {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  unitSystem: UnitSystem;
  goalType: string;
  dietaryPreferences: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);

  async function saveName() {
    setSaving(true);
    const result = await updateDisplayName(name);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Name updated.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile & Identity</CardTitle>
        <CardDescription>
          Customize your photo, how Forma addresses you, and review your preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AvatarUploader
          userId={userId}
          currentAvatarUrl={avatarUrl}
          displayName={name || displayName}
          email={email}
        />

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="opacity-70" />
            <p className="text-xs text-muted-foreground">
              Email changes go through your email provider.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                maxLength={50}
              />
              <Button
                type="button"
                onClick={saveName}
                disabled={saving || name === displayName}
                className="shrink-0"
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Units</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {unitSystem === "metric" ? "Kilograms · centimeters" : "Pounds · feet/inches"}
              — changeable during your next onboarding update.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Current goal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {GOAL_LABELS[goalType] ?? goalType}
              {dietaryPreferences.length > 0 && (
                <> · {dietaryPreferences.join(", ")}</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
