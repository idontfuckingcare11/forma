-- ============================================================
-- Forma — one-shot database setup (schema + seed foods)
-- Safe to re-run: every statement is idempotent.
-- Paste this whole file into:
--   Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$ begin
  create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snacks');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.unit_system as enum ('metric', 'imperial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_type as enum ('fat_loss', 'maintenance', 'muscle_gain');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  unit_system public.unit_system not null default 'metric',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

create table if not exists public.nutrition_goals (
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

create table if not exists public.food_items (
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

create index if not exists food_items_user_id_idx on public.food_items (user_id);
create index if not exists food_items_name_idx on public.food_items (lower(name));

alter table public.food_items enable row level security;

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ai_analyses_user_id_idx on public.ai_analyses (user_id);

alter table public.ai_analyses enable row level security;

create table if not exists public.food_entries (
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

create index if not exists food_entries_user_date_idx on public.food_entries (user_id, eaten_on);
create index if not exists food_entries_created_at_idx on public.food_entries (user_id, created_at desc);

alter table public.food_entries enable row level security;

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  amount_ml integer not null check (amount_ml > 0 and amount_ml <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists water_logs_user_date_idx on public.water_logs (user_id, logged_on);

alter table public.water_logs enable row level security;

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, logged_on desc);

alter table public.weight_logs enable row level security;

-- ------------------------------------------------------------
-- Row Level Security policies
-- ------------------------------------------------------------
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view own goals" on public.nutrition_goals;
create policy "Users can view own goals"
  on public.nutrition_goals for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own goals" on public.nutrition_goals;
create policy "Users can insert own goals"
  on public.nutrition_goals for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own goals" on public.nutrition_goals;
create policy "Users can update own goals"
  on public.nutrition_goals for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view global and own food items" on public.food_items;
create policy "Users can view global and own food items"
  on public.food_items for select
  using (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "Users can insert own food items" on public.food_items;
create policy "Users can insert own food items"
  on public.food_items for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own food items" on public.food_items;
create policy "Users can update own food items"
  on public.food_items for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own food items" on public.food_items;
create policy "Users can delete own food items"
  on public.food_items for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own AI analyses" on public.ai_analyses;
create policy "Users can view own AI analyses"
  on public.ai_analyses for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own AI analyses" on public.ai_analyses;
create policy "Users can insert own AI analyses"
  on public.ai_analyses for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own food entries" on public.food_entries;
create policy "Users can view own food entries"
  on public.food_entries for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own food entries" on public.food_entries;
create policy "Users can insert own food entries"
  on public.food_entries for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own food entries" on public.food_entries;
create policy "Users can update own food entries"
  on public.food_entries for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own food entries" on public.food_entries;
create policy "Users can delete own food entries"
  on public.food_entries for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own water logs" on public.water_logs;
create policy "Users can view own water logs"
  on public.water_logs for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own water logs" on public.water_logs;
create policy "Users can insert own water logs"
  on public.water_logs for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own water logs" on public.water_logs;
create policy "Users can delete own water logs"
  on public.water_logs for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own weight logs" on public.weight_logs;
create policy "Users can view own weight logs"
  on public.weight_logs for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own weight logs" on public.weight_logs;
create policy "Users can insert own weight logs"
  on public.weight_logs for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own weight logs" on public.weight_logs;
create policy "Users can update own weight logs"
  on public.weight_logs for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own weight logs" on public.weight_logs;
create policy "Users can delete own weight logs"
  on public.weight_logs for delete
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- Auto-create profile + default goals on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.nutrition_goals (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Seed global staple foods (inserted once; re-runs are no-ops)
-- ------------------------------------------------------------
insert into public.food_items
  (user_id, name, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_label, serving_grams)
select v.*
from (values
  (null::uuid, 'Chicken breast, grilled', 'seed', 165, 31, 0, 3.6, '1 fillet', 170),
  (null, 'Chicken thigh, grilled', 'seed', 209, 26, 0, 10.9, '1 thigh', 120),
  (null, 'Ground beef 90/10, cooked', 'seed', 217, 26, 0, 11.7, '1 patty', 113),
  (null, 'Salmon, baked', 'seed', 208, 20, 0, 13, '1 fillet', 150),
  (null, 'Tuna, canned in water', 'seed', 116, 26, 0, 0.8, '1 can drained', 165),
  (null, 'Shrimp, cooked', 'seed', 99, 24, 0.2, 0.3, '10 shrimp', 100),
  (null, 'Turkey breast, roasted', 'seed', 135, 30, 0, 1, '1 slice', 80),
  (null, 'Pork chop, grilled', 'seed', 209, 27, 0, 10.9, '1 chop', 140),
  (null, 'Whole eggs, scrambled', 'seed', 148, 10, 1.6, 11, '2 eggs', 100),
  (null, 'Egg whites', 'seed', 52, 11, 0.7, 0.2, '1 cup', 243),
  (null, 'Cooked white rice', 'seed', 130, 2.7, 28, 0.3, '1 cup', 158),
  (null, 'Cooked brown rice', 'seed', 112, 2.6, 24, 0.9, '1 cup', 195),
  (null, 'Cooked quinoa', 'seed', 120, 4.4, 21, 1.9, '1 cup', 185),
  (null, 'Cooked oats', 'seed', 71, 2.5, 12, 1.5, '1 cup', 234),
  (null, 'Dry oats', 'seed', 389, 16.9, 66, 6.9, '1/2 cup', 40),
  (null, 'Cooked pasta', 'seed', 131, 5, 25, 1.1, '1 cup', 140),
  (null, 'Whole wheat bread', 'seed', 247, 13, 41, 3.4, '1 slice', 32),
  (null, 'White bread', 'seed', 265, 9, 49, 3.2, '1 slice', 25),
  (null, 'Bagel, plain', 'seed', 250, 10, 48, 1.7, '1 bagel', 105),
  (null, 'Flour tortilla', 'seed', 306, 8.2, 51, 7.7, '1 medium', 45),
  (null, 'Sweet potato, baked', 'seed', 90, 2, 21, 0.1, '1 medium', 114),
  (null, 'Potato, boiled', 'seed', 87, 1.9, 20, 0.1, '1 medium', 150),
  (null, 'French fries', 'seed', 312, 3.4, 41, 15, '1 medium', 117),
  (null, 'Broccoli, steamed', 'seed', 35, 2.4, 7, 0.4, '1 cup', 156),
  (null, 'Spinach, raw', 'seed', 23, 2.9, 3.6, 0.4, '1 cup', 30),
  (null, 'Mixed vegetables, steamed', 'seed', 60, 2.5, 12, 0.5, '1 cup', 156),
  (null, 'Banana', 'seed', 89, 1.1, 23, 0.3, '1 medium', 118),
  (null, 'Apple', 'seed', 52, 0.3, 14, 0.2, '1 medium', 182),
  (null, 'Orange', 'seed', 47, 0.9, 12, 0.1, '1 medium', 131),
  (null, 'Strawberries', 'seed', 32, 0.7, 7.7, 0.3, '1 cup', 152),
  (null, 'Blueberries', 'seed', 57, 0.7, 14, 0.3, '1 cup', 148),
  (null, 'Avocado', 'seed', 160, 2, 9, 15, '1/2 fruit', 100),
  (null, 'Almonds', 'seed', 579, 21, 22, 50, '1 oz (23 nuts)', 28),
  (null, 'Peanut butter', 'seed', 588, 25, 20, 50, '2 tbsp', 32),
  (null, 'Walnuts', 'seed', 654, 15, 14, 65, '1 oz', 28),
  (null, 'Whole milk', 'seed', 61, 3.2, 4.8, 3.3, '1 cup', 244),
  (null, 'Skim milk', 'seed', 34, 3.4, 5, 0.1, '1 cup', 245),
  (null, 'Greek yogurt 0%', 'seed', 59, 10, 3.6, 0.4, '1 cup', 200),
  (null, 'Cheddar cheese', 'seed', 403, 25, 1.3, 33, '1 oz', 28),
  (null, 'Cottage cheese 2%', 'seed', 84, 11, 4.3, 2.3, '1 cup', 226),
  (null, 'Firm tofu', 'seed', 144, 17, 3, 9, '1/2 block', 125),
  (null, 'Whey protein powder', 'seed', 380, 78, 8, 5, '1 scoop', 30),
  (null, 'Olive oil', 'seed', 884, 0, 0, 100, '1 tbsp', 14),
  (null, 'Butter', 'seed', 717, 0.9, 0.1, 81, '1 tbsp', 14),
  (null, 'Honey', 'seed', 304, 0.3, 82, 0, '1 tbsp', 21),
  (null, 'Orange juice', 'seed', 45, 0.7, 10, 0.2, '1 cup', 248),
  (null, 'Black coffee', 'seed', 2, 0.3, 0, 0, '1 cup', 240),
  (null, 'Coca-Cola', 'seed', 42, 0, 10.6, 0, '1 can', 330),
  (null, 'Pizza cheese', 'seed', 266, 11, 33, 10, '1 slice', 107),
  (null, 'Cheeseburger', 'seed', 260, 13, 21, 14, '1 burger', 150),
  (null, 'Chicken kebab', 'seed', 190, 22, 6, 9, '1 skewer', 150),
  (null, 'Protein bar', 'seed', 350, 30, 40, 10, '1 bar', 60),
  (null, 'Dark chocolate 70%', 'seed', 598, 8, 46, 46, '1 oz', 28),
  (null, 'Potato chips', 'seed', 536, 7, 53, 34, '1 oz', 28),
  (null, 'Vanilla ice cream', 'seed', 207, 3.5, 24, 11, '1/2 cup', 66),
  (null, 'Hummus', 'seed', 166, 8, 14, 10, '2 tbsp', 30),
  (null, 'Black beans, cooked', 'seed', 132, 8.9, 24, 0.5, '1 cup', 172),
  (null, 'Lentils, cooked', 'seed', 116, 9, 20, 0.4, '1 cup', 198),
  (null, 'Protein pancakes (2)', 'seed', 220, 18, 28, 4, '2 pancakes', 120)
) as v(user_id, name, source, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, serving_label, serving_grams)
where not exists (
  select 1 from public.food_items where source = 'seed' and user_id is null
);

-- ------------------------------------------------------------
-- Backfill profile + goals for accounts created before setup
-- ------------------------------------------------------------
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

insert into public.nutrition_goals (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- Avatars storage bucket (safe if storage extension is active)
-- ------------------------------------------------------------
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;
exception when others then null; end $$;

-- Storage RLS policies for the avatars bucket
do $$ begin
  drop policy if exists "Avatar images are publicly readable" on storage.objects;
  create policy "Avatar images are publicly readable"
    on storage.objects for select
    using (bucket_id = 'avatars');
exception when others then null; end $$;

do $$ begin
  drop policy if exists "Users can upload their own avatar" on storage.objects;
  create policy "Users can upload their own avatar"
    on storage.objects for insert
    with check (
      bucket_id = 'avatars'
      and (select auth.uid()) is not null
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when others then null; end $$;

do $$ begin
  drop policy if exists "Users can update their own avatar" on storage.objects;
  create policy "Users can update their own avatar"
    on storage.objects for update
    using (
      bucket_id = 'avatars'
      and (select auth.uid()) is not null
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when others then null; end $$;

do $$ begin
  drop policy if exists "Users can delete their own avatar" on storage.objects;
  create policy "Users can delete their own avatar"
    on storage.objects for delete
    using (
      bucket_id = 'avatars'
      and (select auth.uid()) is not null
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception when others then null; end $$;

commit;

-- Ask PostgREST to pick up the new tables immediately.
notify pgrst, 'reload schema';

