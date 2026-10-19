"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { estimateTargets, type ActivityLevel, type Sex, type Estimate } from "@/lib/nutrition";
import type { GoalType, UnitSystem } from "@/lib/db-types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Upload a profile photo via server action.
 * Using the service-role client means no storage RLS policies are needed on the
 * avatars bucket for authenticated users — the server validates the session and
 * acts on behalf of the user.
 */
export async function uploadAvatarFile(
  formData: FormData
): Promise<UploadAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const file = formData.get("file") as File | null;
  const dataUrl = formData.get("dataUrl") as string | null;

  if (!file && !dataUrl) {
    return { ok: false, error: "No image file received." };
  }

  let finalUrl: string | null = null;

  // 1. Try uploading to Supabase Storage bucket using service-role client (bypasses RLS)
  try {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Ensure avatars bucket exists
    try {
      const { data: buckets } = await admin.storage.listBuckets();
      const hasAvatars = buckets?.some((b) => b.name === "avatars");
      if (!hasAvatars) {
        await admin.storage.createBucket("avatars", {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
        });
      }
    } catch {
      // Ignore bucket creation check if already present
    }

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext =
        file.type === "image/webp"
          ? "webp"
          : file.type === "image/png"
          ? "png"
          : "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await admin.storage
        .from("avatars")
        .upload(path, buffer, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });

      if (!uploadErr && uploadData) {
        const { data: publicUrlData } = admin.storage
          .from("avatars")
          .getPublicUrl(path);
        if (publicUrlData?.publicUrl) {
          finalUrl = publicUrlData.publicUrl;
        }
      } else if (uploadErr) {
        console.warn("Storage upload failed, falling back to data URL:", uploadErr.message);
      }
    }
  } catch (storageErr) {
    console.warn("Storage service exception:", storageErr);
  }

  // 2. If storage upload failed or was skipped, fall back to compressed dataUrl
  if (!finalUrl && dataUrl) {
    finalUrl = dataUrl;
  }

  if (!finalUrl) {
    return { ok: false, error: "Could not upload image. Please try again." };
  }

  // 3. Save the avatar URL to the profiles table
  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: finalUrl })
    .eq("id", user.id);

  if (dbErr) {
    if (
      dbErr.message?.includes("avatar_url") ||
      dbErr.code === "PGRST204" ||
      dbErr.code === "42703"
    ) {
      return {
        ok: false,
        error:
          "Database column 'avatar_url' is missing. Please run supabase/setup.sql in your Supabase SQL editor.",
      };
    }
    return { ok: false, error: dbErr.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true, url: finalUrl };
}


export type OnboardingInput = {
  unitSystem: UnitSystem;
  sex: Sex;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  exerciseDaysPerWeek: number;
  goal: GoalType;
  dietaryPreferences: string[];
  // Optional manual overrides; when null the estimate is used.
  overrides: {
    calorieTarget: number | null;
    proteinTarget: number | null;
    carbTarget: number | null;
    fatTarget: number | null;
    waterTargetMl: number | null;
  };
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function saveOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You are not signed in." };

  // Server-side sanity checks — never trust client numbers blindly.
  if (
    !Number.isFinite(input.age) ||
    !Number.isFinite(input.heightCm) ||
    !Number.isFinite(input.currentWeightKg) ||
    !Number.isFinite(input.targetWeightKg)
  ) {
    return { ok: false, error: "Please enter valid body measurements." };
  }

  const age = Math.round(clampNumber(input.age, 13, 100));
  const heightCm = clampNumber(input.heightCm, 120, 230);
  const currentWeightKg = clampNumber(input.currentWeightKg, 30, 300);
  const targetWeightKg = clampNumber(input.targetWeightKg, 30, 300);
  const exerciseDaysPerWeek = Math.round(
    clampNumber(input.exerciseDaysPerWeek, 0, 7)
  );

  const estimate = estimateTargets({
    sex: input.sex,
    age,
    heightCm,
    currentWeightKg,
    targetWeightKg,
    activityLevel: input.activityLevel,
    exerciseDaysPerWeek,
    goal: input.goal,
  });

  const calorieTarget = Math.round(
    input.overrides.calorieTarget ?? estimate.calorieTarget
  );
  const proteinTarget = Math.round(
    input.overrides.proteinTarget ?? estimate.proteinTarget
  );
  const carbTarget = Math.round(input.overrides.carbTarget ?? estimate.carbTarget);
  const fatTarget = Math.round(input.overrides.fatTarget ?? estimate.fatTarget);
  const waterTargetMl = Math.round(
    input.overrides.waterTargetMl ?? estimate.waterTargetMl
  );

  if (calorieTarget < 800 || calorieTarget > 10000) {
    return { ok: false, error: "Calorie target looks unrealistic." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ unit_system: input.unitSystem })
    .eq("id", user.id);

  if (profileError) return { ok: false, error: profileError.message };

  const { error } = await supabase
    .from("nutrition_goals")
    .update({
      calorie_target: calorieTarget,
      protein_target: proteinTarget,
      carb_target: carbTarget,
      fat_target: fatTarget,
      water_target_ml: waterTargetMl,
      goal_type: input.goal,
      maintenance_calories: estimate.maintenanceCalories,
      current_weight_kg: currentWeightKg,
      target_weight_kg: targetWeightKg,
      height_cm: heightCm,
      age,
      sex: input.sex,
      activity_level: input.activityLevel,
      exercise_days_per_week: exerciseDaysPerWeek,
      dietary_preferences: input.dietaryPreferences,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}

export type GoalsInput = {
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTargetMl: number;
};

export async function updateGoals(input: GoalsInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const values = [
    input.calorieTarget,
    input.proteinTarget,
    input.carbTarget,
    input.fatTarget,
    input.waterTargetMl,
  ];
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 20000)) {
    return { ok: false, error: "Please enter realistic target values." };
  }
  if (input.calorieTarget < 800) {
    return { ok: false, error: "Calorie target cannot be below 800 kcal." };
  }

  const { error } = await supabase
    .from("nutrition_goals")
    .update({
      calorie_target: Math.round(input.calorieTarget),
      protein_target: Math.round(input.proteinTarget),
      carb_target: Math.round(input.carbTarget),
      fat_target: Math.round(input.fatTarget),
      water_target_ml: Math.round(input.waterTargetMl),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}

export async function recalculateUserTargets(
  newGoalType?: GoalType
): Promise<ActionResult & { targets?: Estimate }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { data: goals, error: fetchErr } = await supabase
    .from("nutrition_goals")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !goals) {
    return { ok: false, error: "Could not load current profile measurements." };
  }

  const selectedGoal = newGoalType ?? (goals.goal_type as GoalType) ?? "fat_loss";

  const estimate = estimateTargets({
    sex: (goals.sex as Sex) ?? "male",
    age: goals.age ?? 27,
    heightCm: Number(goals.height_cm) || 170,
    currentWeightKg: Number(goals.current_weight_kg) || 72,
    targetWeightKg: Number(goals.target_weight_kg) || 65,
    activityLevel: (goals.activity_level as ActivityLevel) ?? "moderate",
    exerciseDaysPerWeek: Number(goals.exercise_days_per_week) || 4,
    goal: selectedGoal,
  });

  const { error: updateErr } = await supabase
    .from("nutrition_goals")
    .update({
      calorie_target: estimate.calorieTarget,
      protein_target: estimate.proteinTarget,
      carb_target: estimate.carbTarget,
      fat_target: estimate.fatTarget,
      water_target_ml: estimate.waterTargetMl,
      maintenance_calories: estimate.maintenanceCalories,
      goal_type: selectedGoal,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true, targets: estimate };
}

export async function updateDisplayName(name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.trim() || null })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateAvatar(avatarUrl: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (error) {
    if (
      error.message?.includes("avatar_url") ||
      error.code === "PGRST204" ||
      error.code === "42703"
    ) {
      return {
        ok: false,
        error: "Database column 'avatar_url' is missing. Please run the updated supabase/setup.sql in your Supabase SQL editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  // Deleting the auth user cascades to all rows referencing auth.users(id).
  // Service role is used here only, server-side, after verifying the session.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };

  await supabase.auth.signOut();
  return { ok: true };
}
