import { describe, expect, it } from "vitest";
import { RIR_MAX, RIR_MIN, brzycki, calculateE1rm, loadForPercent } from "../e1rm";

describe("calculateE1rm - Brzycki segment (effective reps <= 10)", () => {
  it("returns the load for 1 rep at RIR 0", () => {
    expect(calculateE1rm({ weightKg: 140, reps: 1 })).toBe(140);
  });

  it("defaults RIR to 0 when omitted", () => {
    expect(calculateE1rm({ weightKg: 100, reps: 5 })).toBe(calculateE1rm({ weightKg: 100, reps: 5, rir: 0 }));
  });

  it("matches the raw Brzycki formula exactly at every rep count from 1 to 10", () => {
    for (let reps = 1; reps <= 10; reps++) {
      const expected = Math.round(brzycki(100, reps) * 10) / 10;
      expect(calculateE1rm({ weightKg: 100, reps, rir: 0 })).toBe(expected);
    }
  });

  it("uses reps + RIR as the effective rep count", () => {
    expect(calculateE1rm({ weightKg: 80, reps: 3, rir: 2 })).toBe(calculateE1rm({ weightKg: 80, reps: 5, rir: 0 }));
  });

  it("rounds to one decimal", () => {
    const v = calculateE1rm({ weightKg: 77.5, reps: 7, rir: 1 })!;
    expect(Math.round(v * 10) / 10).toBe(v);
  });

  it("is strictly increasing in weight", () => {
    const a = calculateE1rm({ weightKg: 60, reps: 8 })!;
    const b = calculateE1rm({ weightKg: 62.5, reps: 8 })!;
    expect(b).toBeGreaterThan(a);
  });
});

describe("calculateE1rm - high-rep segment (effective reps > 10)", () => {
  it("is continuous across the 10 / 11 rep boundary: the step does not grow after 10", () => {
    const e = (reps: number) => calculateE1rm({ weightKg: 60, reps })!;
    const stepBefore = e(10) - e(9);
    const stepAfter = e(11) - e(10);
    expect(stepAfter).toBeGreaterThan(0);
    // Dampening means each extra rep adds less than the one before it.
    expect(stepAfter).toBeLessThanOrEqual(stepBefore);
  });

  it("adds a smaller and smaller increment per rep beyond 10", () => {
    const e = (reps: number) => calculateE1rm({ weightKg: 60, reps })!;
    let previousStep = e(11) - e(10);
    for (let reps = 12; reps <= 30; reps++) {
      const step = e(reps) - e(reps - 1);
      // Each value is rounded to 0.1 kg, so consecutive steps can differ by up to 0.2 kg of pure rounding.
      expect(step).toBeLessThanOrEqual(previousStep + 0.2);
      previousStep = step;
    }
  });

  it("combines reps and RIR when crossing the boundary", () => {
    // 8 reps + 4 RIR = 12 effective reps, same as 12 reps at RIR 0.
    expect(calculateE1rm({ weightKg: 70, reps: 8, rir: 4 })).toBe(calculateE1rm({ weightKg: 70, reps: 12, rir: 0 }));
  });

  it("stays below the raw Brzycki estimate (dampening)", () => {
    for (const reps of [12, 15, 20, 25, 30]) {
      expect(calculateE1rm({ weightKg: 50, reps })!).toBeLessThan(brzycki(50, reps));
    }
  });

  it("never diverges: Brzycki's denominator would blow up near 37 effective reps", () => {
    const v = calculateE1rm({ weightKg: 40, reps: 36, rir: 0 });
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeLessThan(200);
  });

  it("caps effective reps at 30 so extreme inputs give the same result", () => {
    expect(calculateE1rm({ weightKg: 40, reps: 30 })).toBe(calculateE1rm({ weightKg: 40, reps: 80 }));
  });
});

describe("calculateE1rm - RIR clamping", () => {
  it("exports the accepted RIR range", () => {
    expect(RIR_MIN).toBe(0);
    expect(RIR_MAX).toBe(5);
  });

  it("clamps a RIR above the maximum to 5", () => {
    expect(calculateE1rm({ weightKg: 100, reps: 3, rir: 99 })).toBe(calculateE1rm({ weightKg: 100, reps: 3, rir: 5 }));
  });

  it("clamps a negative RIR to 0", () => {
    expect(calculateE1rm({ weightKg: 100, reps: 3, rir: -4 })).toBe(calculateE1rm({ weightKg: 100, reps: 3, rir: 0 }));
  });
});

describe("calculateE1rm - invalid input", () => {
  it.each([
    ["zero weight", { weightKg: 0, reps: 5 }],
    ["negative weight", { weightKg: -20, reps: 5 }],
    ["zero reps", { weightKg: 100, reps: 0 }],
    ["fractional reps below 1", { weightKg: 100, reps: 0.5 }],
    ["NaN weight", { weightKg: Number.NaN, reps: 5 }],
    ["NaN reps", { weightKg: 100, reps: Number.NaN }],
    ["NaN rir", { weightKg: 100, reps: 5, rir: Number.NaN }],
    ["infinite weight", { weightKg: Number.POSITIVE_INFINITY, reps: 5 }],
  ])("returns null for %s", (_label, input) => {
    expect(calculateE1rm(input)).toBeNull();
  });
});

describe("loadForPercent", () => {
  it("rounds to the nearest plate step", () => {
    expect(loadForPercent(110, 0.77)).toBe(85);
    expect(loadForPercent(110, 0.8)).toBe(87.5);
    expect(loadForPercent(110, 0.83)).toBe(92.5);
    expect(loadForPercent(110, 0.7)).toBe(77.5);
  });

  it("supports a custom step", () => {
    expect(loadForPercent(100, 0.5, 1.25)).toBe(50);
    expect(loadForPercent(101, 0.5, 1.25)).toBe(50);
  });
});
