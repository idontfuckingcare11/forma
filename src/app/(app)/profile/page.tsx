import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { io } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GoalsSettings } from "@/components/settings/goals-settings";
import { AccountSettings } from "@/components/settings/account-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { AiCoachCard } from "@/components/profile/ai-coach-card";
import type { GoalType } from "@/lib/db-types";

export const metadata: Metadata = { title: "Profile & Settings" };

// Page fetches per-request user data — opt out of instant/prefetch navigation.
export const instant = false;

export default async function ProfilePage() {
  await io();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileRes, goalsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, unit_system, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("nutrition_goals")
      .select(
        "calorie_target, protein_target, carb_target, fat_target, water_target_ml, maintenance_calories, goal_type, current_weight_kg, target_weight_kg, height_cm, age, sex, activity_level, exercise_days_per_week, dietary_preferences"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile & Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account, photo, units, and nutrition targets.
        </p>
      </div>

      <AiCoachCard displayName={profileRes.data?.display_name} />

      <ProfileSettings
        userId={user.id}
        email={user.email ?? ""}
        displayName={profileRes.data?.display_name ?? ""}
        avatarUrl={profileRes.data?.avatar_url ?? null}
        unitSystem={profileRes.data?.unit_system ?? "metric"}
        goalType={goalsRes.data?.goal_type ?? "fat_loss"}
        dietaryPreferences={
          (goalsRes.data?.dietary_preferences as string[] | null) ?? []
        }
      />

      {goalsRes.data && (
        <GoalsSettings
          calorieTarget={goalsRes.data.calorie_target}
          proteinTarget={goalsRes.data.protein_target}
          carbTarget={goalsRes.data.carb_target}
          fatTarget={goalsRes.data.fat_target}
          waterTargetMl={goalsRes.data.water_target_ml}
          maintenanceCalories={goalsRes.data.maintenance_calories}
          currentGoalType={goalsRes.data.goal_type as GoalType}
        />
      )}

      <AccountSettings email={user.email ?? ""} />
    </div>
  );
}
