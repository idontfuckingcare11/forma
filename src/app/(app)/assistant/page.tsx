import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/chat";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  const aiEnabled = Boolean(process.env.GEMINI_API_KEY);

  return (
    <div className="space-y-3.5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          AI Nutrition Assistant
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Ask anything about your diary, targets, or progress — answers are
          grounded in your actual logged data.
        </p>
      </div>

      {!aiEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            <span className="font-medium">The assistant is disabled.</span> Add{" "}
            <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">
              GEMINI_API_KEY
            </code>{" "}
            to <code className="rounded bg-amber-500/20 px-1 py-0.5 text-xs">.env.local</code>{" "}
            (get one free at aistudio.google.com) and restart the dev server.
          </p>
        </div>
      )}

      <AssistantChat aiEnabled={aiEnabled} />
    </div>
  );
}
