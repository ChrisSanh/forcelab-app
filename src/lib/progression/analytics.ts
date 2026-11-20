import { sameExercise } from "./matching";

export interface SetPoint {
  workout_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  calculated_e1rm: number | null;
  created_at: string;
}

export interface SessionPoint {
  /** ISO date (yyyy-mm-dd) of the session. */
  date: string;
  /** Best e1RM of the session, in kg. */
  e1rm: number | null;
  /** Total volume load: sum of weight x reps, in kg. */
  tonnage: number;
}

/** Display names of every exercise that has logged sets, most trained first. */
export function exerciseOptions(sets: SetPoint[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sets) counts.set(s.exercise_name, (counts.get(s.exercise_name) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** One point per session for a given exercise: best e1RM and tonnage. */
export function buildSeries(sets: SetPoint[], exerciseName: string): SessionPoint[] {
  const bySession = new Map<string, SessionPoint>();

  for (const s of sets) {
    if (!sameExercise(exerciseName, s.exercise_name)) continue;
    const date = s.created_at.slice(0, 10);
    const key = `${s.workout_id}`;
    const point = bySession.get(key) ?? { date, e1rm: null, tonnage: 0 };
    point.tonnage += Number(s.weight_kg) * s.reps;
    if (s.calculated_e1rm != null) {
      point.e1rm = Math.max(point.e1rm ?? 0, Number(s.calculated_e1rm));
    }
    bySession.set(key, point);
  }

  return [...bySession.values()]
    .map((p) => ({ ...p, tonnage: Math.round(p.tonnage) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Milestone {
  value: number;
  reached: boolean;
}

/** Strength milestones every `step` kg between the starting PR and the target. */
export function buildMilestones(start: number, target: number, current: number, step = 5): Milestone[] {
  if (!(target > start) || step <= 0) return [];
  const result: Milestone[] = [];
  for (let v = start + step; v < target; v += step) {
    result.push({ value: v, reached: current >= v });
  }
  result.push({ value: target, reached: current >= target });
  return result;
}

/** Hypertrophy level: share of the rep range covered by the last working sets. */
export function hypertrophyLevel(lastReps: number[], repMin: number, repMax: number): number {
  if (lastReps.length === 0 || repMax <= 0) return 0;
  const avg = lastReps.reduce((a, b) => a + b, 0) / lastReps.length;
  if (repMax === repMin) return avg >= repMax ? 100 : 0;
  return Math.round(Math.min(100, Math.max(0, ((avg - repMin) / (repMax - repMin)) * 100)));
}
