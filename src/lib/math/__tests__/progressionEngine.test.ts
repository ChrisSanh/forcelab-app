import { describe, expect, it } from "vitest";
import {
  prescribeBilbo,
  prescribeDoubleProgression,
  prescribeHeavyBlock,
  prescribeLinear,
  roundTo2_5,
  startCycleValues,
  suggestIncrementStep,
  usesCycles,
  workingSets,
  type LoggedSet,
} from "../progressionEngine";

const set = (weightKg: number, reps: number, rir: number | null = 2): LoggedSet => ({
  weightKg,
  reps,
  rir,
});

describe("roundTo2_5", () => {
  it("rounds to the nearest 2.5 kg", () => {
    expect(roundTo2_5(55)).toBe(55);
    expect(roundTo2_5(84.7)).toBe(85);
    expect(roundTo2_5(88)).toBe(87.5);
    expect(roundTo2_5(91.3)).toBe(92.5);
  });

  it("returns 0 for invalid input", () => {
    expect(roundTo2_5(0)).toBe(0);
    expect(roundTo2_5(-10)).toBe(0);
    expect(roundTo2_5(Number.NaN)).toBe(0);
  });
});

describe("prescribeBilbo", () => {
  it("starts at 50% of the PR when there is no active cycle", () => {
    const p = prescribeBilbo({ currentPrKg: 110, cycleActive: false, lastSet: null });
    expect(p.reason).toBe("cycle_start");
    expect(p.weightKg).toBe(55);
    expect(p.status).toBe("active");
  });

  it("rounds the starting load to 2.5 kg", () => {
    const p = prescribeBilbo({ currentPrKg: 117, cycleActive: false, lastSet: null });
    expect(p.weightKg).toBe(57.5);
  });

  it("starts the cycle when active but nothing has been logged yet", () => {
    const p = prescribeBilbo({ currentPrKg: 110, cycleActive: true, lastSet: null });
    expect(p.reason).toBe("cycle_start");
    expect(p.weightKg).toBe(55);
  });

  it("adds 2.5 kg and shows the rep mark when reps >= 15 and RIR >= 1", () => {
    const p = prescribeBilbo({
      currentPrKg: 110,
      cycleActive: true,
      lastSet: set(55, 24, 1),
      completedSessions: 1,
    });
    expect(p.reason).toBe("progress");
    expect(p.weightKg).toBe(57.5);
    expect(p.repsToBeat).toBe(24);
    expect(p.status).toBe("active");
    expect(p.sequence).toBe(2);
  });

  it("flags the PR test when the last set is below 15 reps", () => {
    const p = prescribeBilbo({ currentPrKg: 110, cycleActive: true, lastSet: set(80, 14, 1) });
    expect(p.reason).toBe("cycle_end");
    expect(p.status).toBe("pr_test_ready");
    expect(p.weightKg).toBe(80);
  });

  it("repeats the load when 15+ reps were taken to failure", () => {
    const p = prescribeBilbo({ currentPrKg: 110, cycleActive: true, lastSet: set(60, 16, 0) });
    expect(p.reason).toBe("hold");
    expect(p.weightKg).toBe(60);
  });

  it("treats a missing RIR as 0 and repeats the load", () => {
    const p = prescribeBilbo({ currentPrKg: 110, cycleActive: true, lastSet: set(60, 18, null) });
    expect(p.reason).toBe("hold");
  });

  it("respects a custom increment", () => {
    const p = prescribeBilbo({
      currentPrKg: 110,
      cycleActive: true,
      lastSet: set(55, 20, 2),
      incrementKg: 1.25,
    });
    expect(p.weightKg).toBe(56.25);
  });
});

describe("prescribeHeavyBlock", () => {
  it("follows the 4-week wave on a 110 kg base", () => {
    const weeks = [0, 1, 2, 3].map((n) => prescribeHeavyBlock({ base1rmKg: 110, completedSessions: n }));
    expect(weeks.map((w) => w.weightKg)).toEqual([85, 87.5, 92.5, 77.5]);
    expect(weeks.map((w) => `${w.sets}x${w.repsMin}`)).toEqual(["4x4", "5x3", "4x2", "3x3"]);
    expect(weeks.map((w) => w.percent)).toEqual([0.77, 0.8, 0.83, 0.7]);
    expect(weeks.map((w) => w.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("marks the deload week", () => {
    expect(prescribeHeavyBlock({ base1rmKg: 110, completedSessions: 3 }).status).toBe(
      "deload_recommended",
    );
    expect(prescribeHeavyBlock({ base1rmKg: 110, completedSessions: 0 }).status).toBe("active");
  });

  it("reports the block as complete after week 4", () => {
    const p = prescribeHeavyBlock({ base1rmKg: 110, completedSessions: 4 });
    expect(p.reason).toBe("block_complete");
    expect(p.status).toBe("completed");
    expect(p.weightKg).toBeNull();
  });
});

describe("prescribeDoubleProgression", () => {
  const base = { targetSets: 3, repRangeMin: 10, repRangeMax: 12, incrementKg: 2.5 };

  it("asks for a starting load when there is no history", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [] });
    expect(p.reason).toBe("first_session");
    expect(p.weightKg).toBeNull();
  });

  it("adds load when every set hit the top of the range with RIR >= 1", () => {
    const p = prescribeDoubleProgression({
      ...base,
      lastSessionSets: [set(20, 12, 1), set(20, 12, 2), set(20, 12, 1)],
    });
    expect(p.reason).toBe("increase_weight");
    expect(p.weightKg).toBe(22.5);
    expect(p.repsToBeat).toBe(10);
  });

  it("uses the small dumbbell step", () => {
    const p = prescribeDoubleProgression({
      ...base,
      incrementKg: 1.25,
      lastSessionSets: [set(20, 12), set(20, 12), set(20, 12)],
    });
    expect(p.weightKg).toBe(21.25);
  });

  it("keeps the load when a set missed the top of the range", () => {
    const p = prescribeDoubleProgression({
      ...base,
      lastSessionSets: [set(20, 12), set(20, 11), set(20, 10)],
    });
    expect(p.reason).toBe("keep_weight");
    expect(p.weightKg).toBe(20);
    expect(p.previousReps).toEqual([12, 11, 10]);
  });

  it("keeps the load when a set was taken to failure", () => {
    const p = prescribeDoubleProgression({
      ...base,
      lastSessionSets: [set(20, 12), set(20, 12), set(20, 12, 0)],
    });
    expect(p.reason).toBe("keep_weight");
  });

  it("keeps the load when fewer sets than the target were completed", () => {
    const p = prescribeDoubleProgression({
      ...base,
      lastSessionSets: [set(20, 12), set(20, 12)],
    });
    expect(p.reason).toBe("keep_weight");
  });
});

describe("prescribeLinear", () => {
  const base = { targetSets: 4, repRangeMax: 6, incrementKg: 2.5 };

  it("adds 2.5 kg after completing the target sets and reps", () => {
    const p = prescribeLinear({
      ...base,
      lastSessionSets: [set(100, 6), set(100, 6), set(100, 6), set(100, 6)],
    });
    expect(p.reason).toBe("increase_weight");
    expect(p.weightKg).toBe(102.5);
  });

  it("keeps the load when reps fell short", () => {
    const p = prescribeLinear({
      ...base,
      lastSessionSets: [set(100, 6), set(100, 6), set(100, 5), set(100, 5)],
    });
    expect(p.reason).toBe("keep_weight");
    expect(p.weightKg).toBe(100);
  });
});

describe("helpers", () => {
  it("picks the heaviest sets as the working sets", () => {
    const w = workingSets([set(40, 10), set(60, 8), set(60, 7)]);
    expect(w?.weightKg).toBe(60);
    expect(w?.sets).toHaveLength(2);
    expect(workingSets([])).toBeNull();
  });

  it("recalculates a new cycle from a PR", () => {
    expect(startCycleValues("bilbo_cycle", 115)).toMatchObject({
      base1rmKg: 115,
      currentPrescribedWeightKg: 57.5,
      currentWeekOrSession: 1,
      status: "active",
    });
    expect(startCycleValues("heavy_blocks", 115).currentPrescribedWeightKg).toBe(87.5);
  });

  it("suggests the increment from the equipment", () => {
    expect(suggestIncrementStep("Curl con mancuernas")).toBe(1.25);
    expect(suggestIncrementStep("Extensión de tríceps en polea")).toBe(1.25);
    expect(suggestIncrementStep("Press militar")).toBe(2.5);
  });

  it("knows which types use cycles", () => {
    expect(usesCycles("bilbo_cycle")).toBe(true);
    expect(usesCycles("heavy_blocks")).toBe(true);
    expect(usesCycles("double_progression")).toBe(false);
    expect(usesCycles("linear_progression")).toBe(false);
  });
});
