/**
 * Pre-configured UP-X-P-P-L hybrid split:
 * Upper, Lower, Rest, Push 1 (explosive / Bilbo), Push 2 (heavy strength), Pull, Leg.
 *
 * Code identifiers are English; user-facing labels are Spanish.
 */

export type DayType = "upper" | "lower" | "rest" | "push_bilbo" | "push_heavy" | "pull" | "leg";

export interface PresetSet {
  /** Number of working sets. */
  sets: number;
  /** Target rep range as text, e.g. "8-12" or "AMRAP". */
  reps: string;
  /** Target reps in reserve. */
  targetRir?: number;
  /** Intensity as a fraction of the 1RM, when prescribed that way. */
  percent1rm?: number;
}

export interface PresetExercise {
  name: string;
  /** Spanish display label. */
  label: string;
  /** Main lift drives progression off the user's bench PR. */
  isMainLift?: boolean;
  scheme: PresetSet;
  notes?: string;
}

export interface PresetDay {
  /** Stable key used in the URL: /workout/[day]. */
  key: string;
  order: number;
  type: DayType;
  /** Spanish display label. */
  label: string;
  /** Spanish short description. */
  focus: string;
  exercises: PresetExercise[];
}

export interface SplitPreset {
  slug: string;
  name: string;
  description: string;
  days: PresetDay[];
}

export const DEFAULT_SPLIT: SplitPreset = {
  slug: "up-x-p-p-l",
  name: "UP-X-P-P-L Híbrido",
  description:
    "Upper, Lower, Descanso, Push 1 Explosivo (Bilbo), Push 2 Fuerza Pesada, Pull y Leg.",
  days: [
    {
      key: "upper",
      order: 1,
      type: "upper",
      label: "Upper",
      focus: "Tren superior general",
      exercises: [
        { name: "Incline Dumbbell Press", label: "Press inclinado con mancuernas", scheme: { sets: 3, reps: "8-12", targetRir: 2 } },
        { name: "Chest-Supported Row", label: "Remo con apoyo en pecho", scheme: { sets: 3, reps: "8-12", targetRir: 2 } },
        { name: "Overhead Press", label: "Press militar", scheme: { sets: 3, reps: "6-10", targetRir: 2 } },
        { name: "Lat Pulldown", label: "Jalón al pecho", scheme: { sets: 3, reps: "8-12", targetRir: 2 } },
        { name: "Cable Lateral Raise", label: "Elevaciones laterales en polea", scheme: { sets: 3, reps: "12-15", targetRir: 1 } },
      ],
    },
    {
      key: "lower",
      order: 2,
      type: "lower",
      label: "Lower",
      focus: "Tren inferior",
      exercises: [
        { name: "Back Squat", label: "Sentadilla trasera", scheme: { sets: 4, reps: "6-8", targetRir: 2 } },
        { name: "Romanian Deadlift", label: "Peso muerto rumano", scheme: { sets: 3, reps: "8-10", targetRir: 2 } },
        { name: "Leg Press", label: "Prensa de piernas", scheme: { sets: 3, reps: "10-12", targetRir: 1 } },
        { name: "Standing Calf Raise", label: "Elevación de talones de pie", scheme: { sets: 4, reps: "10-15", targetRir: 1 } },
      ],
    },
    {
      key: "rest",
      order: 3,
      type: "rest",
      label: "Descanso",
      focus: "Recuperación activa y sueño",
      exercises: [],
    },
    {
      key: "push-1",
      order: 4,
      type: "push_bilbo",
      label: "Push 1 · Explosivo (Bilbo)",
      focus: "Serie única explosiva al 50% del 1RM, +2,5 kg por sesión hasta bajar de 15 reps",
      exercises: [
        {
          name: "Bench Press (Bilbo)",
          label: "Press de banca (Bilbo)",
          isMainLift: true,
          scheme: { sets: 1, reps: "15+", targetRir: 2, percent1rm: 0.5 },
          notes: "Máxima velocidad concéntrica. Sube 2,5 kg cada sesión hasta que no llegues a 15 reps.",
        },
        { name: "Dip", label: "Fondos", scheme: { sets: 3, reps: "8-12", targetRir: 2 } },
        { name: "Triceps Pushdown", label: "Extensión de tríceps en polea", scheme: { sets: 3, reps: "10-15", targetRir: 1 } },
      ],
    },
    {
      key: "push-2",
      order: 5,
      type: "push_heavy",
      label: "Push 2 · Fuerza Pesada",
      focus: "Bloque ondulado 77% → 80% → 83% → 70% (descarga)",
      exercises: [
        {
          name: "Bench Press (Heavy)",
          label: "Press de banca (pesado)",
          isMainLift: true,
          scheme: { sets: 4, reps: "2-4", targetRir: 2, percent1rm: 0.77 },
          notes: "Semana 1: 77%, semana 2: 80%, semana 3: 83%, semana 4: 70% descarga.",
        },
        { name: "Incline Dumbbell Press", label: "Press inclinado con mancuernas", scheme: { sets: 3, reps: "6-10", targetRir: 2 } },
        { name: "Lateral Raise", label: "Elevaciones laterales", scheme: { sets: 3, reps: "12-15", targetRir: 1 } },
      ],
    },
    {
      key: "pull",
      order: 6,
      type: "pull",
      label: "Pull",
      focus: "Espalda y bíceps",
      exercises: [
        { name: "Barbell Row", label: "Remo con barra", scheme: { sets: 4, reps: "6-10", targetRir: 2 } },
        { name: "Pull-Up", label: "Dominadas", scheme: { sets: 3, reps: "6-10", targetRir: 2 } },
        { name: "Face Pull", label: "Face pull", scheme: { sets: 3, reps: "12-20", targetRir: 1 } },
        { name: "Barbell Curl", label: "Curl con barra", scheme: { sets: 3, reps: "8-12", targetRir: 1 } },
      ],
    },
    {
      key: "leg",
      order: 7,
      type: "leg",
      label: "Leg",
      focus: "Piernas, énfasis en cuádriceps y glúteo",
      exercises: [
        { name: "Front Squat", label: "Sentadilla frontal", scheme: { sets: 3, reps: "6-8", targetRir: 2 } },
        { name: "Hip Thrust", label: "Empuje de cadera", scheme: { sets: 3, reps: "8-12", targetRir: 2 } },
        { name: "Leg Curl", label: "Curl femoral", scheme: { sets: 3, reps: "10-12", targetRir: 1 } },
        { name: "Seated Calf Raise", label: "Elevación de talones sentado", scheme: { sets: 4, reps: "10-15", targetRir: 1 } },
      ],
    },
  ],
};

export function findDay(split: SplitPreset, key: string): PresetDay | undefined {
  return split.days.find((d) => d.key === key);
}
