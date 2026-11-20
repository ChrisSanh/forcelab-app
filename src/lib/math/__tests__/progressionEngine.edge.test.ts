import { describe, expect, it } from "vitest";
import {
  BILBO_MIN_REPS,
  HEAVY_BLOCK_WEEKS,
  prescribeBilbo,
  prescribeDoubleProgression,
  prescribeHeavyBlock,
  prescribeLinear,
  roundTo2_5,
  startCycleValues,
  suggestIncrementStep,
  workingSets,
  type LoggedSet,
} from "../progressionEngine";

const set = (weightKg: number, reps: number, rir: number | null = 2): LoggedSet => ({ weightKg, reps, rir });

describe("roundTo2_5 edge cases", () => {
  it("rounds exact halves up", () => {
    expect(roundTo2_5(1.25)).toBe(2.5);
    expect(roundTo2_5(3.75)).toBe(5);
  });

  it("returns 0 for infinity", () => {
    expect(roundTo2_5(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("bilbo_cycle - boundaries", () => {
  const base = { currentPrKg: 110, cycleActive: true };

  it("treats exactly 15 reps with RIR 1 as a valid progression (reps >= 15)", () => {
    const p = prescribeBilbo({ ...base, lastSet: set(60, 15, 1) });
    expect(p.reason).toBe("progress");
    expect(p.weightKg).toBe(62.5);
  });

  it("ends the cycle at 14 reps, even with plenty of RIR", () => {
    const p = prescribeBilbo({ ...base, lastSet: set(90, 14, 5) });
    expect(p.status).toBe("pr_test_ready");
    expect(p.reason).toBe("cycle_end");
  });

  it("ends the cycle at 1 rep", () => {
    expect(prescribeBilbo({ ...base, lastSet: set(100, 1, 0) }).status).toBe("pr_test_ready");
  });

  it("does not add load when 15+ reps came with RIR 0", () => {
    const p = prescribeBilbo({ ...base, lastSet: set(60, 15, 0) });
    expect(p.reason).toBe("hold");
    expect(p.weightKg).toBe(60);
    expect(p.repsToBeat).toBe(15);
  });

  it("shows the previous rep count as the mark to beat", () => {
    expect(prescribeBilbo({ ...base, lastSet: set(57.5, 24, 2) }).repsToBeat).toBe(24);
  });

  it("starts the cycle when no PR can produce a load", () => {
    const p = prescribeBilbo({ currentPrKg: 0, cycleActive: false, lastSet: null });
    expect(p.weightKg).toBeNull();
    expect(p.reason).toBe("cycle_start");
  });

  it("numbers the session from the completed count", () => {
    const p = prescribeBilbo({ ...base, lastSet: set(60, 20, 2), completedSessions: 4 });
    expect(p.sequence).toBe(5);
  });

  it("exposes the 15-rep threshold", () => {
    expect(BILBO_MIN_REPS).toBe(15);
  });
});

describe("heavy_blocks - 4 week wave", () => {
  it.each([
    [0, 0.77, "4x4", 85],
    [1, 0.8, "5x3", 87.5],
    [2, 0.83, "4x2", 92.5],
    [3, 0.7, "3x3", 77.5],
  ])("session %i uses %f (%s) -> %f kg on a 110 kg base", (done, percent, scheme, weight) => {
    const p = prescribeHeavyBlock({ base1rmKg: 110, completedSessions: done });
    expect(p.percent).toBe(percent);
    expect(`${p.sets}x${p.repsMin}`).toBe(scheme);
    expect(p.weightKg).toBe(weight);
  });

  it("exposes exactly four weeks and flags only week 4 as deload", () => {
    expect(HEAVY_BLOCK_WEEKS).toHaveLength(4);
    expect(HEAVY_BLOCK_WEEKS.filter((w) => w.isDeload).map((w) => w.week)).toEqual([4]);
  });

  it("floors fractional completed-session counts", () => {
    expect(prescribeHeavyBlock({ base1rmKg: 110, completedSessions: 1.9 }).sequence).toBe(2);
  });

  it("treats a negative count as the first week", () => {
    expect(prescribeHeavyBlock({ base1rmKg: 110, completedSessions: -3 }).sequence).toBe(1);
  });

  it("completes the block after week 4", () => {
    const p = prescribeHeavyBlock({ base1rmKg: 110, completedSessions: 7 });
    expect(p.reason).toBe("block_complete");
    expect(p.status).toBe("completed");
  });

  it("returns a null weight when the base 1RM is invalid", () => {
    expect(prescribeHeavyBlock({ base1rmKg: 0, completedSessions: 0 }).weightKg).toBeNull();
  });
});

describe("double_progression - boundaries", () => {
  const base = { targetSets: 3, repRangeMin: 10, repRangeMax: 12, incrementKg: 2.5 };

  it("progresses with every set exactly at the top of the range", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 12, 1), set(40, 12, 1), set(40, 12, 1)] });
    expect(p.reason).toBe("increase_weight");
    expect(p.weightKg).toBe(42.5);
    expect(p.repsToBeat).toBe(10);
  });

  it("progresses when sets exceed the top of the range", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 14), set(40, 13), set(40, 12)] });
    expect(p.reason).toBe("increase_weight");
  });

  it("does not progress when the last set is one rep short", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 12), set(40, 12), set(40, 11)] });
    expect(p.reason).toBe("keep_weight");
    expect(p.previousReps).toEqual([12, 12, 11]);
  });

  it("needs RIR >= 1 on every set", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 12, 1), set(40, 12, 1), set(40, 12, 0)] });
    expect(p.reason).toBe("keep_weight");
  });

  it("treats a missing RIR as 0 (no progression)", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 12, null), set(40, 12, null), set(40, 12, null)] });
    expect(p.reason).toBe("keep_weight");
  });

  it("only evaluates the heaviest working sets, ignoring lighter warm-ups", () => {
    const p = prescribeDoubleProgression({
      ...base,
      lastSessionSets: [set(20, 15), set(40, 12), set(40, 12), set(40, 12)],
    });
    expect(p.reason).toBe("increase_weight");
    expect(p.lastWeightKg).toBe(40);
  });

  it("needs at least the target number of working sets", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [set(40, 12), set(40, 12)] });
    expect(p.reason).toBe("keep_weight");
  });

  it("supports the 1.25 kg dumbbell step", () => {
    const p = prescribeDoubleProgression({
      ...base,
      incrementKg: 1.25,
      lastSessionSets: [set(18.75, 12), set(18.75, 12), set(18.75, 12)],
    });
    expect(p.weightKg).toBe(20);
  });

  it("asks for a starting weight on the first session", () => {
    const p = prescribeDoubleProgression({ ...base, lastSessionSets: [] });
    expect(p.reason).toBe("first_session");
    expect(p.sets).toBe(3);
    expect(p.repsMin).toBe(10);
    expect(p.repsMax).toBe(12);
  });
});

describe("linear_progression - boundaries", () => {
  const base = { targetSets: 4, repRangeMax: 6 };

  it("adds 2.5 kg by default after completing target sets x reps", () => {
    const p = prescribeLinear({ ...base, lastSessionSets: [set(100, 6), set(100, 6), set(100, 6), set(100, 6)] });
    expect(p.weightKg).toBe(102.5);
  });

  it("honors a custom increment", () => {
    const p = prescribeLinear({ ...base, incrementKg: 5, lastSessionSets: [set(100, 6), set(100, 6), set(100, 6), set(100, 6)] });
    expect(p.weightKg).toBe(105);
  });

  it("does not add load with one set short of the target reps", () => {
    const p = prescribeLinear({ ...base, lastSessionSets: [set(100, 6), set(100, 6), set(100, 6), set(100, 5)] });
    expect(p.reason).toBe("keep_weight");
    expect(p.previousReps).toEqual([6, 6, 6, 5]);
  });

  it("does not add load when fewer sets than the target were done", () => {
    const p = prescribeLinear({ ...base, lastSessionSets: [set(100, 6), set(100, 6)] });
    expect(p.reason).toBe("keep_weight");
  });

  it("asks for a starting weight on the first session", () => {
    const p = prescribeLinear({ ...base, lastSessionSets: [] });
    expect(p.reason).toBe("first_session");
    expect(p.weightKg).toBeNull();
  });
});

describe("startCycleValues", () => {
  it("starts heavy blocks at week 1 (77%)", () => {
    expect(startCycleValues("heavy_blocks", 110).currentPrescribedWeightKg).toBe(85);
  });

  it("starts Bilbo at 50%", () => {
    expect(startCycleValues("bilbo_cycle", 110).currentPrescribedWeightKg).toBe(55);
  });

  it("recalculates from a new PR", () => {
    expect(startCycleValues("bilbo_cycle", 115).currentPrescribedWeightKg).toBe(57.5);
  });
});

describe("helpers", () => {
  it("returns null working sets for an empty session", () => {
    expect(workingSets([])).toBeNull();
  });

  it("detects dumbbell and cable movements regardless of accents or case", () => {
    expect(suggestIncrementStep("PRESS CON MANCUERNAS")).toBe(1.25);
    expect(suggestIncrementStep("Jalón en Polea")).toBe(1.25);
    expect(suggestIncrementStep("Dumbbell Curl")).toBe(1.25);
    expect(suggestIncrementStep("Sentadilla Hack")).toBe(2.5);
  });
});
