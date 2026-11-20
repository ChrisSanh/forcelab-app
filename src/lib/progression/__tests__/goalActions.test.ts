import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceCycle,
  closeGoal,
  createGoal,
  defaultsFor,
  registerNewPr,
  updateGoal,
  validateGoal,
  type GoalFormValues,
} from "../goalActions";
import type { UserGoal } from "@/lib/types";

type Call = { table: string; op: string; payload?: unknown; filters: unknown[] };

interface FakeOptions {
  /** Error returned by an operation, keyed by "table.op". */
  errors?: Record<string, { message: string; details?: string | null }>;
  /** Row returned by `.single()` / `.maybeSingle()`, keyed by "table.op". */
  rows?: Record<string, unknown>;
}

/** Minimal in-memory stand-in for the Supabase query builder that records every call. */
function fakeSupabase({ errors = {}, rows = {} }: FakeOptions = {}) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      let op = "select";
      const call: Call = { table, op, filters: [] };
      calls.push(call);

      const builder: Record<string, unknown> = {};
      const result = () => {
        const key = `${table}.${call.op}`;
        return { data: rows[key] ?? null, error: errors[key] ?? null };
      };
      const chain = (name: string) => (...args: unknown[]) => {
        if (["insert", "update", "select"].includes(name)) {
          if (name !== "select" || call.op === "select") call.op = name === "select" ? call.op : name;
          if (name === "insert" || name === "update") call.payload = args[0];
        }
        if (["eq", "neq", "in", "order", "limit"].includes(name)) call.filters.push([name, ...args]);
        return builder;
      };
      for (const name of ["insert", "update", "select", "eq", "neq", "in", "order", "limit"]) {
        builder[name] = chain(name);
      }
      builder.single = () => Promise.resolve(result());
      builder.maybeSingle = () => Promise.resolve(result());
      // Awaiting the builder directly (updates / inserts without .single()) resolves to the result.
      builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      op = call.op;
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

const baseValues: GoalFormValues = {
  exerciseName: "Press de Banca Plano",
  muscleGroup: "chest",
  progressionType: "bilbo_cycle",
  currentPrKg: 110,
  targetPrKg: 150,
  targetSets: 1,
  repRangeMin: 15,
  repRangeMax: 30,
  incrementStepKg: 2.5,
};

const baseGoal: UserGoal = {
  id: "goal-1",
  user_id: "user-1",
  program_id: null,
  exercise_name: "Press de Banca Plano",
  muscle_group: "chest",
  progression_type: "bilbo_cycle",
  starting_pr_kg: 110,
  current_pr_kg: 110,
  target_pr_kg: 150,
  target_sets: 1,
  rep_range_min: 15,
  rep_range_max: 30,
  increment_step_kg: 2.5,
  is_active: true,
  created_at: "",
  updated_at: "",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("defaultsFor", () => {
  it("returns the Bilbo defaults", () => {
    expect(defaultsFor("bilbo_cycle")).toEqual({ targetSets: 1, repRangeMin: 15, repRangeMax: 30, incrementStepKg: 2.5 });
  });

  it("returns the heavy block defaults", () => {
    expect(defaultsFor("heavy_blocks")).toMatchObject({ targetSets: 4, repRangeMin: 2, repRangeMax: 4 });
  });

  it("returns the linear progression defaults", () => {
    expect(defaultsFor("linear_progression")).toMatchObject({ targetSets: 4, repRangeMin: 6, repRangeMax: 6 });
  });

  it("picks the 1.25 kg step for dumbbells and 2.5 kg for barbells in double progression", () => {
    expect(defaultsFor("double_progression", "Curl con mancuernas").incrementStepKg).toBe(1.25);
    expect(defaultsFor("double_progression", "Press militar").incrementStepKg).toBe(2.5);
    expect(defaultsFor("double_progression").incrementStepKg).toBe(2.5);
  });
});

describe("validateGoal", () => {
  it("returns null for a valid goal", () => {
    expect(validateGoal(baseValues)).toBeNull();
  });

  it("returns a Spanish message for an invalid goal", () => {
    expect(validateGoal({ ...baseValues, exerciseName: "" })).toBe("Este campo es obligatorio.");
    expect(validateGoal({ ...baseValues, targetPrKg: 100 })).toBe("La marca objetivo debe ser mayor que la actual.");
  });
});

describe("createGoal", () => {
  it("inserts the goal and opens cycle 1 for cycle-based progressions", async () => {
    const { client, calls } = fakeSupabase({ rows: { "user_goals.insert": { id: "new-goal" } } });
    const result = await createGoal(client, "user-1", "prog-1", baseValues);

    expect(result).toEqual({ ok: true });
    const goalInsert = calls.find((c) => c.table === "user_goals" && c.op === "insert");
    expect(goalInsert?.payload).toMatchObject({
      user_id: "user-1",
      program_id: "prog-1",
      exercise_name: "Press de Banca Plano",
      starting_pr_kg: 110,
      current_pr_kg: 110,
    });
    const cycleInsert = calls.find((c) => c.table === "exercise_cycles" && c.op === "insert");
    expect(cycleInsert?.payload).toMatchObject({
      goal_id: "new-goal",
      cycle_number: 1,
      base_1rm_kg: 110,
      current_prescribed_weight_kg: 55,
      status: "active",
    });
  });

  it("does not open a cycle for double progression", async () => {
    const { client, calls } = fakeSupabase({ rows: { "user_goals.insert": { id: "g" } } });
    const result = await createGoal(client, "user-1", null, {
      ...baseValues,
      progressionType: "double_progression",
      currentPrKg: null,
      targetPrKg: null,
    });
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
  });

  it.each(["double_progression", "linear_progression"] as const)(
    "does not open a cycle for %s even when a PR is provided",
    async (progressionType) => {
      const { client, calls } = fakeSupabase({ rows: { "user_goals.insert": { id: "g" } } });
      const result = await createGoal(client, "user-1", null, { ...baseValues, progressionType });
      expect(result).toEqual({ ok: true });
      expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
    },
  );

  it("trims the exercise name before saving", async () => {
    const { client, calls } = fakeSupabase({ rows: { "user_goals.insert": { id: "g" } } });
    await createGoal(client, "user-1", null, { ...baseValues, exerciseName: "  Remo T  " });
    const goalInsert = calls.find((c) => c.table === "user_goals" && c.op === "insert");
    expect((goalInsert?.payload as { exercise_name: string }).exercise_name).toBe("Remo T");
  });

  it("returns a Spanish error and skips the cycle when the goal insert fails", async () => {
    const { client, calls } = fakeSupabase({ errors: { "user_goals.insert": { message: "boom", details: "bad row" } } });
    const result = await createGoal(client, "user-1", null, baseValues);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe("No pudimos crear la meta. (boom — bad row)");
    expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
  });

  it("reports a failure when no row comes back", async () => {
    const { client } = fakeSupabase();
    const result = await createGoal(client, "user-1", null, baseValues);
    expect(result.ok).toBe(false);
  });

  it("reports an error when the cycle insert fails", async () => {
    const { client } = fakeSupabase({
      rows: { "user_goals.insert": { id: "g" } },
      errors: { "exercise_cycles.insert": { message: "cycle boom" } },
    });
    const result = await createGoal(client, "user-1", null, baseValues);
    expect(result.ok === false && result.message).toBe("No pudimos iniciar el ciclo. (cycle boom)");
  });
});

describe("updateGoal", () => {
  it("updates the editable fields but never the PRs", async () => {
    const { client, calls } = fakeSupabase();
    const result = await updateGoal(client, "goal-1", baseValues);
    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.table === "user_goals" && c.op === "update");
    const payload = update?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ target_pr_kg: 150, target_sets: 1 });
    expect(payload).not.toHaveProperty("current_pr_kg");
    expect(payload).not.toHaveProperty("starting_pr_kg");
  });

  it("returns a Spanish error on failure", async () => {
    const { client } = fakeSupabase({ errors: { "user_goals.update": { message: "nope" } } });
    const result = await updateGoal(client, "goal-1", baseValues);
    expect(result.ok === false && result.message).toBe("No pudimos guardar los cambios. (nope)");
  });
});

describe("closeGoal", () => {
  it("deactivates the goal and completes its open cycles", async () => {
    const { client, calls } = fakeSupabase();
    const result = await closeGoal(client, "goal-1");
    expect(result).toEqual({ ok: true });
    expect(calls.find((c) => c.table === "user_goals")?.payload).toMatchObject({ is_active: false });
    const cycles = calls.find((c) => c.table === "exercise_cycles");
    expect(cycles?.payload).toMatchObject({ status: "completed" });
    expect(cycles?.filters).toContainEqual(["neq", "status", "completed"]);
  });

  it("stops without touching cycles when the goal update fails", async () => {
    const { client, calls } = fakeSupabase({ errors: { "user_goals.update": { message: "denied" } } });
    const result = await closeGoal(client, "goal-1");
    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
  });
});

describe("registerNewPr", () => {
  it("rejects a PR that does not beat the current mark, without any database call", async () => {
    const { client, calls } = fakeSupabase();
    const result = await registerNewPr(client, "user-1", baseGoal, 110);
    expect(result.ok === false && result.message).toContain("110");
    expect(calls).toHaveLength(0);
  });

  it("rejects non-numeric and out-of-range PRs", async () => {
    const { client, calls } = fakeSupabase();
    expect((await registerNewPr(client, "user-1", baseGoal, Number.NaN)).ok).toBe(false);
    expect((await registerNewPr(client, "user-1", baseGoal, 9999)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("updates the PR, closes the open cycle and opens the next one recalculated", async () => {
    const { client, calls } = fakeSupabase({ rows: { "exercise_cycles.select": { cycle_number: 3 } } });
    const result = await registerNewPr(client, "user-1", baseGoal, 115);
    expect(result).toEqual({ ok: true });

    expect(calls.find((c) => c.table === "user_goals")?.payload).toMatchObject({ current_pr_kg: 115 });
    const closed = calls.find((c) => c.table === "exercise_cycles" && c.op === "update");
    expect(closed?.payload).toMatchObject({ status: "completed" });
    const opened = calls.find((c) => c.table === "exercise_cycles" && c.op === "insert");
    expect(opened?.payload).toMatchObject({
      cycle_number: 4,
      base_1rm_kg: 115,
      current_prescribed_weight_kg: 57.5,
      status: "active",
    });
  });

  it("starts at cycle 1 when there was no previous cycle", async () => {
    const { client, calls } = fakeSupabase();
    await registerNewPr(client, "user-1", baseGoal, 115);
    const opened = calls.find((c) => c.table === "exercise_cycles" && c.op === "insert");
    expect(opened?.payload).toMatchObject({ cycle_number: 1 });
  });

  it("starts heavy blocks at week 1 of the new base (77%)", async () => {
    const { client, calls } = fakeSupabase();
    await registerNewPr(client, "user-1", { ...baseGoal, progression_type: "heavy_blocks" }, 120);
    const opened = calls.find((c) => c.table === "exercise_cycles" && c.op === "insert");
    expect(opened?.payload).toMatchObject({ current_prescribed_weight_kg: 92.5 });
  });

  it("only updates the PR for goals that do not use cycles", async () => {
    const { client, calls } = fakeSupabase();
    const result = await registerNewPr(client, "user-1", { ...baseGoal, progression_type: "linear_progression" }, 115);
    expect(result).toEqual({ ok: true });
    expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
  });

  it("accepts a first PR when the goal has no current mark", async () => {
    const { client } = fakeSupabase();
    const result = await registerNewPr(client, "user-1", { ...baseGoal, current_pr_kg: null }, 100);
    expect(result).toEqual({ ok: true });
  });

  it("stops and reports when the PR update fails", async () => {
    const { client, calls } = fakeSupabase({ errors: { "user_goals.update": { message: "rls" } } });
    const result = await registerNewPr(client, "user-1", baseGoal, 115);
    expect(result.ok === false && result.message).toBe("No pudimos registrar el PR. (rls)");
    expect(calls.some((c) => c.table === "exercise_cycles")).toBe(false);
  });
});

describe("advanceCycle", () => {
  it("does nothing when the goal has no open cycle", async () => {
    const { client, calls } = fakeSupabase();
    await advanceCycle(client, "goal-1", "active", 60);
    expect(calls.filter((c) => c.op === "update")).toHaveLength(0);
  });

  it("increments the counter and stores the next prescribed weight", async () => {
    const { client, calls } = fakeSupabase({ rows: { "exercise_cycles.select": { id: "cyc-1", current_week_or_session: 2 } } });
    await advanceCycle(client, "goal-1", "active", 60);
    const update = calls.find((c) => c.op === "update");
    expect(update?.payload).toMatchObject({ current_week_or_session: 3, status: "active", current_prescribed_weight_kg: 60 });
    expect(update?.payload).not.toHaveProperty("completed_at");
    expect(update?.filters).toContainEqual(["eq", "id", "cyc-1"]);
  });

  it("does not overwrite the prescribed weight when none is given", async () => {
    const { client, calls } = fakeSupabase({ rows: { "exercise_cycles.select": { id: "cyc-1", current_week_or_session: 1 } } });
    await advanceCycle(client, "goal-1", "pr_test_ready", null);
    const payload = calls.find((c) => c.op === "update")?.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("current_prescribed_weight_kg");
    expect(payload.status).toBe("pr_test_ready");
  });

  it("stamps completed_at when the cycle completes", async () => {
    const { client, calls } = fakeSupabase({ rows: { "exercise_cycles.select": { id: "cyc-1", current_week_or_session: 4 } } });
    await advanceCycle(client, "goal-1", "completed", null);
    expect(calls.find((c) => c.op === "update")?.payload).toHaveProperty("completed_at");
  });
});
