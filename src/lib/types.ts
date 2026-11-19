import type { SplitPreset } from "@/lib/presets/defaultSplit";

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
  current_pr_kg: number | null;
  target_pr_kg: number | null;
}

export interface UserProgram {
  id: string;
  user_id: string;
  methodology_id: string | null;
  program_name: string | null;
  is_active: boolean;
  split_structure: SplitPreset | null;
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
  rir: number | null;
  perceived_velocity: number | null;
  calculated_e1rm: number | null;
  created_at: string;
}
