-- ForceLab Sprint 1: columns required by onboarding, dashboard and workout logger.
-- Idempotent: safe to run more than once. Run it in the Supabase SQL editor.

-- Profile: bench press PR (current and goal).
alter table public.profiles
  add column if not exists bodyweight_kg numeric(5,1),
  add column if not exists current_pr_kg numeric(5,1),
  add column if not exists target_pr_kg numeric(5,1);

-- user_programs.split_structure already exists (NOT NULL); the preset is stored there as JSON.

-- Set logs: perceived bar velocity (1 = slow ... 5 = explosive) and the live e1RM.
alter table public.set_logs
  add column if not exists perceived_velocity smallint
    check (perceived_velocity between 1 and 5),
  add column if not exists calculated_e1rm numeric(6,1);
