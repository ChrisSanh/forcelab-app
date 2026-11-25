# Handoff: Sprint 2 + DevSecOps / ISO/IEC 25010

- **Closed:** 2026-11-20 (code); documented 2026-11-25
- **Branch:** `develop`; baseline commit `20f185c` (merge of PR #6 into `main`)
- **Companion file:** [../PROJECT_STATE.md](../PROJECT_STATE.md) (full architecture snapshot)
- **Scope:** Sprint 2 (multi-exercise goals and progression engine) plus the DevSecOps / ISO/IEC 25010 block.
  Sprint 1 (onboarding, logger, e1RM, dashboard) is the starting point and is not re-described here.

---

## 1. Requirements covered

> **No `REQ-X.X` identifiers exist anywhere in the repository** (searched code, docs and git history).
> The numbering lives in the master report, which is outside this repo. To avoid inventing it, the
> table lists the delivered capability and leaves the REQ column for the architect to fill in.

### Sprint 2: goals and progression

| REQ | Capability delivered | Evidence |
| :--- | :--- | :--- |
| _to map_ | Four progression types: `bilbo_cycle`, `heavy_blocks`, `double_progression`, `linear_progression` | `src/lib/math/progressionEngine.ts` |
| _to map_ | Multi-exercise goal manager: create, edit, close, register an official PR | `src/app/goals/`, `src/lib/progression/goalActions.ts` |
| _to map_ | Bilbo ladders and 4-week heavy blocks stored per goal (`exercise_cycles`); new PR opens a recalculated cycle | `goalActions.ts` (`openCycle`, `registerNewPr`) |
| _to map_ | Automatic recommendation per exercise in the logger (weight, sets, reps, rep mark to beat, deload and PR-test notices) | `recommendations.ts`, `messages.ts`, `RecommendationCard.tsx` |
| _to map_ | Goal-to-exercise matching by normalized name; Push 1 uses Bilbo, Push 2 uses heavy blocks on the same lift | `matching.ts` |
| _to map_ | Analytics dashboard: evolution chart (best e1RM and tonnage per session), strength milestones, hypertrophy level, goal summary cards | `analytics.ts`, `EvolutionChart.tsx`, `GoalSummaryCard.tsx` |
| _to map_ | Dashboard progress counts only bench sets (minimum fix of FUTURE_IMPROVEMENTS #1) | `dashboard/page.tsx` |

### DevSecOps and ISO/IEC 25010

| REQ | Capability delivered | Evidence |
| :--- | :--- | :--- |
| _to map_ | ISO/IEC 25010 mapping of the eight quality characteristics with measurable targets | `docs/ISO_25010_AND_SECURITY.md` |
| _to map_ | Zod validation of every user input, limits mirroring the database | `src/lib/validation/schemas.ts` |
| _to map_ | Security headers: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP | `next.config.ts` |
| _to map_ | Vitest unit tests with enforced coverage thresholds (95% lines/functions/statements, 90% branches) | `vitest.config.mts` |
| _to map_ | CI pipeline: lint, typecheck, tests, build, `npm audit`, gitleaks, Semgrep, SonarCloud | `.github/workflows/devsecops-ci.yml`, `sonar-project.properties` |
| _to map_ | Engineering rules (quality gates, security, testing) as mandatory project rules | `CLAUDE.md` section 7 |

---

## 2. Files

Taken from `git show --stat` of each commit. Full listing of the resulting tree: PROJECT_STATE.md section 2.1.

### Sprint 2
- **`1f39061` progression engine, goal types and goals manager (14 files):** `src/lib/math/progressionEngine.ts` (+ test),
  `src/lib/progression/{goalActions,matching,messages,recommendations}.ts` (+ `matching.test.ts`), `src/lib/types.ts`,
  `src/app/goals/{page,layout,GoalsManager,GoalForm}.tsx`, `package.json`, `package-lock.json`.
- **`ee783d1` multi-exercise goals, recommendations and analytics dashboard (11 files):** `src/lib/progression/analytics.ts` (+ test),
  `src/app/dashboard/{EvolutionChart,GoalSummaryCard,SignOutButton,page}.tsx`, `src/app/workout/[day]/{page,WorkoutLogger}.tsx`,
  `src/components/workout/RecommendationCard.tsx`, `docs/FUTURE_IMPROVEMENTS.md`, `CLAUDE.md`.

### DevSecOps and ISO/IEC 25010
- **`7f494ba` pipeline, OWASP hardening, ISO/IEC 25010 (18 files):** new `.github/workflows/devsecops-ci.yml`, `sonar-project.properties`,
  `vitest.config.mts`, `docs/ISO_25010_AND_SECURITY.md`, `src/lib/validation/schemas.ts`, `schemas.test.ts`, `e1rm.edge.test.ts`,
  `progressionEngine.edge.test.ts`; tests moved into `src/lib/math/__tests__/`; modified `next.config.ts`, `eslint.config.mjs`,
  `package.json`, `CLAUDE.md`, `OnboardingForm.tsx`, `WorkoutLogger.tsx`, `goalActions.ts`.
- **`06dcbfb` CI from a clean checkout (5 files):** `devsecops-ci.yml`, `docs/ISO_25010_AND_SECURITY.md`, `package.json`,
  `vitest.config.mts`, new `src/lib/progression/__tests__/goalActions.test.ts`.
- **`2178588` quote pip command (2 files):** `devsecops-ci.yml`, ISO doc.
- **`9f19921` HTTP security policy tests (2 files):** new `src/lib/security/__tests__/nextConfig.test.ts`, `vitest.config.mts`.

Files such as `e1rm.ts`, `defaultSplit.ts`, the shadcn `ui/` components and `AuthForm.tsx` come from Sprint 1 or earlier and were not touched by these commits.

### This handoff block (docs only)
- **New:** `docs/PROJECT_STATE.md`, `docs/sprints/SPRINT_2_AND_DEVSECOPS_HANDOFF.md`, `supabase/migrations/20261125_baseline_schema.sql` (documentation of the live schema).
- **Modified:** `CLAUDE.md` (new section 8, Protocolo de Sincronización con Arquitecto), `docs/ISO_25010_AND_SECURITY.md` (verified RLS evidence and database limits).

---

## 3. Technical decisions

1. **Pure engine, no I/O.** All progression rules are pure functions; Spanish text is separated in `messages.ts`. This is what makes the 95% coverage threshold realistic.
2. **Goals and sets matched by normalized name** (`matching.ts`), not by key. Chosen for speed in Sprint 2; recorded as debt D2.
3. **Cycles only for Bilbo and heavy blocks** (`usesCycles`). Double and linear progression are derived from the last session's sets and keep no cycle row.
4. **A reached target stays open** on a new PR: the UI shows it as achieved and the user can raise the goal.
5. **No nonce-based CSP.** Nonces would make the static landing, `/login` and `/register` render per request. `'unsafe-inline'` is accepted, mitigated by no `dangerouslySetInnerHTML`, Zod and React escaping.
6. **SonarCloud is skipped, not softened:** no `SONAR_TOKEN` skips the step with a notice; with a token it is strict. No `continue-on-error`.
7. **Supply-chain hardening:** actions pinned to a full commit SHA, `npm ci --ignore-scripts`, Semgrep pinned and installed from wheels only (rules S6505, S7637, S8541, S8544 raised by SonarCloud).
8. **`typecheck` runs `next typegen` first**, because a clean checkout fails type-checking without the generated route types.
9. **Coverage scope is limited on purpose** to scientific logic, validation, goal actions and the HTTP policy. UI is outside the threshold.
10. **Next.js 16:** `middleware` is now `proxy` (`src/proxy.ts`); `cacheComponents` and `partialPrefetching` are enabled.

---

## 4. Verification results (run 2026-11-25 on `develop`, after a clean `npm ci --ignore-scripts`)

### `npm run test:coverage`: passes

```text
Test Files  9 passed (9)
Tests       216 passed (216)

Statements : 99.1%  (222/224)     threshold 95
Branches   : 95.69% (178/186)     threshold 90
Functions  : 100%   (59/59)       threshold 95
Lines      : 100%   (195/195)     threshold 95
```

Below 100%: `analytics.ts` (stmts 97.14, branch 86.95, line 69), `matching.ts` (stmts 93.75, branch 85, lines 45-49),
`goalActions.ts` (branch 97.56, line 153), `next.config.ts` (branch 90, line 9). Thresholds are global, so the run passes.

### `npm run build`: passes

Compiled in 8.1 s, TypeScript finished, 10 static pages generated. Run with placeholder values
`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy`
(no real credentials used). Routes: `/` static; `/login`, `/register` static; `/dashboard`, `/goals`, `/onboarding`
partial prerender; `/workout/[day]` dynamic with partial prerender. Proxy detected.

### Other gates
`npm run lint`: passes with no output. `npm run typecheck`: passes.

### Not verified here
- Latest runs of GitHub Actions and SonarCloud (they run remotely; check the Actions tab).
- Whether `SONAR_TOKEN` and the other secrets are configured.
- `npm audit`, gitleaks and Semgrep were **not** run locally in this session.
- The `auth.users` trigger that calls `handle_new_user()` and the table grants (not in the catalog output the user pasted; see section 5).

---

## 5. Database verification and pending SQL

**Verified on 2026-11-25.** The user ran catalog queries in the Supabase SQL editor and pasted the results.
The schema is now committed as `supabase/migrations/20261125_baseline_schema.sql` (documentation only,
**do not run it** against the live database) and PROJECT_STATE.md section 3 is marked verified.

Findings (details and IDs in PROJECT_STATE.md section 7):
- RLS is enabled on all 7 tables and each has an `auth.uid()`-scoped policy (`training_methodologies`: public SELECT). CLAUDE.md 7.2 is met at table level.
- **D16** no indexes on any foreign key or `user_id`.
- **D17** missing CHECKs (`muscle_group`) and no UNIQUE on `exercise_cycles (goal_id, cycle_number)`.
- **D18** `handle_new_user()` is `SECURITY DEFINER` without `SET search_path`, and its `username` derivation can collide on the UNIQUE column.
- **D19-D24** role `public` instead of `authenticated`, no cross-table ownership check, cascade inconsistency, unused columns, app types diverging from the database.

**SQL pending for the user: none was applied.** Nothing in this block changed the live database. The fixes
above are proposals; each one needs a decision and a migration that the user runs by hand. Suggested next step:
one migration for D16 (indexes) and D17 (CHECKs and the UNIQUE), and one for D18 (`SET search_path = ''` and a collision-proof username).

Still to capture (run in the SQL editor and paste):

```sql
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

---

## 6. Open items handed to the next sprint

Full list with sources: PROJECT_STATE.md section 7. Highest priority:
**D16-D18** database indexes, CHECKs/UNIQUE and the signup function (new, from the live schema); **D3** cycle advance from the browser (move to a Server Action or Postgres function keyed by `workout_id`);
**D2** exercise catalog with a stable key; **D5** `/goals` missing from the proxy matcher and `PROTECTED_PREFIXES`.
