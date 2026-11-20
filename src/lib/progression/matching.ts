import type { PresetExercise } from "@/lib/presets/defaultSplit";
import type { UserGoal } from "@/lib/types";

/** Lowercase, no accents, no punctuation: "Press de banca (Bilbo)" -> "press de banca bilbo". */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Strips the variant suffix the preset adds to the main lift
 * ("Press de banca (Bilbo)", "Press de banca (pesado)") so both match a goal
 * called "Press de Banca Plano".
 */
function baseName(name: string): string {
  return normalizeName(name.replace(/\(.*?\)/g, " "));
}

/** True when a goal's exercise name refers to the same movement as `candidate`. */
export function sameExercise(goalName: string, candidate: string): boolean {
  const a = baseName(goalName);
  const b = baseName(candidate);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Finds the goal that governs a preset exercise. When a main lift has several
 * goals (e.g. Bilbo and heavy blocks on the bench), the day decides which one
 * applies: Push 1 uses Bilbo and Push 2 uses heavy blocks.
 */
export function findGoalForExercise(
  goals: UserGoal[],
  exercise: PresetExercise,
  dayType: string,
): UserGoal | null {
  const candidates = goals.filter(
    (g) => g.is_active && (sameExercise(g.exercise_name, exercise.label) || sameExercise(g.exercise_name, exercise.name)),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const preferred =
    dayType === "push_bilbo" ? "bilbo_cycle" : dayType === "push_heavy" ? "heavy_blocks" : null;
  return candidates.find((g) => g.progression_type === preferred) ?? candidates[0];
}
