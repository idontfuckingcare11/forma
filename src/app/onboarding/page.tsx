import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Set up your targets" };

// Auth + goals check read cookies() per request — always dynamic.
export const instant = false;

// Auth-only layout (no onboarding gate) — the wizard is the gate itself.
export default async function OnboardingPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: goals } = await supabase
    .from("nutrition_goals")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (goals?.onboarding_completed) redirect("/dashboard");

  return (
    <div className="min-h-dvh px-4 py-10 sm:py-14">
      <OnboardingWizard />
    </div>
  );
}
