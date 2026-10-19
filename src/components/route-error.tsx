"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export function RouteError({
  error,
  reset,
  homeHref = "/dashboard",
  homeLabel = "Back to dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <TriangleAlert className="size-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The page hit an unexpected error. Your data is safe — try again.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground/70">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href={homeHref}>{homeLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
