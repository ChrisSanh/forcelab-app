import type { SupabaseClient } from "@supabase/supabase-js";
import type { PresetDay } from "@/lib/presets/defaultSplit";
import {
  prescribeBilbo,
  prescribeDoubleProgression,
  prescribeHeavyBlock,
  prescribeLinear,
  suggestIncrementStep,
  type LoggedSet,
  type Prescription,
} from "@/lib/math/progressionEngine";
import type { ExerciseCycle, UserGoal } from "@/lib/types";
import { findGoalForExercise, sameExercise } from "./matching";

export interface ExerciseRecommendation {
  /** Preset exercise name (key used by the logger). */
  exerciseName: string;
  goalId: string;
  prescription: Prescription;
}

interface SetRow {
  workout_id: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rir: number | null;
  created_at: string;
}

/** Groups logged sets by session and returns the most recent session's sets. */
function lastSessionSets(rows: SetRow[], goalName: string, fallbackNames: string[]): LoggedSet[] {
  const own = rows.filter(
    (r) => sameExercise(goalName, r.exercise_name) || fallbackNames.some((n) => sameExercise(n, r.exercise_name)),
  );
  if (own.length === 0) return [];

  // Rows arrive newest-first, so the first workout_id is the latest session.
  const latestWorkout = own[0].workout_id;
  return own
    .filter((r) => r.workout_id === latestWorkout)
    .sort((a, b) => a.set_number - b.set_number)
    .map((r) => ({ weightKg: Number(r.weight_kg), reps: r.reps, rir: r.rir }));
}

export function prescribeForGoal(
  goal: UserGoal,
  cycle: ExerciseCycle | null,
  sets: LoggedSet[],
): Prescription {
  const pr = Number(goal.current_pr_kg ?? goal.starting_pr_kg ?? 0);

  switch (goal.progression_type) {
    case "bilbo_cycle":
      return prescribeBilbo({
        currentPrKg: cycle ? Number(cycle.base_1rm_kg) : pr,
        cycleActive: cycle?.status === "active" || cycle?.status === "pr_test_ready",
        lastSet: sets.length > 0 ? sets[sets.length - 1] : null,
        completedSessions: cycle ? Math.max(0, cycle.current_week_or_session - 1) : 0,
        incrementKg: Number(goal.increment_step_kg) || undefined,
      });
    case "heavy_blocks":
      return prescribeHeavyBlock({
        base1rmKg: cycle ? Number(cycle.base_1rm_kg) : pr,
        completedSessions: cycle ? Math.max(0, cycle.current_week_or_session - 1) : 0,
      });
    case "double_progression":
      return prescribeDoubleProgression({
        lastSessionSets: sets,
        targetSets: goal.target_sets,
        repRangeMin: goal.rep_range_min,
        repRangeMax: goal.rep_range_max,
        incrementKg: Number(goal.increment_step_kg) || suggestIncrementStep(goal.exercise_name),
      });
    case "linear_progression":
      return prescribeLinear({
        lastSessionSets: sets,
        targetSets: goal.target_sets,
        repRangeMax: goal.rep_range_max,
        incrementKg: Number(goal.increment_step_kg) || undefined,
      });
  }
}

/** Builds the recommendation of every exercise of a day that has an active goal. */
export async function getDayRecommendations(
  supabase: SupabaseClient,
  userId: string,
  day: PresetDay,
): Promise<ExerciseRecommendation[]> {
  const [{ data: goalRows }, { data: cycleRows }, { data: setRows }] = await Promise.all([
    supabase.from("user_goals").select("*").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("exercise_cycles")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "deload_recommended", "pr_test_ready"])
      .order("cycle_number", { ascending: false }),
    supabase
      .from("set_logs")
      .select("workout_id, exercise_name, set_number, weight_kg, reps, rir, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const goals = (goalRows ?? []) as UserGoal[];
  const cycles = (cycleRows ?? []) as ExerciseCycle[];
  const sets = (setRows ?? []) as SetRow[];
  const result: ExerciseRecommendation[] = [];

  for (const exercise of day.exercises) {
    const goal = findGoalForExercise(goals, exercise, day.type);
    if (!goal) continue;

    const cycle = cycles.find((c) => c.goal_id === goal.id) ?? null;
    const history = lastSessionSets(sets, goal.exercise_name, [exercise.label, exercise.name]);
    result.push({
      exerciseName: exercise.name,
      goalId: goal.id,
      prescription: prescribeForGoal(goal, cycle, history),
    });
  }
  return result;
}
