import type { Metadata } from "next";
import { ScanAnalyzer } from "@/components/scan/scan-analyzer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Camera, Lightbulb, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "AI Analyzer" };

const TIPS = [
  {
    icon: Camera,
    text: "One meal per photo, in decent light. Include the whole plate for a better portion estimate.",
  },
  {
    icon: Sparkles,
    text: "The AI guesses from the image — always check the name, portion, and macros before saving.",
  },
  {
    icon: Lightbulb,
    text: "Homemade dishes with visible oil or sauce are the least accurate; correct the portion if needed.",
  },
];

export default function ScanPage() {
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Food Analyzer</h1>
      </div>

      {!aiEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            <span className="font-medium">AI analysis is disabled.</span> Add{" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
              GEMINI_API_KEY
            </code>{" "}
            to <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">.env.local</code>{" "}
            (get one free at aistudio.google.com) and restart the dev server.
          </p>
        </div>
      )}

      <ScanAnalyzer aiEnabled={aiEnabled} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-primary" />
            Tips for better estimates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {TIPS.map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <tip.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{tip.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
