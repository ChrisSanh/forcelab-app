# ForceLab - Future Improvements

Ideas deferred on purpose. Review this file at the end of the project: anything
still open and still relevant gets implemented or corrected then.

Status: `open` | `done` | `dropped`

## 1. PR progress should only count bench-related work

- **Status:** open
- **Found:** Sprint 1, 2026-11-19
- **Where:** `src/app/dashboard/page.tsx` (progress card, `bestSet` query)

**Current behavior.** The "Progreso hacia tu PR" card takes the highest
`set_logs.calculated_e1rm` across *all* exercises. A single set of incline
dumbbell press in the Upper day already pushed the card to 120.4 kg, which
inflates progress toward the bench press goal.

**Desired behavior.** The goal is a bench press PR, so the metric should measure
what actually influences the bench:

1. **Minimum fix:** count only sets of the program's main lift
   (`user_programs.main_lift_name`, flagged `isMainLift` in the preset).
2. **Fuller version:** also account for accessory and transfer work
   (incline press, dips, triceps, overhead press) with a documented weighting,
   shown separately from the real bench e1RM so it is never confused with it.

**Notes for implementation.**
- `set_logs` stores `exercise_name` (a Spanish display label) and has no
  exercise id. Filtering by name is fragile; consider adding an
  `exercise_key` column, or a boolean `is_main_lift`.
- The preset names the bench sets "Press de banca (Bilbo)" and
  "Press de banca (pesado)", so a name match would have to cover both.
- Keep the e1RM weighting for accessories tied to the scientific framework
  (volume and joint-stress model planned for Sprints 3-4).
