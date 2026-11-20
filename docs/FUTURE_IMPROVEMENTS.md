# ForceLab - Future Improvements

Ideas deferred on purpose. Review this file at the end of the project: anything
still open and still relevant gets implemented or corrected then.

Status: `open` | `done` | `dropped`

## 1. PR progress should only count bench-related work

- **Status:** done (Sprint 2, minimum fix)
- **Found:** Sprint 1, 2026-11-19
- **Where:** `src/app/dashboard/page.tsx` (progress card)

The card now counts only sets whose name matches the program's main lift
(`user_programs.main_lift_name`), through `sameExercise()` in
`src/lib/progression/matching.ts`.

**Still open (fuller version).** Account for accessory and transfer work
(incline press, dips, triceps, overhead press) with a documented weighting,
shown separately from the real bench e1RM so it is never confused with it.
Tied to the volume and joint-stress model planned for Sprints 3-4.

## 2. Exercises are matched to goals by name

- **Status:** open
- **Found:** Sprint 2, 2026-11-20
- **Where:** `src/lib/progression/matching.ts`

`set_logs` stores `exercise_name` as free text (a Spanish display label), and
goals store their own free-text name. They are linked by a normalized name
(lowercase, no accents, no parenthesized variant). It works for the preset but
breaks if a user renames an exercise.

**Fix:** add an exercise catalog with a stable key and store `exercise_key` in
`set_logs` and `user_goals`. This also unlocks the biomechanical audit.

## 3. Cycle counter is advanced from the browser

- **Status:** open
- **Found:** Sprint 2, 2026-11-20
- **Where:** `finish()` in `src/app/workout/[day]/WorkoutLogger.tsx`,
  `advanceCycle()` in `src/lib/progression/goalActions.ts`

`exercise_cycles.current_week_or_session` is incremented by the client when the
user taps "Terminar entrenamiento". If the user leaves without tapping it, or
the request fails halfway, the cycle does not advance; a retry after a partial
failure could advance it twice.

**Fix:** move the advance into a Postgres function or a Server Action keyed by
`workout_id`, so each session advances each cycle at most once.

## 4. Bilbo and heavy-block week are derived from two places

- **Status:** open
- **Found:** Sprint 2, 2026-11-20
- **Where:** `src/lib/progression/recommendations.ts`

The Bilbo prescription is recomputed from the last logged set, while
`exercise_cycles.current_prescribed_weight_kg` also stores the next load. Both
agree in the normal flow, but they can drift if sets are edited or deleted.

**Fix:** pick one source of truth (the cycle row) and make the recommendation
read it, using the last set only to decide the status transition.
