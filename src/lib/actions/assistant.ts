"use server";

import { generateText, type ChatMessage } from "@/lib/ai/gemini";
import { enforceCooldown } from "@/lib/ai/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/food";
import { lastNDaysKeys, todayKey } from "@/lib/dates";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_TURNS = 8;
const MAX_QUESTION_CHARS = 2000;
const MAX_CONTEXT_CHARS = 500;

function truncate(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function sanitizeHistory(history: unknown): ChatTurn[] {
  const source = Array.isArray(history) ? history : [];
  const turns: ChatTurn[] = [];
  for (const turn of source) {
    if (typeof turn !== "object" || turn === null) continue;
    const { role, content } = turn as { role?: unknown; content?: unknown };
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.length > 0
    ) {
      turns.push({ role, content });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function askAssistant(
  question: unknown,
  history: unknown
): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const cooldown = enforceCooldown("assistant", user.id, 2000);
  if (cooldown) return { ok: false, error: cooldown };

  if (typeof question !== "string" || !question.trim())
    return { ok: false, error: "Ask a question first." };
  const q = question.trim();
  if (q.length > MAX_QUESTION_CHARS)
    return { ok: false, error: "That question is too long — keep it under 2000 characters." };

  const safeHistory = sanitizeHistory(history);

  const today = todayKey();
  const weekKeys = lastNDaysKeys(14);

  const [profileRes, goalsRes, todayRes, weekRes, weightRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, unit_system")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("nutrition_goals")
        .select(
          "calorie_target, protein_target, carb_target, fat_target, water_target_ml, goal_type, dietary_preferences"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("food_entries")
        .select("meal, name, portion_grams, kcal, protein, carbs, fat")
        .eq("user_id", user.id)
        .eq("eaten_on", today),
      supabase
        .from("food_entries")
        .select("eaten_on, kcal, protein")
        .eq("user_id", user.id)
        .gte("eaten_on", weekKeys[0])
        .lte("eaten_on", weekKeys[weekKeys.length - 1]),
      supabase
        .from("weight_logs")
        .select("logged_on, weight_kg")
        .eq("user_id", user.id)
        .gte("logged_on", weekKeys[0])
        .order("logged_on", { ascending: true }),
    ]);

  if (todayRes.error) return { ok: false, error: todayRes.error.message };
  if (weekRes.error) return { ok: false, error: weekRes.error.message };
  if (weightRes.error) return { ok: false, error: weightRes.error.message };

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const todayEntries = (todayRes.data ?? []) as unknown as {
    meal: string;
    name: string;
    portion_grams: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];

  const todayTotals = todayEntries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + toNumber(e.kcal),
      protein: acc.protein + toNumber(e.protein),
      carbs: acc.carbs + toNumber(e.carbs),
      fat: acc.fat + toNumber(e.fat),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // 14-day daily aggregates.
  const perDay = new Map<string, { kcal: number; protein: number }>();
  for (const row of (weekRes.data ?? []) as unknown as {
    eaten_on: string;
    kcal: unknown;
    protein: unknown;
  }[]) {
    const day = perDay.get(row.eaten_on) ?? { kcal: 0, protein: 0 };
    day.kcal += toNumber(row.kcal);
    day.protein += toNumber(row.protein);
    perDay.set(row.eaten_on, day);
  }
  const history14 = weekKeys
    .map((key) => {
      const day = perDay.get(key);
      return day
        ? `${key}: ${Math.round(day.kcal)} kcal, ${Math.round(day.protein)} g protein`
        : `${key}: nothing logged`;
    })
    .join("\n");

  const weights = (weightRes.data ?? []) as unknown as {
    logged_on: string;
    weight_kg: unknown;
  }[];
  const weightLine =
    weights.length === 0
      ? "No weight logged in the last 14 days."
      : weights
          .map((w) => `${w.logged_on}: ${toNumber(w.weight_kg)} kg`)
          .join("\n");

  const dietary = Array.isArray(goals?.dietary_preferences)
    ? (goals.dietary_preferences as string[]).join(", ") || "none"
    : "none";

  const context = [
    `Today: ${today}`,
    `User: ${profile?.display_name ?? "unknown"} · units: ${profile?.unit_system ?? "metric"}`,
    goals
      ? `Targets: ${goals.calorie_target} kcal, ${goals.protein_target} g protein, ${goals.carb_target} g carbs, ${goals.fat_target} g fat, ${goals.water_target_ml} ml water · goal: ${goals.goal_type} · dietary preferences: ${dietary}`
      : "Targets: not set.",
    ``,
    `Today's diary (${todayEntries.length} items):`,
    todayEntries.length
      ? todayEntries
          .map(
            (e) =>
              `- ${e.meal}: ${e.name} (${Math.round(e.portion_grams)} g) — ${Math.round(e.kcal)} kcal, ${Math.round(e.protein)} g P, ${Math.round(e.carbs)} g C, ${Math.round(e.fat)} g F`
          )
          .join("\n")
      : "- nothing logged yet",
    `Today totals: ${Math.round(todayTotals.kcal)} kcal, ${Math.round(todayTotals.protein)} g protein, ${Math.round(todayTotals.carbs)} g carbs, ${Math.round(todayTotals.fat)} g fat`,
    ``,
    `Last 14 days (daily kcal, protein):`,
    history14,
    ``,
    `Weight logs (last 14 days):`,
    weightLine,
  ].join("\n");

  const system = `You are Forma's AI nutrition assistant inside a calorie- and macro-tracking app.

Your job: answer the user's questions about their nutrition, diary, progress, and goals using ONLY the context below for anything personal.

Context:
${context}

Rules:
- Any personal fact (food eaten, remaining macros, weight, targets, streaks) must come from the context. If the answer is not in the context, say the app does not have that data — never guess or invent logged food.
- Food/database questions without personal context (e.g. "is rice high in carbs") may be answered from general knowledge, but flag that values are rough estimates.
- You are not a doctor or dietitian. Give practical, evidence-based estimates only, and recommend professional help for medical conditions, injuries, eating disorders, or pregnancy.
- Be friendly and direct. Keep replies under 120 words unless the user explicitly asks for detail. Plain text with short lines or simple lists; no markdown headers.`;

  const chat: ChatMessage[] = [
    ...safeHistory.map<ChatMessage>((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      text: truncate(t.content, MAX_CONTEXT_CHARS),
    })),
    { role: "user", text: q },
  ];

  const result = await generateText(system, chat);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, data: result.text };
}
