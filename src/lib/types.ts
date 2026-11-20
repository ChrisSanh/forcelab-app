import type { SplitPreset } from "@/lib/presets/defaultSplit";

export type ProgressionType =
  | "bilbo_cycle"
  | "heavy_blocks"
  | "double_progression"
  | "linear_progression";
export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms";
export type CycleStatus = "active" | "deload_recommended" | "pr_test_ready" | "completed";

/** Row of `user_goals`: one goal per exercise and progression type. */
export interface UserGoal {
  id: string;
  user_id: string;
  program_id: string | null;
  exercise_name: string;
  muscle_group: MuscleGroup;
  progression_type: ProgressionType;
  starting_pr_kg: number | null;
  current_pr_kg: number | null;
  target_pr_kg: number | null;
  target_sets: number;
  rep_range_min: number;
  rep_range_max: number;
  increment_step_kg: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Row of `exercise_cycles`: Bilbo ladders and 4-week heavy blocks. */
export interface ExerciseCycle {
  id: string;
  user_id: string;
  goal_id: string;
  cycle_number: number;
  base_1rm_kg: number;
  current_prescribed_weight_kg: number;
  current_week_or_session: number;
  status: CycleStatus;
  started_at: string;
  completed_at: string | null;
}

export type SetCategory = "explosive_bilbo" | "heavy_strength" | "hypertrophy" | "warmup";
export type BarSpeed = "explosive" | "fast" | "moderate" | "grind";

export interface Methodology {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_config: Record<string, unknown> | null;
}

export interface Profile {
  id: string;
  bodyweight_kg: number | null;
  training_start_date: string | null;
}

export interface UserProgram {
  id: string;
  user_id: string;
  methodology_id: string | null;
  program_name: string | null;
  is_active: boolean;
  split_structure: SplitPreset | null;
  main_lift_name: string;
  starting_pr_kg: number;
  current_pr_kg: number;
  target_pr_kg: number;
  created_at: string;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  program_id: string | null;
  day_label: string | null;
  session_date: string;
  created_at: string;
}

export interface SetLog {
  id: string;
  workout_id: string;
  user_id: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  set_category: SetCategory;
  rir: number | null;
  bar_speed: BarSpeed | null;
  calculated_e1rm: number | null;
  created_at: string;
}
