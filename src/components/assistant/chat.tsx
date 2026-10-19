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
    <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
        aria-live="polite"
      >
        {messages.length === 0 && !busy && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium">Ask about your nutrition</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Answers use your real diary, weight logs, and targets — not
                guesses.
              </p>
            </div>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => void send(s)}
                  disabled={!aiEnabled}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={cn(
              "flex w-full gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              )}
            >
              {message.content}
            </div>
            {message.role === "user" && (
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <User className="size-4" />
              </span>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              aiEnabled
                ? "Ask anything… (Enter to send, Shift+Enter for a new line)"
                : "Set GEMINI_API_KEY to enable the assistant"
            }
            disabled={!aiEnabled || busy}
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none"
            aria-label="Message the assistant"
          />
          <Button
            size="icon"
            onClick={() => void send(input)}
            disabled={!aiEnabled || busy || !input.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimates only — not medical or dietary advice. AI can be wrong;
          double-check important numbers.
        </p>
      </div>
    </div>
  );
}
