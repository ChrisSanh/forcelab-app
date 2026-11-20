import { describe, expect, it } from "vitest";
import {
  exerciseNameSchema,
  firstError,
  goalSchema,
  newPrSchema,
  onboardingSchema,
  profileSchema,
  setDraftSchema,
  setLogSchema,
} from "../schemas";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const validGoal = {
  exerciseName: "Press de Banca Plano",
  muscleGroup: "chest",
  progressionType: "bilbo_cycle",
  currentPrKg: "110",
  targetPrKg: "150",
  targetSets: "1",
  repRangeMin: "15",
  repRangeMax: "30",
  incrementStepKg: "2,5",
};

describe("exerciseNameSchema", () => {
  it("accepts normal Spanish exercise names", () => {
    for (const name of ["Press de Banca Plano", "Sentadilla Hack", "Remo T (barra)", "Extensión de tríceps en polea"]) {
      expect(exerciseNameSchema.safeParse(name).success).toBe(true);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(exerciseNameSchema.parse("  Remo T  ")).toBe("Remo T");
  });

  it.each([
    ["markup", "<script>alert(1)</script>"],
    ["an attribute injection", '" onmouseover="x'],
    ["a SQL fragment", "x'; DROP TABLE set_logs;--"],
    ["a template expression", "${process.env.SECRET}"],
    ["empty", ""],
    ["only spaces", "    "],
  ])("rejects %s", (_label, value) => {
    expect(exerciseNameSchema.safeParse(value).success).toBe(false);
  });

  it("rejects names longer than 80 characters", () => {
    expect(exerciseNameSchema.safeParse("a".repeat(81)).success).toBe(false);
    expect(exerciseNameSchema.safeParse("a".repeat(80)).success).toBe(true);
  });
});

describe("profileSchema", () => {
  const ok = { bodyweightKg: "94", trainingStartDate: "2025-06-14" };

  it("parses a valid profile and accepts a decimal comma", () => {
    expect(profileSchema.parse({ ...ok, bodyweightKg: "94,5" }).bodyweightKg).toBe(94.5);
  });

  it.each([
    ["negative weight", { ...ok, bodyweightKg: "-5" }],
    ["zero weight", { ...ok, bodyweightKg: "0" }],
    ["absurd weight", { ...ok, bodyweightKg: "9000" }],
    ["below 30 kg", { ...ok, bodyweightKg: "20" }],
    ["text weight", { ...ok, bodyweightKg: "mucho" }],
    ["empty weight", { ...ok, bodyweightKg: "" }],
    ["three decimals", { ...ok, bodyweightKg: "94.123" }],
    ["bad date", { ...ok, trainingStartDate: "14-06-2025" }],
    ["impossible date", { ...ok, trainingStartDate: "2025-13-45" }],
    ["future date", { ...ok, trainingStartDate: "2999-01-01" }],
  ])("rejects %s", (_label, value) => {
    expect(profileSchema.safeParse(value).success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const ok = { bodyweightKg: "94", trainingStartDate: "2025-06-14", currentPrKg: "110", targetPrKg: "150", methodologyId: UUID };

  it("accepts a valid onboarding", () => {
    expect(onboardingSchema.safeParse(ok).success).toBe(true);
  });

  it("requires the target above the current PR", () => {
    const r = onboardingSchema.safeParse({ ...ok, targetPrKg: "110" });
    expect(r.success).toBe(false);
    expect(firstError(r)).toBe("Tu PR objetivo debe ser mayor que tu PR actual.");
  });

  it("rejects a PR above the realistic ceiling", () => {
    expect(onboardingSchema.safeParse({ ...ok, currentPrKg: "700", targetPrKg: "800" }).success).toBe(false);
  });

  it("rejects a methodology that is not a UUID", () => {
    expect(onboardingSchema.safeParse({ ...ok, methodologyId: "1; DROP TABLE" }).success).toBe(false);
  });
});

describe("goalSchema", () => {
  it("parses a valid cycle goal", () => {
    const g = goalSchema.parse(validGoal);
    expect(g.currentPrKg).toBe(110);
    expect(g.incrementStepKg).toBe(2.5);
  });

  it("accepts a hypertrophy goal without PRs", () => {
    const r = goalSchema.safeParse({
      ...validGoal,
      progressionType: "double_progression",
      currentPrKg: null,
      targetPrKg: null,
      targetSets: 3,
      repRangeMin: 8,
      repRangeMax: 12,
    });
    expect(r.success).toBe(true);
  });

  it("requires a current mark for cycle-based progressions", () => {
    for (const progressionType of ["bilbo_cycle", "heavy_blocks"]) {
      const r = goalSchema.safeParse({ ...validGoal, progressionType, currentPrKg: undefined });
      expect(r.success).toBe(false);
      expect(firstError(r)).toBe("Ingresa tu marca actual (1RM) en kg.");
    }
  });

  it("requires target above current", () => {
    expect(goalSchema.safeParse({ ...validGoal, targetPrKg: "100" }).success).toBe(false);
  });

  it("requires rep max >= rep min", () => {
    const r = goalSchema.safeParse({ ...validGoal, repRangeMin: "12", repRangeMax: "8" });
    expect(r.success).toBe(false);
  });

  it.each([
    ["series 0", { targetSets: "0" }],
    ["series 11", { targetSets: "11" }],
    ["fractional series", { targetSets: "2.5" }],
    ["negative reps", { repRangeMin: "-1" }],
    ["reps over 50", { repRangeMax: "51" }],
    ["zero increment", { incrementStepKg: "0" }],
    ["negative increment", { incrementStepKg: "-2.5" }],
    ["huge increment", { incrementStepKg: "200" }],
    ["increment not a multiple of 0.25", { incrementStepKg: "1.1" }],
    ["unknown muscle group", { muscleGroup: "neck" }],
    ["unknown progression", { progressionType: "random" }],
    ["markup in the name", { exerciseName: "<img src=x onerror=alert(1)>" }],
  ])("rejects %s", (_label, patch) => {
    expect(goalSchema.safeParse({ ...validGoal, ...patch }).success).toBe(false);
  });

  it("accepts every valid muscle group and progression type", () => {
    for (const muscleGroup of ["chest", "back", "legs", "shoulders", "arms"]) {
      expect(goalSchema.safeParse({ ...validGoal, muscleGroup }).success).toBe(true);
    }
    for (const progressionType of ["bilbo_cycle", "heavy_blocks", "double_progression", "linear_progression"]) {
      expect(goalSchema.safeParse({ ...validGoal, progressionType }).success).toBe(true);
    }
  });
});

describe("newPrSchema", () => {
  it("accepts a PR that beats the current mark", () => {
    expect(newPrSchema(110).safeParse({ newPrKg: "115" }).success).toBe(true);
  });

  it("rejects equal or lower PRs with the current mark in the message", () => {
    for (const value of ["110", "100"]) {
      const r = newPrSchema(110).safeParse({ newPrKg: value });
      expect(r.success).toBe(false);
      expect(firstError(r)).toContain("110");
    }
  });

  it("rejects non-numeric and out-of-range values", () => {
    expect(newPrSchema(110).safeParse({ newPrKg: "abc" }).success).toBe(false);
    expect(newPrSchema(110).safeParse({ newPrKg: "100000" }).success).toBe(false);
  });
});

describe("setLogSchema", () => {
  const ok = {
    exerciseName: "Press de banca (Bilbo)",
    setCategory: "explosive_bilbo",
    setNumber: 1,
    weightKg: "55",
    reps: "24",
    rir: 1,
    barSpeed: "explosive",
    calculatedE1rm: 98.4,
  };

  it("accepts a complete valid set", () => {
    expect(setLogSchema.safeParse(ok).success).toBe(true);
  });

  it("accepts a set without optional telemetry", () => {
    const r = setLogSchema.safeParse({ ...ok, rir: null, barSpeed: null, calculatedE1rm: null });
    expect(r.success).toBe(true);
  });

  it.each([
    ["negative weight", { weightKg: "-50" }],
    ["zero weight", { weightKg: "0" }],
    ["weight overflow (numeric(5,2))", { weightKg: "1000" }],
    ["zero reps", { reps: "0" }],
    ["negative reps", { reps: "-3" }],
    ["fractional reps", { reps: "5.5" }],
    ["absurd reps", { reps: "5000" }],
    ["RIR 6", { rir: 6 }],
    ["negative RIR", { rir: -1 }],
    ["fractional RIR", { rir: 1.5 }],
    ["unknown speed", { barSpeed: "warp" }],
    ["unknown category", { setCategory: "cardio" }],
    ["set number 0", { setNumber: 0 }],
    ["e1RM overflow", { calculatedE1rm: 1500 }],
    ["markup in the name", { exerciseName: "<b>x</b>" }],
  ])("rejects %s", (_label, patch) => {
    expect(setLogSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });

  it("accepts every valid bar speed and category", () => {
    for (const barSpeed of ["explosive", "fast", "moderate", "grind"]) {
      expect(setLogSchema.safeParse({ ...ok, barSpeed }).success).toBe(true);
    }
    for (const setCategory of ["explosive_bilbo", "heavy_strength", "hypertrophy", "warmup"]) {
      expect(setLogSchema.safeParse({ ...ok, setCategory }).success).toBe(true);
    }
  });
});

describe("setDraftSchema", () => {
  it("accepts typed strings with a decimal comma", () => {
    expect(setDraftSchema.parse({ weightKg: "57,5", reps: "12" })).toEqual({ weightKg: 57.5, reps: 12 });
  });

  it("rejects blanks and invalid values", () => {
    expect(setDraftSchema.safeParse({ weightKg: "", reps: "12" }).success).toBe(false);
    expect(setDraftSchema.safeParse({ weightKg: "50", reps: "" }).success).toBe(false);
    expect(setDraftSchema.safeParse({ weightKg: "NaN", reps: "12" }).success).toBe(false);
    expect(setDraftSchema.safeParse({ weightKg: "Infinity", reps: "12" }).success).toBe(false);
  });
});

describe("firstError", () => {
  it("returns null for a successful parse", () => {
    expect(firstError(setDraftSchema.safeParse({ weightKg: "50", reps: "8" }))).toBeNull();
  });

  it("returns the first Spanish message for a failed parse", () => {
    const message = firstError(setDraftSchema.safeParse({ weightKg: "-1", reps: "8" }));
    expect(message).toBe("El peso debe ser mayor que 0.");
  });

  it("falls back to a generic message when the error is missing", () => {
    expect(firstError({ success: false })).toBe("Datos no válidos.");
  });
});
