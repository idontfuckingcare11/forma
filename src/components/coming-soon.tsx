import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction } from "lucide-react";

export const metadata: Metadata = { title: "Coming soon" };

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Construction className="size-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-primary">{phase}</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
