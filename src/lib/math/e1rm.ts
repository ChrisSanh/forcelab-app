/**
 * Hybrid estimated 1RM (e1RM) calculator.
 *
 * Segment 1 (1..10 effective reps): Brzycki (1993) adjusted by RIR.
 *   e1RM = weight / (1.0278 - 0.0278 * (reps + rir))
 *
 * Segment 2 (> 10 effective reps): the Brzycki value at the 10-rep boundary,
 * extended with a logarithmic dampening term. Linear equations overestimate
 * the true 1RM beyond 12-15 reps because of local metabolic endurance, and
 * Brzycki's denominator even diverges near 37 reps. The logarithmic term grows
 * far slower and keeps the curve continuous at 10 reps:
 *   e1RM = brzycki(weight, 10) * (1 + HIGH_REP_GAIN * ln(effective / 10))
 *
 * NOTE: HIGH_REP_GAIN is a calibration constant. CLAUDE.md and the report only
 * name the concept ("high-rep dampening"); tune it against real 1RM tests.
 */

const BRZYCKI_INTERCEPT = 1.0278;
const BRZYCKI_SLOPE = 0.0278;
const SEGMENT_LIMIT = 10;
const MAX_EFFECTIVE_REPS = 30;
/** Slope of the logarithmic dampening term (calibration constant). */
const HIGH_REP_GAIN = 0.35;

export const RIR_MIN = 0;
export const RIR_MAX = 5;

export interface E1rmInput {
  /** Load lifted, in kilograms. */
  weightKg: number;
  /** Repetitions completed. */
  reps: number;
  /** Repetitions in reserve (0-5). Defaults to 0 (failure). */
  rir?: number;
}

export function brzycki(weightKg: number, effectiveReps: number): number {
  return weightKg / (BRZYCKI_INTERCEPT - BRZYCKI_SLOPE * effectiveReps);
}

/** Returns the hybrid e1RM in kg rounded to 0.1, or null when inputs are invalid. */
export function calculateE1rm({ weightKg, reps, rir = 0 }: E1rmInput): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || !Number.isFinite(rir)) return null;
  if (weightKg <= 0 || reps < 1) return null;

  const safeRir = Math.min(Math.max(rir, RIR_MIN), RIR_MAX);
  const effective = Math.min(reps + safeRir, MAX_EFFECTIVE_REPS);

  let result: number;
  if (effective <= SEGMENT_LIMIT) {
    result = brzycki(weightKg, effective);
  } else {
    const atLimit = brzycki(weightKg, SEGMENT_LIMIT);
    result = atLimit * (1 + HIGH_REP_GAIN * Math.log(effective / SEGMENT_LIMIT));
  }
  return Math.round(result * 10) / 10;
}

/** Load (kg) to use for a target number of reps at a given e1RM, rounded to 2.5 kg plates. */
export function loadForPercent(e1rmKg: number, percent: number, step = 2.5): number {
  return Math.round((e1rmKg * percent) / step) * step;
}
