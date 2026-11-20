/**
 * Dual automatic progression engine.
 *
 * Pure functions only (no I/O, no clock): they take what happened in the last
 * session(s) and return what to do in the next one. User-facing Spanish text
 * lives in `src/lib/progression/messages.ts`, not here.
 *
 * Progression types:
 *  - bilbo_cycle:        single explosive set, +2.5 kg per session from 50% of the PR
 *                        until the set falls below 15 reps.
 *  - heavy_blocks:       4-week wave 77% -> 80% -> 83% -> 70% (deload) of a base 1RM.
 *  - double_progression: hit the top of the rep range in every set -> add load.
 *  - linear_progression: complete target sets x top reps -> add load.
 */

import type { CycleStatus, ProgressionType } from "@/lib/types";

export const PLATE_STEP_KG = 2.5;
export const BILBO_START_PCT = 0.5;
export const BILBO_MIN_REPS = 15;
export const BILBO_INCREMENT_KG = 2.5;

export interface HeavyBlockWeek {
  week: number;
  percent: number;
  sets: number;
  reps: number;
  isDeload: boolean;
}

export const HEAVY_BLOCK_WEEKS: readonly HeavyBlockWeek[] = [
  { week: 1, percent: 0.77, sets: 4, reps: 4, isDeload: false },
  { week: 2, percent: 0.8, sets: 5, reps: 3, isDeload: false },
  { week: 3, percent: 0.83, sets: 4, reps: 2, isDeload: false },
  { week: 4, percent: 0.7, sets: 3, reps: 3, isDeload: true },
];

export interface LoggedSet {
  weightKg: number;
  reps: number;
  rir: number | null;
}

export type PrescriptionReason =
  | "cycle_start"
  | "progress"
  | "hold"
  | "cycle_end"
  | "block_week"
  | "block_complete"
  | "first_session"
  | "increase_weight"
  | "keep_weight";

export interface Prescription {
  progressionType: ProgressionType;
  reason: PrescriptionReason;
  status: CycleStatus;
  /** Load to use today. Null when there is no reference to prescribe from. */
  weightKg: number | null;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  /** Rep mark to beat today (Bilbo). */
  repsToBeat: number | null;
  /** Reps of the last session at the working weight (double progression). */
  previousReps: number[];
  lastWeightKg: number | null;
  /** Week of the block (heavy) or session number of the cycle (Bilbo). */
  sequence: number | null;
  /** Intensity as a fraction of the base 1RM, when prescribed that way. */
  percent: number | null;
}

function prescription(
  progressionType: ProgressionType,
  reason: PrescriptionReason,
  status: CycleStatus,
  overrides: Partial<Prescription> = {},
): Prescription {
  return {
    progressionType,
    reason,
    status,
    weightKg: null,
    sets: 0,
    repsMin: null,
    repsMax: null,
    repsToBeat: null,
    previousReps: [],
    lastWeightKg: null,
    sequence: null,
    percent: null,
    ...overrides,
  };
}

/** Rounds to the nearest 2.5 kg plate step. Invalid or non-positive input returns 0. */
export function roundTo2_5(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / PLATE_STEP_KG) * PLATE_STEP_KG;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Suggested load increment: 1.25 kg for dumbbells and cables, 2.5 kg otherwise. */
export function suggestIncrementStep(exerciseName: string): number {
  const name = exerciseName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return /mancuerna|dumbbell|polea|cable/.test(name) ? 1.25 : 2.5;
}

/** Sets performed at the heaviest load of a session (the "effective" working sets). */
export function workingSets(sets: LoggedSet[]): { weightKg: number; sets: LoggedSet[] } | null {
  if (sets.length === 0) return null;
  const weightKg = Math.max(...sets.map((s) => s.weightKg));
  return { weightKg, sets: sets.filter((s) => s.weightKg === weightKg) };
}

// ---------------------------------------------------------------------------
// bilbo_cycle
// ---------------------------------------------------------------------------

export interface BilboInput {
  currentPrKg: number;
  /** False when there is no active cycle yet. */
  cycleActive: boolean;
  /** Last Bilbo set of the previous session of this cycle. */
  lastSet: LoggedSet | null;
  /** Sessions already completed in this cycle. */
  completedSessions?: number;
  incrementKg?: number;
}

export function prescribeBilbo(input: BilboInput): Prescription {
  const increment = input.incrementKg ?? BILBO_INCREMENT_KG;
  const { lastSet } = input;

  if (!input.cycleActive || !lastSet) {
    const start = roundTo2_5(input.currentPrKg * BILBO_START_PCT);
    return prescription("bilbo_cycle", "cycle_start", "active", {
      weightKg: start > 0 ? start : null,
      sets: 1,
      repsMin: BILBO_MIN_REPS,
      percent: BILBO_START_PCT,
      sequence: (input.cycleActive ? (input.completedSessions ?? 0) : 0) + 1,
    });
  }

  const sequence = (input.completedSessions ?? 0) + 1;

  if (lastSet.reps < BILBO_MIN_REPS) {
    return prescription("bilbo_cycle", "cycle_end", "pr_test_ready", {
      weightKg: lastSet.weightKg,
      lastWeightKg: lastSet.weightKg,
      sets: 1,
      sequence,
    });
  }

  if ((lastSet.rir ?? 0) >= 1) {
    return prescription("bilbo_cycle", "progress", "active", {
      weightKg: round2(lastSet.weightKg + increment),
      lastWeightKg: lastSet.weightKg,
      sets: 1,
      repsMin: BILBO_MIN_REPS,
      repsToBeat: lastSet.reps,
      sequence,
    });
  }

  // 15+ reps but taken to failure (RIR 0): repeat the load.
  return prescription("bilbo_cycle", "hold", "active", {
    weightKg: lastSet.weightKg,
    lastWeightKg: lastSet.weightKg,
    sets: 1,
    repsMin: BILBO_MIN_REPS,
    repsToBeat: lastSet.reps,
    sequence,
  });
}

// ---------------------------------------------------------------------------
// heavy_blocks
// ---------------------------------------------------------------------------

export interface HeavyBlockInput {
  base1rmKg: number;
  /** Sessions already completed in this block (0 = first session of week 1). */
  completedSessions: number;
}

export function prescribeHeavyBlock(input: HeavyBlockInput): Prescription {
  const week = Math.max(0, Math.floor(input.completedSessions)) + 1;
  const config = HEAVY_BLOCK_WEEKS.find((w) => w.week === week);

  if (!config) {
    return prescription("heavy_blocks", "block_complete", "completed", { sequence: week });
  }

  const weight = roundTo2_5(input.base1rmKg * config.percent);
  return prescription(
    "heavy_blocks",
    "block_week",
    config.isDeload ? "deload_recommended" : "active",
    {
      weightKg: weight > 0 ? weight : null,
      sets: config.sets,
      repsMin: config.reps,
      repsMax: config.reps,
      percent: config.percent,
      sequence: week,
    },
  );
}

// ---------------------------------------------------------------------------
// double_progression
// ---------------------------------------------------------------------------

export interface DoubleProgressionInput {
  /** All logged sets of the previous session of this exercise. */
  lastSessionSets: LoggedSet[];
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  incrementKg: number;
}

export function prescribeDoubleProgression(input: DoubleProgressionInput): Prescription {
  const top = workingSets(input.lastSessionSets);
  const base = {
    sets: input.targetSets,
    repsMin: input.repRangeMin,
    repsMax: input.repRangeMax,
  };

  if (!top) {
    return prescription("double_progression", "first_session", "active", base);
  }

  const reachedTop =
    top.sets.length >= input.targetSets &&
    top.sets.every((s) => s.reps >= input.repRangeMax && (s.rir ?? 0) >= 1);

  if (reachedTop) {
    return prescription("double_progression", "increase_weight", "active", {
      ...base,
      weightKg: round2(top.weightKg + input.incrementKg),
      lastWeightKg: top.weightKg,
      repsToBeat: input.repRangeMin,
    });
  }

  return prescription("double_progression", "keep_weight", "active", {
    ...base,
    weightKg: top.weightKg,
    lastWeightKg: top.weightKg,
    previousReps: top.sets.map((s) => s.reps),
  });
}

// ---------------------------------------------------------------------------
// linear_progression
// ---------------------------------------------------------------------------

export interface LinearProgressionInput {
  lastSessionSets: LoggedSet[];
  targetSets: number;
  repRangeMax: number;
  incrementKg?: number;
}

export function prescribeLinear(input: LinearProgressionInput): Prescription {
  const increment = input.incrementKg ?? PLATE_STEP_KG;
  const top = workingSets(input.lastSessionSets);
  const base = { sets: input.targetSets, repsMin: input.repRangeMax, repsMax: input.repRangeMax };

  if (!top) {
    return prescription("linear_progression", "first_session", "active", base);
  }

  const completed =
    top.sets.length >= input.targetSets && top.sets.every((s) => s.reps >= input.repRangeMax);

  if (completed) {
    return prescription("linear_progression", "increase_weight", "active", {
      ...base,
      weightKg: round2(top.weightKg + increment),
      lastWeightKg: top.weightKg,
    });
  }

  return prescription("linear_progression", "keep_weight", "active", {
    ...base,
    weightKg: top.weightKg,
    lastWeightKg: top.weightKg,
    previousReps: top.sets.map((s) => s.reps),
  });
}

// ---------------------------------------------------------------------------
// cycles
// ---------------------------------------------------------------------------

export interface CycleStartValues {
  base1rmKg: number;
  currentPrescribedWeightKg: number;
  currentWeekOrSession: number;
  status: CycleStatus;
}

/** Initial values of a new cycle recalculated from a PR (used on goal creation and new PRs). */
export function startCycleValues(type: ProgressionType, prKg: number): CycleStartValues {
  const percent = type === "heavy_blocks" ? HEAVY_BLOCK_WEEKS[0].percent : BILBO_START_PCT;
  return {
    base1rmKg: prKg,
    currentPrescribedWeightKg: roundTo2_5(prKg * percent),
    currentWeekOrSession: 1,
    status: "active",
  };
}

/** Types that keep a row in `exercise_cycles`. */
export function usesCycles(type: ProgressionType): boolean {
  return type === "bilbo_cycle" || type === "heavy_blocks";
}
