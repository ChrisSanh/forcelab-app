# ForceLab: Project State (living architecture file)

Maintained under CLAUDE.md section 8 (Protocolo de Sincronización con Arquitecto).
Update it at the close of every Sprint and after every structural change.

- **Snapshot:** close of Sprint 2 + DevSecOps / ISO/IEC 25010 (2026-11-25); database section verified against live Supabase the same day
- **Branch:** `develop` (promoted to `main` by pull request; `main` deploys to Vercel)
- **Baseline commit:** `20f185c` (merge of PR #6)
- **Latest handoff:** [SPRINT_2_AND_DEVSECOPS_HANDOFF.md](sprints/SPRINT_2_AND_DEVSECOPS_HANDOFF.md)

How to read the evidence labels used below:
**[verified]** = read from the repository or measured by running the command on 2026-11-25.
In section 3, **[verified]** means confirmed against the live Supabase catalog output pasted by the user.

---

## 1. Stack

| Layer | Technology (version from `package.json`) |
| :--- | :--- |
| Framework | Next.js 16.4.6 (App Router, `cacheComponents`, `partialPrefetching`), React 19.3.0 |
| Language | TypeScript 5 strict |
| UI | Tailwind CSS 4.3.3, shadcn + `@base-ui/react`, `lucide-react`, Recharts 3 |
| Backend | Supabase (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.119), PostgreSQL + RLS |
| Validation | Zod 4.6 |
| Tests | Vitest 5.1 + `@vitest/coverage-v8` |
| Hosting | Vercel (`vercel.json`) |
| CI/CD | GitHub Actions (`devsecops-ci.yml`), SonarCloud, gitleaks, Semgrep |

Next.js 16 renamed `middleware` to `proxy`: the entry point is `src/proxy.ts`.
`AGENTS.md` requires reading `node_modules/next/dist/docs/` before writing Next.js code.

---

## 2. Source tree and routes [verified]

### 2.1 Tree of `src/`

```text
src/
  proxy.ts                         Next 16 proxy (ex middleware); delegates to updateSession
  app/
    layout.tsx, globals.css, favicon.ico, page.tsx          root layout and landing (static)
    (auth)/
      AuthForm.tsx                                          shared login/register form
      login/page.tsx
      register/page.tsx
    onboarding/   layout.tsx, page.tsx, OnboardingForm.tsx
    dashboard/    layout.tsx, page.tsx, EvolutionChart.tsx, GoalSummaryCard.tsx, SignOutButton.tsx
    goals/        layout.tsx, page.tsx, GoalsManager.tsx, GoalForm.tsx
    workout/      layout.tsx
      [day]/      page.tsx, WorkoutLogger.tsx
  components/
    ui/           badge, button, card, dialog, input, label, progress, select, tabs   (shadcn)
    workout/      RecommendationCard.tsx, RestTimer.tsx, ScaleSelector.tsx
  lib/
    types.ts                                  row types of every table
    utils.ts                                  re-exports cn
    supabase/     client.ts, server.ts, middleware.ts
    math/         e1rm.ts, progressionEngine.ts, __tests__/
    progression/  analytics.ts, goalActions.ts, matching.ts, messages.ts, recommendations.ts,
                  __tests__/goalActions.test.ts, analytics.test.ts, matching.test.ts
    presets/      defaultSplit.ts
    validation/   schemas.ts, __tests__/schemas.test.ts
    security/     __tests__/nextConfig.test.ts
```

Outside `src/`: `supabase/migrations/`, `docs/`, `.github/workflows/devsecops-ci.yml`,
`next.config.ts`, `vitest.config.mts`, `sonar-project.properties`, `eslint.config.mjs`, `vercel.json`.

### 2.2 Routes (`next build` output, 2026-11-25)

| Route | Rendering | Purpose | Route protection |
| :--- | :--- | :--- | :--- |
| `/` | Static | Landing / root redirect | public |
| `/login`, `/register` | Static | Auth forms | proxy redirects signed-in users to `/dashboard` |
| `/onboarding` | Partial prerender | Profile, PRs, methodology, loads the default split | proxy + `getUser()` in page |
| `/dashboard` | Partial prerender | Progress hub, evolution chart, goal summaries | proxy + `getUser()` in page |
| `/goals` | Partial prerender | Goal manager (create, edit, close, register PR) | **page `getUser()` only; not in proxy** (see section 7, D5) |
| `/workout/[day]` | Dynamic, partial prerender | Mobile logger with automatic recommendations | proxy + `getUser()` in page |

Proxy matcher: `/dashboard/:path*`, `/onboarding/:path*`, `/workout/:path*`, `/login`, `/register`.
`PROTECTED_PREFIXES` in `src/lib/supabase/middleware.ts`: `/dashboard`, `/onboarding`, `/workout`.

---

## 3. Database [verified against live Supabase, 2026-11-25]

Source: catalog queries run by the user in the Supabase SQL editor (`information_schema.columns`,
`pg_constraint`, `pg_class` RLS flags, `pg_policies`, `pg_proc`, `pg_indexes`). Committed as
[`supabase/migrations/20261125_baseline_schema.sql`](../supabase/migrations/20261125_baseline_schema.sql)
(documentation only, do not run). **Not captured:** grants, views and extensions. The `auth.users` trigger was captured and is documented in 3.3.

### 3.1 Tables (public schema, 7 tables)

All `id` columns are `uuid default gen_random_uuid()` except `profiles.id` (= `auth.users.id`).
`user_id` columns are `uuid not null` with FK to `profiles(id) on delete cascade` unless stated.

| Table | Columns (type, null, default) |
| :--- | :--- |
| `training_methodologies` | `slug` text NN **unique**, `name` text NN, `description` text NN, `default_config` jsonb NN, `created_at` timestamptz |
| `profiles` | `id` uuid PK FK `auth.users` cascade, `username` text **unique**, `sex` text default `'male'` CHECK in (male, female, other), `birth_date` date, `height_cm` numeric(5,2), `bodyweight_kg` numeric(5,2) NN default 80.0, `training_start_date` date NN default current_date, `injury_history` jsonb default `'[]'`, `created_at`, `updated_at`, `current_pr_kg` numeric(5,1), `target_pr_kg` numeric(5,1) |
| `user_programs` | `user_id`, `methodology_id` FK `training_methodologies` (no cascade), `program_name` text NN, `split_structure` jsonb NN, `main_lift_name` text NN default `'Press de Banca Plano'`, `starting_pr_kg` / `current_pr_kg` / `target_pr_kg` numeric(5,2) NN (defaults 110 / 110 / 150), `is_active` bool default true, `created_at`, `routine` jsonb |
| `workout_logs` | `user_id`, `program_id` FK `user_programs` **on delete set null**, `session_date` date NN default current_date, `day_label` text NN, `session_rpe` int CHECK 1-10, `joint_discomfort` int default 0 CHECK 0-10, `notes` text, `created_at` |
| `set_logs` | `workout_id` FK `workout_logs` cascade NN, `user_id`, `exercise_name` text NN, `set_category` text NN CHECK (explosive_bilbo, heavy_strength, hypertrophy, warmup), `set_number` int NN, `weight_kg` numeric(5,2) NN, `reps` int NN, `rir` int CHECK 0-5, `bar_speed` text CHECK (explosive, fast, moderate, grind), `calculated_e1rm` numeric(5,2), `created_at`, `perceived_velocity` smallint CHECK 1-5 |
| `user_goals` | `user_id`, `program_id` FK `user_programs` cascade, `exercise_name` text NN, `muscle_group` text NN, `progression_type` text NN default `'double_progression'` CHECK (4 types), `starting_pr_kg` / `current_pr_kg` / `target_pr_kg` numeric(5,2), `target_sets` int default 3, `rep_range_min` default 8, `rep_range_max` default 12, `increment_step_kg` numeric(4,2) default 2.5, `is_active` bool default true, `created_at`, `updated_at` |
| `exercise_cycles` | `user_id`, `goal_id` FK `user_goals` cascade NN, `cycle_number` int NN default 1, `base_1rm_kg` numeric(5,2) NN, `current_prescribed_weight_kg` numeric(5,2) NN, `current_week_or_session` int NN default 1, `status` text default `'active'` CHECK (active, deload_recommended, pr_test_ready, completed), `started_at` default now(), `completed_at` |

Columns the application never reads or writes: `profiles.{username, sex, birth_date, height_cm, injury_history, current_pr_kg, target_pr_kg}`,
`user_programs.routine`, `workout_logs.{session_rpe, joint_discomfort, notes}`, `set_logs.perceived_velocity`.
(`session_rpe`, `joint_discomfort`, `injury_history` and `perceived_velocity` look like the base for the planned biomechanical audit; this is an inference from the names.)

### 3.2 RLS policies (7 of 7 tables have RLS enabled, none forced)

| Table | Policy | Command | Expression |
| :--- | :--- | :--- | :--- |
| `profiles` | Users manage own profile | ALL | `auth.uid() = id` (USING and WITH CHECK) |
| `user_programs`, `workout_logs`, `set_logs`, `user_goals`, `exercise_cycles` | Users manage own programs / workouts / sets / goals / cycles | ALL | `auth.uid() = user_id` (USING and WITH CHECK) |
| `training_methodologies` | Public read methodologies | SELECT | `true` |

All policies apply to role `public` (includes `anon`); `auth.uid()` is null for anonymous requests, so they match nothing.
This satisfies CLAUDE.md 7.2 for table-level ownership. Gaps are listed as D16-D24 in section 7.

### 3.3 Functions, triggers, indexes, migrations

- **Function** `public.handle_new_user()`: `SECURITY DEFINER`, inserts `(id, username = split_part(email, '@', 1))` into `profiles`.
  No `SET search_path`.
- **Trigger** `on_auth_user_created` on `auth.users`: `AFTER INSERT ... FOR EACH ROW EXECUTE FUNCTION handle_new_user()` (verified live; the function is referenced without schema qualification).
- **Indexes:** only the 7 primary keys plus `profiles_username_key` and `training_methodologies_slug_key`.
  **No index on any foreign key or on `user_id`.**
- **Migrations in the repo:** `20261119_sprint1_columns.sql` (comment only, nothing to run) and
  `20261125_baseline_schema.sql` (documentation of the live schema, **do not run**).

### 3.4 Data flow of the application [verified]

- Onboarding: updates `profiles`, deactivates old `user_programs`, inserts the new program with the default split.
- Workout: `ensureWorkout()` inserts a `workout_logs` row on the first saved set; each set inserts into `set_logs`
  after `setLogSchema` validation; `finish()` calls `advanceCycle()` per trained cycle-based goal.
- Recommendations: `getDayRecommendations()` reads active goals, open cycles and the last 400 `set_logs`.
- Goals: `createGoal` (opens cycle 1 for cycle-based types), `updateGoal`, `closeGoal` (completes open cycles),
  `registerNewPr` (updates PR, completes the cycle, opens `cycle_number + 1` from the new PR).

---

## 4. Engines and function signatures [verified]

### 4.1 `src/lib/math/e1rm.ts`: hybrid e1RM

```ts
const HIGH_REP_GAIN = 0.35            // calibration constant, not validated against real 1RM tests
export const RIR_MIN = 0; export const RIR_MAX = 5
export interface E1rmInput { weightKg: number; reps: number; rir?: number }
export function brzycki(weightKg: number, effectiveReps: number): number
export function calculateE1rm({ weightKg, reps, rir = 0 }: E1rmInput): number | null   // rounded to 0.1
export function loadForPercent(e1rmKg: number, percent: number, step = 2.5): number
```

Effective reps = `min(reps + clamp(rir, 0, 5), 30)`. Up to 10: Brzycki. Above 10: Brzycki at 10 reps times
`1 + 0.35 * ln(effective / 10)`. Returns `null` for non-finite input, `weightKg <= 0` or `reps < 1`.

### 4.2 `src/lib/math/progressionEngine.ts`: pure dual progression

```ts
export const PLATE_STEP_KG = 2.5, BILBO_START_PCT = 0.5, BILBO_MIN_REPS = 15, BILBO_INCREMENT_KG = 2.5
export const HEAVY_BLOCK_WEEKS: readonly HeavyBlockWeek[]   // w1 77% 4x4, w2 80% 5x3, w3 83% 4x2, w4 70% 3x3 deload
export interface LoggedSet { weightKg: number; reps: number; rir: number | null }
export type PrescriptionReason = "cycle_start" | "progress" | "hold" | "cycle_end" | "block_week"
  | "block_complete" | "first_session" | "increase_weight" | "keep_weight"
export interface Prescription { progressionType; reason; status: CycleStatus; weightKg: number | null; sets: number;
  repsMin: number | null; repsMax: number | null; repsToBeat: number | null; previousReps: number[];
  lastWeightKg: number | null; sequence: number | null; percent: number | null }

export function roundTo2_5(kg: number): number
export function suggestIncrementStep(exerciseName: string): number      // 1.25 dumbbell/cable, else 2.5
export function workingSets(sets: LoggedSet[]): { weightKg: number; sets: LoggedSet[] } | null
export function prescribeBilbo(input: BilboInput): Prescription
export function prescribeHeavyBlock(input: HeavyBlockInput): Prescription
export function prescribeDoubleProgression(input: DoubleProgressionInput): Prescription
export function prescribeLinear(input: LinearProgressionInput): Prescription
export function startCycleValues(type: ProgressionType, prKg: number): CycleStartValues
export function usesCycles(type: ProgressionType): boolean               // bilbo_cycle | heavy_blocks
```

Rules: Bilbo `reps < 15` -> `pr_test_ready`; `reps >= 15` and `rir >= 1` -> +increment; `reps >= 15` with RIR 0 -> hold.
Heavy block week 4 -> `deload_recommended`; week 5 -> `completed`. Double progression needs `target_sets` sets at
`rep_range_max` with RIR >= 1. Linear needs `target_sets` x `rep_range_max` (RIR not checked).

### 4.3 `src/lib/progression/`

```ts
// analytics.ts (pure)
export function exerciseOptions(sets: SetPoint[]): string[]
export function buildSeries(sets: SetPoint[], exerciseName: string): SessionPoint[]
export function buildMilestones(start: number, target: number, current: number, step = 5): Milestone[]
export function hypertrophyLevel(lastReps: number[], repMin: number, repMax: number): number
// matching.ts (pure)
export function normalizeName(name: string): string
export function sameExercise(goalName: string, candidate: string): boolean
export function findGoalForExercise(goals: UserGoal[], exercise: PresetExercise, dayType: string): UserGoal | null
// goalActions.ts (Supabase I/O, takes the client as a parameter)
export function validateGoal(values: GoalFormValues): string | null
export function defaultsFor(type: ProgressionType, exerciseName = ""): { targetSets; repRangeMin; repRangeMax; incrementStepKg }
export async function createGoal(supabase, userId, programId, values): Promise<ActionResult>
export async function updateGoal(supabase, goalId, values): Promise<ActionResult>
export async function closeGoal(supabase, goalId): Promise<ActionResult>
export async function registerNewPr(supabase, userId, goal, newPrKg): Promise<ActionResult>
export async function advanceCycle(supabase, goalId, status, nextWeightKg): Promise<void>
// recommendations.ts (I/O; not under coverage)
export function prescribeForGoal(goal: UserGoal, cycle: ExerciseCycle | null, sets: LoggedSet[]): Prescription
export async function getDayRecommendations(supabase, userId, day: PresetDay): Promise<ExerciseRecommendation[]>
// messages.ts (Spanish text; not under coverage)
export function formatKg(kg: number): string
export function describePrescription(p: Prescription): Recommendation
```

### 4.4 Zod schemas, `src/lib/validation/schemas.ts` (Zod 4)

```ts
export const MAX_KG = 999.99, MAX_LIFT_KG = 600
export const exerciseNameSchema            // 1-80 chars, /^[\p{L}\p{N} .,'()/+\-]+$/u
export const muscleGroupSchema, progressionTypeSchema, setCategorySchema, barSpeedSchema   // enums mirrored from CHECKs
export const profileSchema                 // { bodyweightKg 30-300, trainingStartDate ISO date <= today }
export const onboardingSchema              // profile + currentPrKg, targetPrKg (> current), methodologyId uuid
export const goalSchema                    // exerciseName, muscleGroup, progressionType, currentPrKg?, targetPrKg?,
                                           // targetSets 1-10, repRangeMin/Max 1-50, incrementStepKg (0,20] step 0.25
export function newPrSchema(currentPrKg: number)   // { newPrKg } must exceed currentPrKg
export const setLogSchema                  // exerciseName, setCategory, setNumber 1-50, weightKg, reps 1-100,
                                           // rir 0-5?, barSpeed?, calculatedE1rm?
export const setDraftSchema                // { weightKg, reps } typed in the logger
export function firstError(result): string | null     // first Spanish message
export type ProfileInput, OnboardingInput, GoalInput, SetLogInput
```

Numbers accept comma or dot decimals, max 2 decimals. Cycle-based goals (`bilbo_cycle`, `heavy_blocks`) require `currentPrKg`.

### 4.5 Presets and types

`src/lib/presets/defaultSplit.ts`: `DEFAULT_SPLIT` (UP-X-P-P-L: upper, lower, rest, push-1 Bilbo, push-2 heavy, pull, leg),
`findDay(split, key)`, types `DayType`, `PresetSet`, `PresetExercise`, `PresetDay`, `SplitPreset`.
`src/lib/types.ts`: `ProgressionType`, `MuscleGroup`, `CycleStatus`, `UserGoal`, `ExerciseCycle`, `SetCategory`,
`BarSpeed`, `Methodology`, `Profile`, `UserProgram`, `WorkoutLog`, `SetLog`.

---

## 5. Tests and pipelines

### 5.1 Vitest [verified, run 2026-11-25]

`npm run test:coverage`: **9 files, 216 tests, all passing** (about 1.3 s).

| Test file | Tests |
| :--- | ---: |
| `math/__tests__/e1rm.test.ts` | 8 |
| `math/__tests__/e1rm.edge.test.ts` | 18 |
| `math/__tests__/progressionEngine.test.ts` | 25 |
| `math/__tests__/progressionEngine.edge.test.ts` | 35 |
| `progression/__tests__/goalActions.test.ts` | 29 |
| `progression/analytics.test.ts` | 6 |
| `progression/matching.test.ts` | 5 |
| `validation/__tests__/schemas.test.ts` | 29 |
| `security/__tests__/nextConfig.test.ts` | 11 |
| **Total declared** (static count of `it(`/`test(` lines) | 166 |

The 50-test difference to Vitest's 216 is most likely parametrized cases (`it.each`) or loops that generate tests at run time (cause not checked). Vitest's figure is the authoritative one.

| Metric | Result | Threshold |
| :--- | ---: | ---: |
| Statements | 99.1% (222/224) | 95% |
| Branches | 95.69% (178/186) | 90% |
| Functions | 100% (59/59) | 95% |
| Lines | 100% (195/195) | 95% |

Files below 100% (table rows printed by v8): `analytics.ts` stmts 97.14 / branch 86.95 (line 69),
`matching.ts` stmts 93.75 / branch 85 (lines 45-49), `goalActions.ts` branch 97.56 (line 153), `next.config.ts` branch 90 (line 9).
Per-file values are below the global thresholds in `analytics.ts` and `matching.ts`, but Vitest applies the thresholds globally, so the run passes.

Coverage scope (`vitest.config.mts`): `src/lib/math/**`, `src/lib/progression/{analytics,matching,goalActions}.ts`,
`src/lib/validation/**`, `next.config.ts`. **Not covered:** `recommendations.ts`, `messages.ts`, `presets`, every React component and page.

### 5.2 Other gates [verified, run 2026-11-25]

| Command | Result |
| :--- | :--- |
| `npm run lint` | passes, no output |
| `npm run typecheck` (`next typegen && tsc --noEmit`) | passes |
| `npm run build` | passes (run with placeholder `NEXT_PUBLIC_SUPABASE_*` values); route table in section 2.2 |

### 5.3 GitHub Actions: `.github/workflows/devsecops-ci.yml` [verified from file]

Triggers: push to `main`, `develop` and `feature|feat|bugfix|fix|hotfix|chore|docs/**`; pull request to `develop` and `main`. Permissions `contents: read`. Node 24. Actions pinned by SHA.

| Job | Steps |
| :--- | :--- |
| `quality-and-tests` | `npm ci --ignore-scripts`, lint, typecheck, `test:coverage`, build (uses secrets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), upload `coverage/` artifact |
| `security-audit` | `npm audit --audit-level=high`, gitleaks, Semgrep 1.186.0 (`p/security-audit`, `p/typescript`, `p/nextjs`, `p/owasp-top-ten`, `--error`, scans `src`) |
| `sonarcloud` | `test:coverage`, then scan only if `SONAR_TOKEN` exists (otherwise skipped with a notice) |

**`.github/workflows/auto-pr-to-develop.yml`** (added on `chore/gitflow-devsecops-automation`): on push to a working-branch prefix it opens or refreshes a PR into `develop` (title from the branch name), assigns and requests review from `ElWariBana`, and runs `gh pr merge --auto --squash`. It only works with the repository settings in `docs/ISO_25010_AND_SECURITY.md` 3.0.1, which are **not verifiable from the repo** (auto-merge, branch protection of `develop`, required checks). Validated locally with PyYAML, `bash -n` and a simulated `gh`; **not yet run on GitHub**.

SonarCloud (`sonar-project.properties`): project `ElWariBana_forcelab-app`, organization `elwaribana`,
sources `src`, lcov from `coverage/lcov.info`, coverage excludes tests and `src/components/ui/**`.
**Not verifiable from the repository:** whether `SONAR_TOKEN` is configured, and the latest run results of
Actions and SonarCloud. Check the Actions tab.

### 5.4 Security headers [verified from `next.config.ts` and `docs/ISO_25010_AND_SECURITY.md`]

CSP (no nonce, `'unsafe-inline'` for script/style, `'unsafe-eval'` in dev only), HSTS 2 years with preload,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP: same-origin`, `X-DNS-Prefetch-Control: off`,
`X-Powered-By` removed. Full mapping to OWASP Top 10 and ISO/IEC 25010: `docs/ISO_25010_AND_SECURITY.md`.

---

## 6. Branches and deployment

Gitflow: never push to `main`/`develop`; work on prefixed branches (CLAUDE.md section 3). Remote branches: `main`, `develop`, `feature/devsecops-iso25010`, `feature/sprint-2-goals-progression`.
Merged PRs: #1-#6. Vercel deploys `main`. Work happens on `develop`; the user pushes (Claude only commits).

---

## 7. Technical debt and pending items

| ID | Item | Source |
| :--- | :--- | :--- |
| D1 | **Schema was not in version control.** Mostly closed on 2026-11-25 by `20261125_baseline_schema.sql`. Trigger captured 2026-11-25. Still missing: grants. | section 3 |
| D2 | Goals and sets linked by free-text name; needs an exercise catalog with `exercise_key` | FUTURE_IMPROVEMENTS #2 |
| D3 | Cycle counter advanced from the browser at "Terminar entrenamiento"; may skip or double-advance | FUTURE_IMPROVEMENTS #3 |
| D4 | Bilbo/heavy load derived from two sources (last set vs `exercise_cycles.current_prescribed_weight_kg`) | FUTURE_IMPROVEMENTS #4 |
| D5 | `/goals` is not in `PROTECTED_PREFIXES` nor in the proxy matcher; it relies on the page-level `getUser()` redirect. Not exploitable on its own (RLS still applies) but inconsistent with the other routes | found while writing this file |
| D6 | Dashboard progress counts only the bench; accessory transfer work not weighted | FUTURE_IMPROVEMENTS #1 (fuller version) |
| D7 | `HIGH_REP_GAIN = 0.35` is a calibration constant not validated against real 1RM tests | `e1rm.ts` comment |
| D8 | Validation is client-side; real enforcement is RLS and DB constraints. Server Actions planned | ISO doc 2.4 item 5 |
| D9 | CSP uses `'unsafe-inline'`; must be checked in a browser on every page | ISO doc 2.4 items 1-2 |
| D10 | No rate limiting beyond Supabase Auth; no central error monitoring (A09) | ISO doc |
| D11 | Moderate advisories in `shadcn` (below the `high` threshold) | ISO doc 2.4 item 3 |
| D12 | Coverage excludes `recommendations.ts`, `messages.ts`, presets and all UI; no component or E2E tests | `vitest.config.mts` |
| D13 | No performance budget or Lighthouse gate; no cross-browser matrix; PWA and offline queue planned for Sprint 6 | ISO doc |
| D14 | `README.md` is still the create-next-app boilerplate | repository |
| D15 | `AGENTS.md` block is re-added by `next dev`; commit it with the next change that touches it | `AGENTS.md` |
| D16 | **No indexes on foreign keys or `user_id`.** RLS evaluates `auth.uid() = user_id` on every query and the app filters `set_logs` by `user_id` ordered by `created_at`. Add indexes (for example `set_logs (user_id, created_at desc)`, `user_goals (user_id)`, `exercise_cycles (goal_id)`, `workout_logs (user_id)`) before data grows | `pg_indexes` |
| D17 | **Missing CHECKs that Zod enforces only in the browser:** `user_goals.muscle_group` has no CHECK; no range checks on `weight_kg`, `reps`, `set_number`, `rep_range_*`, `target_sets`, `increment_step_kg`; no UNIQUE on `exercise_cycles (goal_id, cycle_number)`, so a double submit can create duplicate cycles. Direct API calls bypass the Zod layer (D8) | `pg_constraint` |
| D18 | **`handle_new_user()` is `SECURITY DEFINER` without `SET search_path`** (Supabase linter warning; privilege-escalation hardening). It also derives `username` from the email local part, and `username` is `UNIQUE`: `ana@a.com` and `ana@b.com` collide, and the second signup can fail inside the trigger. The app does not use `username` | `pg_proc`, `AuthForm.tsx` |
| D19 | **Policies target role `public` instead of `authenticated`.** Harmless today because `auth.uid()` is null for anon, but least privilege says `to authenticated`. `training_methodologies` is readable by anon, as intended | `pg_policies` |
| D20 | **Ownership is not enforced across tables.** A policy checks only the row's own `user_id`; nothing stops inserting a `set_logs` or `exercise_cycles` row whose `workout_id` / `goal_id` belongs to another user (the FK only checks existence). Needs composite FKs or a trigger. Low exploitability (uuids are unguessable) but not impossible | `pg_constraint`, `pg_policies` |
| D21 | `user_goals.program_id` cascades but `workout_logs.program_id` sets null, so deleting a program deletes its goals and cycles but keeps the workout history. Confirm this is intended | `pg_constraint` |
| D22 | **Unused columns and duplicated PR storage:** `profiles.{current_pr_kg, target_pr_kg}` and `user_programs.routine` are unused; PRs live in `user_programs` and `user_goals`. Defaults (`bodyweight_kg` 80; program PRs 110 / 110 / 150) make a row created without onboarding values look real | `information_schema.columns` |
| D23 | `user_programs.methodology_id` has no `on delete` rule (deleting a methodology that is in use fails) | `pg_constraint` |
| D24 | App types diverge from the database: `UserProgram.split_structure` is `SplitPreset \| null` but the column is NOT NULL; `Profile` omits most real columns; `ExerciseCycle.status` and `started_at` are nullable in the database but typed non-null | `types.ts` vs catalog |
