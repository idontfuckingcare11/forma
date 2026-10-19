"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/food";
import { isValidDateKey, todayKey } from "@/lib/dates";

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;

export type LogWeightInput = {
  loggedOn: string;
  weightKg: number;
};

export async function logWeight(
  input: LogWeightInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  if (!isValidDateKey(input.loggedOn)) return { ok: false, error: "Invalid date." };
  if (input.loggedOn > todayKey())
    return { ok: false, error: "Weight date can't be in the future." };

  const weightKg = Math.round(input.weightKg * 10) / 10;
  if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG)
    return {
      ok: false,
      error: `Weight must be between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`,
    };

  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      { user_id: user.id, logged_on: input.loggedOn, weight_kg: weightKg },
      { onConflict: "user_id,logged_on" }
    )
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

export async function deleteWeightLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase
    .from("weight_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/progress");
  revalidatePath("/dashboard");
  return { ok: true };
}
