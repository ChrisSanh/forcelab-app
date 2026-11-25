-- ForceLab baseline schema (DOCUMENTATION ONLY: do NOT run on the live database).
--
-- Reconstructed on 2026-11-25 from the output of these catalog queries run in the Supabase
-- SQL editor: information_schema.columns, pg_constraint, pg_class (RLS flags), pg_policies,
-- pg_proc (public functions) and pg_indexes. It is not a pg_dump, so details the queries do
-- not expose (column order inside constraints, grants, comments) may differ from the live DB.
--
-- NOT CAPTURED: the trigger on auth.users that calls public.handle_new_user(). Its definition
-- was not in the pasted output. Export it with:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--   where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- Known gaps of the live schema are listed in docs/PROJECT_STATE.md section 7 (D16-D24).

-- ---------------------------------------------------------------------------
-- training_methodologies (public read catalog)
-- ---------------------------------------------------------------------------
create table public.training_methodologies (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  description    text not null,
  default_config jsonb not null,
  created_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  username            text unique,
  sex                 text default 'male' constraint profiles_sex_check
                        check (sex = any (array['male', 'female', 'other'])),
  birth_date          date,
  height_cm           numeric(5,2),
  bodyweight_kg       numeric(5,2) not null default 80.0,
  training_start_date date not null default current_date,
  injury_history      jsonb default '[]'::jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  current_pr_kg       numeric(5,1),  -- unused by the app (the PRs live in user_programs / user_goals)
  target_pr_kg        numeric(5,1)   -- unused by the app
);

-- ---------------------------------------------------------------------------
-- user_programs
-- ---------------------------------------------------------------------------
create table public.user_programs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  methodology_id  uuid references public.training_methodologies (id),
  program_name    text not null,
  split_structure jsonb not null,
  main_lift_name  text not null default 'Press de Banca Plano',
  starting_pr_kg  numeric(5,2) not null default 110.0,
  current_pr_kg   numeric(5,2) not null default 110.0,
  target_pr_kg    numeric(5,2) not null default 150.0,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  routine         jsonb          -- unused by the app (split_structure is used)
);

-- ---------------------------------------------------------------------------
-- workout_logs
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  program_id       uuid references public.user_programs (id) on delete set null,
  session_date     date not null default current_date,
  day_label        text not null,
  session_rpe      integer constraint workout_logs_session_rpe_check
                     check (session_rpe >= 1 and session_rpe <= 10),
  joint_discomfort integer default 0 constraint workout_logs_joint_discomfort_check
                     check (joint_discomfort >= 0 and joint_discomfort <= 10),
  notes            text,
  created_at       timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- set_logs
-- ---------------------------------------------------------------------------
create table public.set_logs (
  id                 uuid primary key default gen_random_uuid(),
  workout_id         uuid not null references public.workout_logs (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  exercise_name      text not null,
  set_category       text not null constraint set_logs_set_category_check
                       check (set_category = any (array['explosive_bilbo', 'heavy_strength', 'hypertrophy', 'warmup'])),
  set_number         integer not null,
  weight_kg          numeric(5,2) not null,
  reps               integer not null,
  rir                integer constraint set_logs_rir_check check (rir >= 0 and rir <= 5),
  bar_speed          text constraint set_logs_bar_speed_check
                       check (bar_speed = any (array['explosive', 'fast', 'moderate', 'grind'])),
  calculated_e1rm    numeric(5,2),
  created_at         timestamptz default now(),
  perceived_velocity smallint constraint set_logs_perceived_velocity_check
                       check (perceived_velocity >= 1 and perceived_velocity <= 5)  -- unused by the app
);

-- ---------------------------------------------------------------------------
-- user_goals (Sprint 2)
-- ---------------------------------------------------------------------------
create table public.user_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  program_id        uuid references public.user_programs (id) on delete cascade,
  exercise_name     text not null,
  muscle_group      text not null,  -- no CHECK in the live DB (the app validates it with Zod)
  progression_type  text not null default 'double_progression' constraint user_goals_progression_type_check
                      check (progression_type = any (array['bilbo_cycle', 'heavy_blocks', 'double_progression', 'linear_progression'])),
  starting_pr_kg    numeric(5,2),
  current_pr_kg     numeric(5,2),
  target_pr_kg      numeric(5,2),
  target_sets       integer default 3,
  rep_range_min     integer default 8,
  rep_range_max     integer default 12,
  increment_step_kg numeric(4,2) default 2.5,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- exercise_cycles (Sprint 2)
-- ---------------------------------------------------------------------------
create table public.exercise_cycles (
  id                           uuid primary key default gen_random_uuid(),
  user_id                      uuid not null references public.profiles (id) on delete cascade,
  goal_id                      uuid not null references public.user_goals (id) on delete cascade,
  cycle_number                 integer not null default 1,
  base_1rm_kg                  numeric(5,2) not null,
  current_prescribed_weight_kg numeric(5,2) not null,
  current_week_or_session      integer not null default 1,
  status                       text default 'active' constraint exercise_cycles_status_check
                                 check (status = any (array['active', 'deload_recommended', 'pr_test_ready', 'completed'])),
  started_at                   timestamptz default now(),
  completed_at                 timestamptz
);

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled on all 7 tables, not forced. Every policy applies to role
-- "public" (which includes anon); auth.uid() is null for anon, so the comparison fails.
-- ---------------------------------------------------------------------------
alter table public.training_methodologies enable row level security;
alter table public.profiles               enable row level security;
alter table public.user_programs          enable row level security;
alter table public.workout_logs           enable row level security;
alter table public.set_logs               enable row level security;
alter table public.user_goals             enable row level security;
alter table public.exercise_cycles        enable row level security;

create policy "Public read methodologies" on public.training_methodologies
  for select using (true);
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own programs" on public.user_programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workouts" on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own sets" on public.set_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own goals" on public.user_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own cycles" on public.exercise_cycles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Signup function (called by a trigger on auth.users; trigger definition not captured).
-- Verbatim from pg_get_functiondef.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$ BEGIN INSERT INTO public.profiles (id, username) VALUES (NEW.id, split_part(NEW.email, '@', 1)); RETURN NEW; END; $function$;

-- ---------------------------------------------------------------------------
-- Indexes: only the primary keys and the two UNIQUE constraints above exist.
-- There are NO indexes on user_id, workout_id, goal_id or program_id.
-- ---------------------------------------------------------------------------
