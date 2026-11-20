/**
 * Input validation (OWASP A03 - Injection, A04 - Insecure Design).
 *
 * Every value that comes from a user is parsed here before it reaches Supabase.
 * Limits mirror the database: `numeric(5,2)` columns hold at most 999.99 and the
 * CHECK constraints (rir 0-5, enums) are repeated so the user gets a Spanish
 * message instead of a Postgres error. Error messages are user-facing (Spanish).
 */

import { z } from "zod";

/** `numeric(5,2)` upper bound used by every kg column. */
export const MAX_KG = 999.99;
/** Realistic ceiling for a single lift; guards against typos like 1100 instead of 110. */
export const MAX_LIFT_KG = 600;

const trimmed = (max: number) => z.string().trim().min(1, "Este campo es obligatorio.").max(max, `Máximo ${max} caracteres.`);

/** Plain exercise / program names: letters, digits, spaces and a few separators. No markup. */
const NAME_PATTERN = /^[\p{L}\p{N} .,'()/+\-]+$/u;

export const exerciseNameSchema = trimmed(80).regex(
  NAME_PATTERN,
  "El nombre solo puede tener letras, números y signos simples.",
);

/** Accepts a number or a numeric string with a comma or dot decimal separator. */
function numberFrom(value: unknown): unknown {
  if (typeof value === "string") {
    const cleaned = value.trim().replace(",", ".");
    return cleaned === "" ? undefined : Number(cleaned);
  }
  return value;
}

const kg = (label: string, max = MAX_LIFT_KG) =>
  z.preprocess(
    numberFrom,
    z
      .number({ error: `${label} debe ser un número.` })
      .finite(`${label} debe ser un número.`)
      .positive(`${label} debe ser mayor que 0.`)
      .max(max, `${label} no puede superar ${max} kg.`)
      .multipleOf(0.01, `${label} admite como máximo 2 decimales.`),
  );

const intIn = (label: string, min: number, max: number) =>
  z.preprocess(
    numberFrom,
    z
      .number({ error: `${label} debe ser un número.` })
      .int(`${label} debe ser un número entero.`)
      .min(min, `${label} debe ser al menos ${min}.`)
      .max(max, `${label} no puede superar ${max}.`),
  );

// ---------------------------------------------------------------------------
// Enums (kept in sync with the CHECK constraints)
// ---------------------------------------------------------------------------

export const muscleGroupSchema = z.enum(["chest", "back", "legs", "shoulders", "arms"], {
  error: "Grupo muscular no válido.",
});

export const progressionTypeSchema = z.enum(
  ["bilbo_cycle", "heavy_blocks", "double_progression", "linear_progression"],
  { error: "Tipo de progresión no válido." },
);

export const setCategorySchema = z.enum(["explosive_bilbo", "heavy_strength", "hypertrophy", "warmup"], {
  error: "Categoría de serie no válida.",
});

export const barSpeedSchema = z.enum(["explosive", "fast", "moderate", "grind"], {
  error: "Velocidad no válida.",
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Fecha no válida.");

export const profileSchema = z.object({
  bodyweightKg: kg("El peso corporal", 300).refine((v) => (v as number) >= 30, "El peso corporal debe ser de al menos 30 kg."),
  trainingStartDate: isoDate.refine(
    (s) => Date.parse(`${s}T00:00:00Z`) <= Date.now(),
    "La fecha de inicio no puede estar en el futuro.",
  ),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Onboarding (profile + first program PRs)
// ---------------------------------------------------------------------------

export const onboardingSchema = profileSchema
  .extend({
    currentPrKg: kg("Tu PR actual"),
    targetPrKg: kg("Tu PR objetivo"),
    methodologyId: z.string().uuid("Elige una metodología."),
  })
  .refine((v) => (v.targetPrKg as number) > (v.currentPrKg as number), {
    message: "Tu PR objetivo debe ser mayor que tu PR actual.",
    path: ["targetPrKg"],
  });
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// ---------------------------------------------------------------------------
// Goals (user_goals)
// ---------------------------------------------------------------------------

export const goalSchema = z
  .object({
    exerciseName: exerciseNameSchema,
    muscleGroup: muscleGroupSchema,
    progressionType: progressionTypeSchema,
    currentPrKg: kg("La marca actual").nullable().optional(),
    targetPrKg: kg("La marca objetivo").nullable().optional(),
    targetSets: intIn("Las series", 1, 10),
    repRangeMin: intIn("Las repeticiones mínimas", 1, 50),
    repRangeMax: intIn("Las repeticiones máximas", 1, 50),
    incrementStepKg: z.preprocess(
      numberFrom,
      z
        .number({ error: "El incremento debe ser un número." })
        .positive("El incremento debe ser mayor que 0.")
        .max(20, "El incremento no puede superar 20 kg.")
        .multipleOf(0.25, "El incremento debe ser múltiplo de 0,25 kg."),
    ),
  })
  .superRefine((v, ctx) => {
    if ((v.repRangeMax as number) < (v.repRangeMin as number)) {
      ctx.addIssue({
        code: "custom",
        path: ["repRangeMax"],
        message: "Las repeticiones máximas no pueden ser menores que las mínimas.",
      });
    }
    const cycleBased = v.progressionType === "bilbo_cycle" || v.progressionType === "heavy_blocks";
    if (cycleBased && v.currentPrKg == null) {
      ctx.addIssue({ code: "custom", path: ["currentPrKg"], message: "Ingresa tu marca actual (1RM) en kg." });
    }
    if (v.currentPrKg != null && v.targetPrKg != null && (v.targetPrKg as number) <= (v.currentPrKg as number)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetPrKg"],
        message: "La marca objetivo debe ser mayor que la actual.",
      });
    }
  });
export type GoalInput = z.infer<typeof goalSchema>;

/** Official PR registration: it must beat the current mark. */
export function newPrSchema(currentPrKg: number) {
  return z.object({
    newPrKg: kg("El nuevo PR").refine(
      (v) => (v as number) > currentPrKg,
      `El nuevo PR debe superar tu marca actual (${currentPrKg} kg).`,
    ),
  });
}

// ---------------------------------------------------------------------------
// Set logs (set_logs)
// ---------------------------------------------------------------------------

export const setLogSchema = z.object({
  exerciseName: exerciseNameSchema,
  setCategory: setCategorySchema,
  setNumber: intIn("El número de serie", 1, 50),
  weightKg: kg("El peso"),
  reps: intIn("Las repeticiones", 1, 100),
  rir: z.preprocess(numberFrom, z.number().int("El RIR debe ser un número entero.").min(0, "El RIR mínimo es 0.").max(5, "El RIR máximo es 5.")).nullable().optional(),
  barSpeed: barSpeedSchema.nullable().optional(),
  calculatedE1rm: kg("El e1RM", MAX_KG).nullable().optional(),
});
export type SetLogInput = z.infer<typeof setLogSchema>;

/** Draft typed in the logger (strings straight from the inputs). */
export const setDraftSchema = z.object({
  weightKg: kg("El peso"),
  reps: intIn("Las repeticiones", 1, 100),
});

/** Returns the first Spanish error message of a failed parse, or null when valid. */
export function firstError(result: { success: boolean; error?: z.ZodError }): string | null {
  if (result.success) return null;
  return result.error?.issues[0]?.message ?? "Datos no válidos.";
}
