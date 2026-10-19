import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";

// Auth reads cookies() per request — this route group is always dynamic.
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: goals }, { data: profile }] = await Promise.all([
    supabase
      .from("nutrition_goals")
      .select("onboarding_completed, goal_type")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, email, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!goals?.onboarding_completed) {
    redirect("/onboarding");
  }

  const userSummary = {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    goalType: goals?.goal_type ?? null,
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar user={userSummary} />
      <div className="lg:pl-60">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:pb-10 lg:pt-8"
        >
          {children}
        </main>
      </div>
      <BottomNav user={userSummary} />
    </div>
  );
}
