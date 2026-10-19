"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV } from "@/components/layout/nav-items";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { SidebarUser } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

export function BottomNav({ user }: { user?: SidebarUser | null }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)]">
        {BOTTOM_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const isScan = item.href === "/scan";
          const isProfile = item.href === "/profile";
          const Icon = item.icon;

          if (isScan) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex justify-center"
                aria-label={item.label}
              >
                <span
                  className={cn(
                    "flex size-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95",
                    active && "glow-primary"
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              {isProfile ? (
                <UserAvatar
                  avatarUrl={user?.avatarUrl}
                  name={user?.displayName}
                  email={user?.email}
                  size="sm"
                  className={cn("transition-transform", active && "scale-110 ring-2 ring-primary")}
                />
              ) : (
                <Icon className="size-5" />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
