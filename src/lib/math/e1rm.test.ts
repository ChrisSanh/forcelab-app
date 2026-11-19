import { describe, expect, it } from "vitest";
import { brzycki, calculateE1rm, loadForPercent } from "./e1rm";

describe("calculateE1rm", () => {
  it("returns the load itself for a single rep at RIR 0", () => {
    expect(calculateE1rm({ weightKg: 100, reps: 1, rir: 0 })).toBe(100);
  });

  it("matches Brzycki in the 1-10 effective rep range", () => {
    // 100 kg x 5 reps, RIR 0 -> 100 / (1.0278 - 0.139) = 112.5
    expect(calculateE1rm({ weightKg: 100, reps: 5, rir: 0 })).toBe(112.5);
    // 80 kg x 4 reps, RIR 2 -> effective 6 -> 80 / 0.861 = 92.9
    expect(calculateE1rm({ weightKg: 80, reps: 4, rir: 2 })).toBe(92.9);
  });

  it("treats RIR as extra effective repetitions", () => {
    const failure = calculateE1rm({ weightKg: 90, reps: 5, rir: 0 })!;
    const reserve = calculateE1rm({ weightKg: 90, reps: 5, rir: 2 })!;
    expect(reserve).toBeGreaterThan(failure);
  });

  it("is continuous at the 10-rep boundary", () => {
    const at10 = calculateE1rm({ weightKg: 60, reps: 10, rir: 0 })!;
    const at11 = calculateE1rm({ weightKg: 60, reps: 11, rir: 0 })!;
    expect(at11 - at10).toBeGreaterThanOrEqual(0);
    expect(at11 - at10).toBeLessThan(3);
  });

  it("dampens high-rep sets versus raw Brzycki", () => {
    const raw = brzycki(55, 20);
    const hybrid = calculateE1rm({ weightKg: 55, reps: 20, rir: 0 })!;
    expect(hybrid).toBeLessThan(raw);
  });

  it("stays monotonic as reps increase", () => {
    let prev = 0;
    for (let reps = 1; reps <= 30; reps++) {
      const v = calculateE1rm({ weightKg: 50, reps, rir: 0 })!;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("returns null for invalid inputs", () => {
    expect(calculateE1rm({ weightKg: 0, reps: 5 })).toBeNull();
    expect(calculateE1rm({ weightKg: 100, reps: 0 })).toBeNull();
    expect(calculateE1rm({ weightKg: Number.NaN, reps: 5 })).toBeNull();
  });
});

describe("loadForPercent", () => {
  it("rounds to 2.5 kg plates", () => {
    expect(loadForPercent(110, 0.5)).toBe(55);
    expect(loadForPercent(110, 0.77)).toBe(85);
  });
});
