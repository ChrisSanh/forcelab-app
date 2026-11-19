import type { SplitPreset } from "@/lib/presets/defaultSplit";

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
