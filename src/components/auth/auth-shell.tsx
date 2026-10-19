"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}
