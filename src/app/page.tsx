import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Camera, LineChart, ListChecks, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Camera,
    title: "AI Food Analyzer",
    text: "Photograph any meal. Get identified foods, estimated portions, and macros you can correct before saving.",
  },
  {
    icon: ListChecks,
    title: "Effortless food diary",
    text: "Breakfast, lunch, dinner, and snacks — with search, portion control, and instant daily totals.",
  },
  {
    icon: LineChart,
    title: "Progress that stays honest",
    text: "Weight history, weekly averages, and calorie and protein trends from your actual logs.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    text: "Accounts, row-level security, and private per-user records. No shared data, ever.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            AI-powered nutrition tracking
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Track Your Food.{" "}
            <span className="text-primary">Master Your Cut.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Forma makes calorie and protein tracking as easy as taking a
            picture. Photograph a meal, adjust the estimate, and stay on target.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">Start tracking free</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>

          <div className="mx-auto mt-16 grid w-full max-w-3xl grid-cols-2 gap-3 sm:gap-4">
            {[
              { label: "Calories", value: "1,250 / 1,900 kcal" },
              { label: "Protein", value: "95 / 140 g" },
              { label: "Water", value: "1.5 / 2.5 L" },
              { label: "Remaining", value: "650 kcal left" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card px-4 py-5 text-left"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Illustrative example — your dashboard uses your real logged data.
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-base font-semibold tracking-tight">
                    {feature.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
