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

## 3. Git Workflow Rules (Gitflow + automated DevSecOps)
- **Never push directly to `main` or `develop`.** Every Sprint, feature or bugfix is developed on its own branch
  with a valid prefix, and that branch is what gets pushed. Valid prefixes: `feature/`, `feat/`, `bugfix/`, `fix/`,
  `hotfix/`, `chore/`, `docs/`. Examples: `feat/sprint-3-biomechanical-auditor`, `fix/login-redirect`.
- **Automatic flow on push** (`.github/workflows/`):
  1. `devsecops-ci.yml` runs on the branch: quality-and-tests, security-audit (npm audit, gitleaks, Semgrep) and SonarCloud.
  2. `auto-pr-to-develop.yml` opens (or refreshes) a pull request into `develop` with a semantic title taken from the
     branch name, assigns and requests review from the Product Owner (`ElWariBana`) and arms auto-merge (squash).
  3. GitHub merges only when the required checks and the review pass. That gate is the branch protection of `develop`;
     the repository settings it needs are in `docs/ISO_25010_AND_SECURITY.md` section 3.0.1.
- **Who pushes:** the user pushes. Claude creates the branch locally and commits; it never runs `git push`.
  Documentation and handoff work goes on a `docs/` branch, never on `develop`.
- **Commit Convention:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). The PR title is built
  from the branch prefix (`feature`/`feat` -> `feat`, `bugfix`/`fix`/`hotfix` -> `fix`), so name branches accordingly.

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

## 7. Quality & Security Standards (ISO/IEC 25010 and DevSecOps)

These rules are mandatory. A change that breaks one of them is not done.

### 7.1 ISO/IEC 25010 product quality
The product is measured against the eight quality characteristics of ISO/IEC 25010:
functional suitability, performance efficiency, compatibility, usability, reliability,
security, maintainability and portability. The mapping to concrete controls and evidence
lives in `docs/ISO_25010_AND_SECURITY.md`; keep it up to date when a control changes.

### 7.2 Security rules (OWASP)
- **Validate every user input with Zod** (`src/lib/validation/schemas.ts`) before it reaches
  Supabase. Limits mirror the database (`numeric(5,2)`, CHECK constraints). New forms need a schema and tests.
- **Never use `dangerouslySetInnerHTML`.** Render user text as React text nodes only.
- **Strict RLS on every table.** A new table ships with `ENABLE ROW LEVEL SECURITY` and a policy
  scoped to `auth.uid()` in the same migration. Never use the service-role key in client code.
- **No hardcoded secrets.** Keys come from environment variables (`.env.local`, Vercel, GitHub Secrets).
  Only `NEXT_PUBLIC_*` values may reach the browser. `.env*` and `ApiKeys.txt` stay out of git.
- **Security headers live in `next.config.ts`** (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy). Loosening one needs a written reason in `docs/ISO_25010_AND_SECURITY.md`.
- Server code validates the session with `supabase.auth.getUser()`, never with `getSession()` alone.

### 7.3 Testing rules
- **All mathematical and scientific logic has unit tests** (`src/lib/math/**`, validation, analytics).
  Tests for `src/lib/math` live in `src/lib/math/__tests__/`.
- Cover the edge cases of each rule: both sides of every threshold (e.g. 14 vs 15 Bilbo reps,
  RIR 0 vs 1, 10 vs 11 effective reps), invalid input and empty history.
- Coverage thresholds are enforced by `vitest.config.mts` (95% lines/functions/statements, 90% branches).
  Never lower a threshold to make a build pass.

### 7.4 Quality gates (CI: `.github/workflows/devsecops-ci.yml`)
Runs on every push and pull request to `develop` and `main`. All of these must pass locally before a commit:
`npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`.
CI also runs `npm audit --audit-level=high`, gitleaks (secrets), Semgrep (SAST) and SonarCloud.

## 8. Protocolo de Sincronización con Arquitecto (Handoff Markdown)

Mandatory and permanent. The architect (a person or another model) works from these files, not from the
chat, so they must always match the repository. A sprint or structural change is not closed until both
artifacts below are updated and committed.

### 8.1 Living architecture file: `docs/PROJECT_STATE.md`
Update it at the close of every Sprint and after every structural change (new route, table, engine,
schema, pipeline step or dependency of weight). It must always contain:
- (a) the current folder tree and routes of `src/`;
- (b) the full database schema: tables, columns, RLS policies and the migrations active in Supabase;
- (c) every mathematical/scientific engine and Zod schema with its function signatures;
- (d) the Vitest coverage status (real numbers from `npm run test:coverage`) and the state of the
  GitHub Actions and SonarCloud pipelines;
- (e) known technical debt and pending items.

### 8.2 Sprint handoffs: `docs/sprints/SPRINT_<N>_HANDOFF.md`
At the close of every Sprint (or large block of changes) create one file, e.g.
`SPRINT_3_HANDOFF.md`. It must summarize: requirements covered (REQ-X.X, as numbered in the master
report), files created/modified, technical decisions, the results of `npm run test:coverage` and
`npm run build`, and any pending SQL the user must run by hand in the Supabase editor.

### 8.3 Rules for writing them
- Record only what was verified: run the gates and paste the real numbers. Never invent results.
- When something cannot be verified from the repository (for example the live RLS policies or an ID
  that is not written anywhere), say so explicitly instead of filling the gap.
- Update `docs/ISO_25010_AND_SECURITY.md` in the same commit when a security or quality control changes.
- Commit on a `docs/` branch (never on `develop`) with `docs:` (e.g. `docs: update project state and sprint handoff`); see section 3.
