-- Forma initial schema
-- Run in the Supabase SQL editor or via `supabase db push`.

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snacks');
create type public.unit_system as enum ('metric', 'imperial');
create type public.goal_type as enum ('fat_loss', 'maintenance', 'muscle_gain');

-- =========================================================
-- Profiles
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  unit_system public.unit_system not null default 'metric',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- =========================================================
-- Nutrition goals
-- =========================================================
create table public.nutrition_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_target integer not null default 2000 check (calorie_target > 0),
  protein_target integer not null default 140 check (protein_target >= 0),
  carb_target integer not null default 200 check (carb_target >= 0),
  fat_target integer not null default 60 check (fat_target >= 0),
  water_target_ml integer not null default 2500 check (water_target_ml > 0),
  goal_type public.goal_type not null default 'fat_loss',
  maintenance_calories integer,
  current_weight_kg numeric(5, 2),
  target_weight_kg numeric(5, 2),
  height_cm numeric(5, 1),
  age smallint,
  sex text check (sex in ('male', 'female', 'unspecified')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very_active', 'athlete')),
  exercise_days_per_week smallint check (exercise_days_per_week between 0 and 7),
  dietary_preferences text[] not null default '{}',
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

create policy "Users can view own goals"
  on public.nutrition_goals for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own goals"
  on public.nutrition_goals for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own goals"
  on public.nutrition_goals for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =========================================================
-- Food items (global seeds have user_id null; personal foods are owned)
-- =========================================================
create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  source text not null default 'manual'
    check (source in ('manual', 'seed', 'openfoodfacts', 'ai', 'usda')),
  external_id text,
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g >= 0),
  protein_per_100g numeric(6, 2) not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g numeric(6, 2) not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g numeric(6, 2) not null default 0 check (fat_per_100g >= 0),
  serving_label text,
  serving_grams numeric(7, 2) check (serving_grams > 0),
  created_at timestamptz not null default now()
);

create index food_items_user_id_idx on public.food_items (user_id);
create index food_items_name_idx on public.food_items (lower(name));

alter table public.food_items enable row level security;

create policy "Users can view global and own food items"
  on public.food_items for select
  using (user_id is null or (select auth.uid()) = user_id);

create policy "Users can insert own food items"
  on public.food_items for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own food items"
  on public.food_items for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own food items"
  on public.food_items for delete
  using ((select auth.uid()) = user_id);

-- =========================================================
-- AI analyses (raw vision results, kept for audit/re-run)
-- =========================================================
create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index ai_analyses_user_id_idx on public.ai_analyses (user_id);

alter table public.ai_analyses enable row level security;

create policy "Users can view own AI analyses"
  on public.ai_analyses for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own AI analyses"
  on public.ai_analyses for insert
  with check ((select auth.uid()) = user_id);

-- =========================================================
-- Food entries (the diary)
-- =========================================================
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_item_id uuid references public.food_items (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete set null,
  meal public.meal_type not null,
  eaten_on date not null default current_date,
  name text not null,
  portion_grams numeric(8, 2) not null check (portion_grams > 0),
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein numeric(7, 2) not null default 0 check (protein >= 0),
  carbs numeric(7, 2) not null default 0 check (carbs >= 0),
  fat numeric(7, 2) not null default 0 check (fat >= 0),
  source text not null default 'manual'
    check (source in ('manual', 'ai', 'duplicated')),
  created_at timestamptz not null default now()
);

create index food_entries_user_date_idx on public.food_entries (user_id, eaten_on);
create index food_entries_created_at_idx on public.food_entries (user_id, created_at desc);

alter table public.food_entries enable row level security;

create policy "Users can view own food entries"
  on public.food_entries for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own food entries"
  on public.food_entries for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own food entries"
  on public.food_entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own food entries"
  on public.food_entries for delete
  using ((select auth.uid()) = user_id);

-- =========================================================
-- Water logs
-- =========================================================
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 5000),
  created_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, logged_on);

alter table public.water_logs enable row level security;

create policy "Users can view own water logs"
  on public.water_logs for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own water logs"
  on public.water_logs for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own water logs"
  on public.water_logs for delete
  using ((select auth.uid()) = user_id);

-- =========================================================
-- Weight logs
-- =========================================================
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index weight_logs_user_date_idx on public.weight_logs (user_id, logged_on desc);

alter table public.weight_logs enable row level security;

create policy "Users can view own weight logs"
  on public.weight_logs for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own weight logs"
  on public.weight_logs for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own weight logs"
  on public.weight_logs for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own weight logs"
  on public.weight_logs for delete
  using ((select auth.uid()) = user_id);

-- =========================================================
-- Auto-create profile + default goals on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.nutrition_goals (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
