import { describe, expect, it } from "vitest";
import { findGoalForExercise, normalizeName, sameExercise } from "./matching";
import type { PresetExercise } from "@/lib/presets/defaultSplit";
import type { UserGoal } from "@/lib/types";

function goal(overrides: Partial<UserGoal>): UserGoal {
  return {
    id: "g1",
    user_id: "u1",
    program_id: null,
    exercise_name: "Press de Banca Plano",
    muscle_group: "chest",
    progression_type: "bilbo_cycle",
    starting_pr_kg: 110,
    current_pr_kg: 110,
    target_pr_kg: 150,
    target_sets: 3,
    rep_range_min: 8,
    rep_range_max: 12,
    increment_step_kg: 2.5,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const bench = (label: string): PresetExercise => ({
  name: label,
  label,
  isMainLift: true,
  scheme: { sets: 1, reps: "15+" },
});

describe("normalizeName", () => {
  it("removes accents, case and punctuation", () => {
    expect(normalizeName("Extensión de tríceps (polea)")).toBe("extension de triceps polea");
  });
});

describe("sameExercise", () => {
  it("matches the bench variants of the preset with the goal name", () => {
    expect(sameExercise("Press de Banca Plano", "Press de banca (Bilbo)")).toBe(true);
    expect(sameExercise("Press de Banca Plano", "Press de banca (pesado)")).toBe(true);
  });

  it("does not match different movements", () => {
    expect(sameExercise("Press de Banca Plano", "Press militar")).toBe(false);
    expect(sameExercise("Press de Banca Plano", "")).toBe(false);
  });
});

describe("findGoalForExercise", () => {
  const bilbo = goal({ id: "bilbo", progression_type: "bilbo_cycle" });
  const heavy = goal({ id: "heavy", progression_type: "heavy_blocks" });

  it("picks the goal that matches the day methodology", () => {
    expect(findGoalForExercise([bilbo, heavy], bench("Press de banca (Bilbo)"), "push_bilbo")?.id).toBe("bilbo");
    expect(findGoalForExercise([bilbo, heavy], bench("Press de banca (pesado)"), "push_heavy")?.id).toBe("heavy");
  });

  it("ignores inactive goals and returns null without a match", () => {
    expect(findGoalForExercise([goal({ is_active: false })], bench("Press de banca (Bilbo)"), "push_bilbo")).toBeNull();
    expect(findGoalForExercise([bilbo], bench("Dominadas"), "pull")).toBeNull();
  });
});
