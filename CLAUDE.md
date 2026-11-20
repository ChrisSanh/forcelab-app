# CLAUDE.md - ForceLab Architecture & Engineering Rules

## 1. Project Overview
ForceLab is a science-based, multi-tenant strength & hypertrophy SaaS web application (PWA-ready). It supports multiple periodization methodologies (Hybrid Bilbo + Heavy Strength, Pure Bilbo, Daily Undulating Periodization, Linear Progression) and includes a biomechanical audit & predictive analytics engine.

## 2. Tech Stack & Conventions
- **Framework:** Next.js 14+ (App Router), TypeScript (strict mode).
- **Styling:** Tailwind CSS + Shadcn/UI (Lucide icons). Mobile-first dark/clean gym UI.
- **Backend / Auth:** Supabase (`@supabase/ssr` + `@supabase/supabase-js`) with PostgreSQL and strict Row Level Security (RLS).
- **Language Rule:**
  - All code, file names, variables, TypeScript interfaces, database tables/columns, and git commits MUST be in **English**.
  - All user-facing UI text, labels, alerts, and fitness terminology MUST be in **Spanish** (Chilean/neutral Spanish).

## 3. Git Workflow Rules
- **Active Development Branch:** Always work on `develop`. Never commit directly to `main`.
- **Commit Convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

## 4. Directory Structure
```text
/src
  /app
    /(auth)            # Login & Register pages
    /dashboard         # Main progress hub & routine overview
    /onboarding        # Initial profile, PR & methodology setup
    /goals             # Multi-exercise goal manager (create/edit/close, register official PR)
    /workout/[day]     # Active mobile-first gym logger with automatic recommendations
  /components
    /ui                # Shadcn components
    /workout           # Rest timer, set logger cards, RIR selectors, recommendation card
  /lib
    /supabase          # client.ts, server.ts, middleware.ts
    /math
      e1rm.ts              # Hybrid e1RM calculator (Brzycki + high-rep dampening)
      progressionEngine.ts # Pure dual progression engine (see section 5)
    /progression           # Data + Spanish text around the engine (matching, messages, actions, analytics)
    /presets
      defaultSplit.ts  # Pre-configured UP-X-P-P-L template
/supabase/migrations   # SQL migrations (documentation; run by hand in the Supabase editor)
/docs                  # FUTURE_IMPROVEMENTS.md: deferred ideas, review at project end
```

## 5. Database Tables (public schema, RLS on every table)
- `profiles`: extends `auth.users`; body weight and training start date.
- `training_methodologies`: public read catalog.
- `user_programs`: routine in `split_structure` (JSONB) plus the Sprint 1 main-lift PRs.
- `workout_logs` / `set_logs`: sessions and per-set telemetry (`set_category`, `bar_speed`, `calculated_e1rm`).
- `user_goals` (Sprint 2): one row per exercise goal. `progression_type` is one of
  `bilbo_cycle`, `heavy_blocks`, `double_progression`, `linear_progression`; also holds
  `muscle_group`, `starting/current/target_pr_kg`, `target_sets`, `rep_range_min/max`, `increment_step_kg`, `is_active`.
- `exercise_cycles` (Sprint 2): Bilbo ladders and 4-week heavy blocks per goal
  (`cycle_number`, `base_1rm_kg`, `current_prescribed_weight_kg`, `current_week_or_session`,
  `status`: `active` | `deload_recommended` | `pr_test_ready` | `completed`).

## 6. Progression Engine (`src/lib/math/progressionEngine.ts`)
Pure functions (no I/O, no clock); Spanish text lives in `src/lib/progression/messages.ts`.
- `bilbo_cycle`: starts at `roundTo2_5(PR * 0.50)`; reps >= 15 and RIR >= 1 -> +2.5 kg and show the rep mark;
  reps < 15 -> status `pr_test_ready` ("fin de ciclo", rest 3-5 days, then pyramid test for +5 kg).
- `heavy_blocks`: week 1 77% 4x4, week 2 80% 5x3, week 3 83% 4x2, week 4 70% 3x3 (deload), rounded to 2.5 kg.
- `double_progression`: every set at `rep_range_max` with RIR >= 1 -> add `increment_step_kg`
  (2.5 kg barbells/machines, 1.25 kg dumbbells/cables) and restart at `rep_range_min`.
- `linear_progression`: target sets x `rep_range_max` completed -> +2.5 kg.
- Goals and sets are linked by normalized exercise name (`src/lib/progression/matching.ts`).
- Tests: `npm test` (Vitest). Every change to the engine needs a test.