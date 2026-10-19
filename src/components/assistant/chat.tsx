"use client";

import { useEffect, useRef, useState } from "react";
import { askAssistant, type ChatTurn } from "@/lib/actions/assistant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How much protein do I still need today?",
  "How did I do this week?",
  "What can I eat to stay under my calorie target?",
];

export function AssistantChat({ aiEnabled }: { aiEnabled: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    if (!aiEnabled) {
      toast.error("Set GEMINI_API_KEY in .env.local to use the assistant.");
      return;
    }

    const history: ChatTurn[] = messages;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);

    const result = await askAssistant(question, history);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const reply = result.data;
    if (!reply) {
      toast.error("The assistant returned no reply.");
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[420px] max-h-[700px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs sm:h-[620px]">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3.5 overflow-y-auto p-3.5 sm:p-4"
        aria-live="polite"
      >
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 py-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Ask about your nutrition</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Answers use your real diary, weight logs, and targets — not
                guesses.
              </p>
            </div>
            <div className="flex max-w-sm flex-col sm:flex-row flex-wrap justify-center gap-1.5 w-full pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={!aiEnabled}
                  className="rounded-xl border border-border/80 bg-secondary/50 hover:bg-secondary px-3 py-2 text-xs font-medium text-foreground text-left sm:text-center transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={cn(
              "flex w-full gap-2.5 sm:gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-3.5 sm:size-4" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-secondary text-foreground"
              )}
            >
              {message.content}
            </div>
            {message.role === "user" && (
              <span className="mt-0.5 flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <User className="size-3.5 sm:size-4" />
              </span>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-3.5 sm:size-4" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2 text-xs sm:text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card/60 p-2.5 sm:p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              aiEnabled
                ? "Ask anything about your nutrition…"
                : "Set GEMINI_API_KEY to enable the assistant"
            }
            disabled={!aiEnabled || busy}
            rows={1}
            className="max-h-28 min-h-11 flex-1 resize-none py-2.5 px-3 text-sm rounded-xl"
            aria-label="Message the assistant"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void send(input)}
            disabled={!aiEnabled || busy || !input.trim()}
            className="size-11 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-center sm:text-left text-[10px] text-muted-foreground">
          Estimates only — AI can be wrong; verify important numbers.
        </p>
      </div>
    </div>
  );
}
