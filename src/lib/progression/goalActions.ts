import type { SupabaseClient } from "@supabase/supabase-js";
import {
  startCycleValues,
  suggestIncrementStep,
  usesCycles,
} from "@/lib/math/progressionEngine";
import type { MuscleGroup, ProgressionType, UserGoal } from "@/lib/types";
import { firstError, goalSchema, newPrSchema } from "@/lib/validation/schemas";

export interface GoalFormValues {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  progressionType: ProgressionType;
  currentPrKg: number | null;
  targetPrKg: number | null;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  incrementStepKg: number;
}

export type ActionResult = { ok: true } | { ok: false; message: string };

function fail(prefix: string, error: { message: string; details?: string | null }): ActionResult {
  console.error(prefix, error);
  return { ok: false, message: `${prefix} (${error.message}${error.details ? ` — ${error.details}` : ""})` };
}

/** Validates the form with the shared Zod schema; returns the first Spanish message, or null. */
export function validateGoal(values: GoalFormValues): string | null {
  return firstError(goalSchema.safeParse(values));
}

/** Defaults that depend on the progression type. */
export function defaultsFor(type: ProgressionType, exerciseName = ""): Pick<
  GoalFormValues,
  "targetSets" | "repRangeMin" | "repRangeMax" | "incrementStepKg"
> {
  switch (type) {
    case "bilbo_cycle":
      return { targetSets: 1, repRangeMin: 15, repRangeMax: 30, incrementStepKg: 2.5 };
    case "heavy_blocks":
      return { targetSets: 4, repRangeMin: 2, repRangeMax: 4, incrementStepKg: 2.5 };
    case "linear_progression":
      return { targetSets: 4, repRangeMin: 6, repRangeMax: 6, incrementStepKg: 2.5 };
    case "double_progression":
      return { targetSets: 3, repRangeMin: 8, repRangeMax: 12, incrementStepKg: suggestIncrementStep(exerciseName) };
  }
}

async function openCycle(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  type: ProgressionType,
  prKg: number,
  cycleNumber: number,
): Promise<ActionResult> {
  const start = startCycleValues(type, prKg);
  const { error } = await supabase.from("exercise_cycles").insert({
    user_id: userId,
    goal_id: goalId,
    cycle_number: cycleNumber,
    base_1rm_kg: start.base1rmKg,
    current_prescribed_weight_kg: start.currentPrescribedWeightKg,
    current_week_or_session: start.currentWeekOrSession,
    status: start.status,
  });
  return error ? fail("No pudimos iniciar el ciclo.", error) : { ok: true };
}

export async function createGoal(
  supabase: SupabaseClient,
  userId: string,
  programId: string | null,
  values: GoalFormValues,
): Promise<ActionResult> {
  const { data, error } = await supabase
    .from("user_goals")
    .insert({
      user_id: userId,
      program_id: programId,
      exercise_name: values.exerciseName.trim(),
      muscle_group: values.muscleGroup,
      progression_type: values.progressionType,
      starting_pr_kg: values.currentPrKg,
      current_pr_kg: values.currentPrKg,
      target_pr_kg: values.targetPrKg,
      target_sets: values.targetSets,
      rep_range_min: values.repRangeMin,
      rep_range_max: values.repRangeMax,
      increment_step_kg: values.incrementStepKg,
    })
    .select("id")
    .single();
  if (error || !data) return fail("No pudimos crear la meta.", error ?? { message: "sin datos" });

  if (usesCycles(values.progressionType) && values.currentPrKg) {
    return openCycle(supabase, userId, data.id, values.progressionType, values.currentPrKg, 1);
  }
  return { ok: true };
}

export async function updateGoal(
  supabase: SupabaseClient,
  goalId: string,
  values: GoalFormValues,
): Promise<ActionResult> {
  const { error } = await supabase
    .from("user_goals")
    .update({
      exercise_name: values.exerciseName.trim(),
      muscle_group: values.muscleGroup,
      progression_type: values.progressionType,
      target_pr_kg: values.targetPrKg,
      target_sets: values.targetSets,
      rep_range_min: values.repRangeMin,
      rep_range_max: values.repRangeMax,
      increment_step_kg: values.incrementStepKg,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId);
  return error ? fail("No pudimos guardar los cambios.", error) : { ok: true };
}

export async function closeGoal(supabase: SupabaseClient, goalId: string): Promise<ActionResult> {
  const { error } = await supabase
    .from("user_goals")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", goalId);
  if (error) return fail("No pudimos cerrar la meta.", error);

  await supabase
    .from("exercise_cycles")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("goal_id", goalId)
    .neq("status", "completed");
  return { ok: true };
}

/**
 * Records an official PR: updates current_pr_kg and, for cycle-based goals,
 * closes the running cycle and opens a new one recalculated from the new PR.
 */
export async function registerNewPr(
  supabase: SupabaseClient,
  userId: string,
  goal: UserGoal,
  newPrKg: number,
): Promise<ActionResult> {
  const previous = Number(goal.current_pr_kg ?? 0);
  const parsed = newPrSchema(previous).safeParse({ newPrKg });
  if (!parsed.success) return { ok: false, message: firstError(parsed) ?? "PR no válido." };
  newPrKg = parsed.data.newPrKg as number;

  const { error } = await supabase
    .from("user_goals")
    .update({ current_pr_kg: newPrKg, updated_at: new Date().toISOString() })
    .eq("id", goal.id);
  if (error) return fail("No pudimos registrar el PR.", error);

  if (!usesCycles(goal.progression_type)) return { ok: true };

  const { data: lastCycle } = await supabase
    .from("exercise_cycles")
    .select("cycle_number")
    .eq("goal_id", goal.id)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from("exercise_cycles")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("goal_id", goal.id)
    .neq("status", "completed");

  const next = ((lastCycle as { cycle_number: number } | null)?.cycle_number ?? 0) + 1;
  // A reached target stays open on purpose: the UI shows it as achieved and the user can raise the goal.
  return openCycle(supabase, userId, goal.id, goal.progression_type, newPrKg, next);
}

/**
 * Advances the cycle after a finished session: increments the session/week
 * counter and applies the status chosen by the progression engine.
 */
export async function advanceCycle(
  supabase: SupabaseClient,
  goalId: string,
  status: "active" | "deload_recommended" | "pr_test_ready" | "completed",
  nextWeightKg: number | null,
): Promise<void> {
  const { data: cycle } = await supabase
    .from("exercise_cycles")
    .select("id, current_week_or_session")
    .eq("goal_id", goalId)
    .in("status", ["active", "deload_recommended", "pr_test_ready"])
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cycle) return;

  const row = cycle as { id: string; current_week_or_session: number };
  await supabase
    .from("exercise_cycles")
    .update({
      current_week_or_session: row.current_week_or_session + 1,
      status,
      ...(nextWeightKg != null ? { current_prescribed_weight_kg: nextWeightKg } : {}),
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", row.id);
}
