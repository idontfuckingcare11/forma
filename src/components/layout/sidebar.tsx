"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/logo";
import { MAIN_NAV } from "@/components/layout/nav-items";
import { UserAvatar } from "@/components/profile/user-avatar";
import { cn } from "@/lib/utils";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type SidebarUser = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  goalType?: string | null;
};

export function Sidebar({ user }: { user?: SidebarUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Could not sign out. Try again.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  const goalLabel = user?.goalType
    ? user.goalType.replace("_", " ")
    : "Active Member";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-20 items-center px-3 pt-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 rounded-xl p-1 transition-transform hover:scale-[1.02]"
          title="Forma Dashboard"
        >
          <Logo size="lg" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
        {MAIN_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Lively User Profile Card */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Link
          href="/profile"
          className={cn(
            "group flex items-center gap-3 rounded-xl border p-2 transition-all",
            pathname === "/profile"
              ? "bg-sidebar-accent border-sidebar-border ring-1 ring-primary/20 shadow-xs"
              : "border-transparent hover:bg-sidebar-accent/70 hover:border-sidebar-border/50"
          )}
          title="Profile & Settings"
        >
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            name={user?.displayName}
            email={user?.email}
            size="md"
            showOnlineStatus
          />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              {user?.displayName || user?.email?.split("@")[0] || "Athlete"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground capitalize">
              {goalLabel}
            </p>
          </div>
          <Settings className="size-4 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100 group-hover:rotate-45" />
        </Link>

        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
