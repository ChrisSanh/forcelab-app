import { describe, expect, it } from "vitest";
import { buildMilestones, buildSeries, exerciseOptions, hypertrophyLevel, type SetPoint } from "./analytics";

const row = (workout: string, name: string, kg: number, reps: number, e1rm: number | null, day: string): SetPoint => ({
  workout_id: workout,
  exercise_name: name,
  weight_kg: kg,
  reps,
  calculated_e1rm: e1rm,
  created_at: `${day}T10:00:00Z`,
});

describe("buildSeries", () => {
  const sets = [
    row("w1", "Press de banca (Bilbo)", 55, 20, 90, "2026-11-01"),
    row("w2", "Press de banca (pesado)", 85, 4, 96, "2026-11-04"),
    row("w2", "Press de banca (pesado)", 85, 4, 98, "2026-11-04"),
    row("w3", "Dominadas", 0, 8, null, "2026-11-05"),
  ];

  it("groups by session and keeps the best e1RM and the tonnage", () => {
    const series = buildSeries(sets, "Press de Banca Plano");
    expect(series).toEqual([
      { date: "2026-11-01", e1rm: 90, tonnage: 1100 },
      { date: "2026-11-04", e1rm: 98, tonnage: 680 },
    ]);
  });

  it("returns an empty series for an unknown exercise", () => {
    expect(buildSeries(sets, "Peso muerto")).toEqual([]);
  });
});

describe("exerciseOptions", () => {
  it("orders exercises by number of logged sets", () => {
    const sets = [
      row("w1", "Remo T", 40, 10, null, "2026-11-01"),
      row("w1", "Press militar", 30, 8, null, "2026-11-01"),
      row("w2", "Remo T", 40, 10, null, "2026-11-02"),
    ];
    expect(exerciseOptions(sets)).toEqual(["Remo T", "Press militar"]);
  });
});

describe("buildMilestones", () => {
  it("creates a milestone every 5 kg up to the target", () => {
    const m = buildMilestones(110, 125, 118);
    expect(m.map((x) => x.value)).toEqual([115, 120, 125]);
    expect(m.map((x) => x.reached)).toEqual([true, false, false]);
  });

  it("returns nothing when the target is not above the start", () => {
    expect(buildMilestones(110, 110, 110)).toEqual([]);
  });
});

describe("hypertrophyLevel", () => {
  it("maps the average reps onto the rep range", () => {
    expect(hypertrophyLevel([10, 10, 10], 10, 12)).toBe(0);
    expect(hypertrophyLevel([11, 11, 11], 10, 12)).toBe(50);
    expect(hypertrophyLevel([12, 12, 12], 10, 12)).toBe(100);
    expect(hypertrophyLevel([], 10, 12)).toBe(0);
  });
});
