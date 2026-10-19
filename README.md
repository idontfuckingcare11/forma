# Forma

AI-powered nutrition and fitness tracking. Photograph a meal, adjust the estimate, stay on target.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth, RLS on every table)
- Recharts, Gemini vision (Phase 4), Open Food Facts (Phase 3)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env.local` and fill in:

   | Variable | Purpose |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-safe) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-safe) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never import in client code. |
   | `GEMINI_API_KEY` | Server-only. Powers the AI food analyzer and assistant. |
   | `GEMINI_MODEL` | Optional. Defaults to `gemini-3.8-flash`; set to a model your key can access (e.g. `gemini-3.5-flash-lite`). |

3. **Database** — open your Supabase project → **SQL Editor**, create a new query,
   paste the entire contents of `supabase/setup.sql`, and run it. This single script
   creates every table, RLS policy, and the signup trigger, and seeds ~60 staple
   foods. It is idempotent, so it is safe to re-run. The versioned originals live in
   `supabase/migrations/` (`0001_init.sql`, `0002_seed_foods.sql`).

4. **Run**

   ```bash
   npm run dev
   ```

   Camera access (Phase 4) requires HTTPS or localhost.

## Checks

```bash
npx tsc --noEmit   # types
npx eslint .       # lint
npm run build      # production build
```

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Design system, auth, shell, schema, dashboard | ✅ done |
| 2 | Onboarding + customizable nutrition goals | ✅ done |
| 3 | Food diary, manual entry, Open Food Facts search, water logging | ✅ done |
| 4 | Camera + Gemini AI food analyzer | ✅ done |
| 5 | Weight/progress pages + AI nutrition assistant | ✅ done |
| 6 | Hardening, a11y, mobile QA | ✅ done |

> **Pending E2E verification:** run `supabase/setup.sql` in the Supabase SQL editor — authenticated flows (onboarding, diary, photos, progress, assistant) cannot be exercised until the tables exist. The Gemini key and both API request shapes (vision + chat) are verified live against `gemini-3.5-flash-lite`.
