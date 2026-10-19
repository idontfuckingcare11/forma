import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <p className="text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          That page doesn&apos;t exist — the link may be old or mistyped.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
