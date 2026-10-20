"use client";

import Link from "next/link";
import { Bot, MessageCircle, Sparkles, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QUICK_PROMPTS = [
  "What should I eat next to hit my protein goal today?",
  "Review my nutrition and calorie progress this week",
  "Suggest 3 quick high-protein snack ideas",
];

export function AiCoachCard({ displayName }: { displayName?: string | null }) {
  const greeting = displayName ? `Hi ${displayName.split(" ")[0]}!` : "Welcome!";

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-secondary/30 shadow-sm transition-all hover:border-primary/50">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 size-40 rounded-full bg-primary/10 blur-3xl" />

      <CardContent className="relative space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 text-primary-foreground shadow-md shadow-primary/20">
              <Bot className="size-6" />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full border-2 border-background bg-emerald-500" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                  AI Nutrition Assistant
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Sparkles className="size-2.5" />
                  Available 24/7
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {greeting} Ask anything about your meals, personalized macros, or what to eat next.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center sm:self-center">
            <Button asChild size="sm" className="w-full gap-2 shadow-sm sm:w-auto">
              <Link href="/assistant">
                <MessageCircle className="size-4" />
                <span>Open Chat</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick prompt suggestions */}
        <div className="pt-1 border-t border-border/40">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Zap className="size-3 text-primary" />
            Quick questions you can ask:
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <Link
                key={prompt}
                href={`/assistant?q=${encodeURIComponent(prompt)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-xs text-foreground/90 transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
              >
                <span>&ldquo;{prompt}&rdquo;</span>
                <ArrowRight className="size-3 text-muted-foreground opacity-60" />
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
