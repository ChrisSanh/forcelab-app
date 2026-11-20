import type { MuscleGroup, ProgressionType } from "@/lib/types";
import type { Prescription } from "@/lib/math/progressionEngine";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Pecho",
  back: "Espalda",
  legs: "Piernas",
  shoulders: "Hombros",
  arms: "Brazos",
};

export const PROGRESSION_LABELS: Record<ProgressionType, string> = {
  bilbo_cycle: "Método Bilbo",
  heavy_blocks: "Bloques de fuerza pesada",
  double_progression: "Doble progresión",
  linear_progression: "Progresión lineal",
};

export const PROGRESSION_HINTS: Record<ProgressionType, string> = {
  bilbo_cycle: "Una serie explosiva al 50% de tu PR, +2,5 kg por sesión hasta bajar de 15 reps.",
  heavy_blocks: "Ola de 4 semanas: 77% → 80% → 83% → 70% (descarga).",
  double_progression: "Cuando completas todas las series en el tope del rango, sube el peso.",
  linear_progression: "Si completas las series y reps objetivo, sube 2,5 kg la próxima sesión.",
};

export const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
export const PROGRESSION_TYPES = Object.keys(PROGRESSION_LABELS) as ProgressionType[];

/** Formats a weight in Chilean Spanish: "57,5 kg". */
export function formatKg(kg: number): string {
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(kg)} kg`;
}

export interface Recommendation {
  title: string;
  detail: string;
  tone: "default" | "success" | "warning";
}

/** Turns a prescription into the Spanish text shown above each exercise. */
export function describePrescription(p: Prescription): Recommendation {
  const weight = p.weightKg != null ? formatKg(p.weightKg) : null;

  switch (p.progressionType) {
    case "bilbo_cycle": {
      if (p.reason === "cycle_end") {
        return {
          title: "Fin de ciclo Bilbo alcanzado",
          detail:
            "Descansa 3-5 días y realiza pirámide de test para buscar nuevo PR (+5 kg).",
          tone: "warning",
        };
      }
      const beat = p.repsToBeat != null ? ` Objetivo: >${p.repsToBeat} reps.` : " Objetivo: 15+ reps.";
      return {
        title: `Meta Bilbo: hoy toca ${weight}`,
        detail:
          p.reason === "hold"
            ? `Llegaste a 15+ reps pero sin reserva. Repite la carga y deja al menos 1 RIR.${beat}`
            : `Una serie explosiva.${beat}`,
        tone: "default",
      };
    }

    case "heavy_blocks": {
      if (p.reason === "block_complete") {
        return {
          title: "Bloque de fuerza completado",
          detail: "Registra tu nuevo PR en Metas para iniciar un bloque recalculado.",
          tone: "success",
        };
      }
      const pct = p.percent != null ? Math.round(p.percent * 100) : null;
      return {
        title: `Semana ${p.sequence} de 4: ${weight}`,
        detail: `${p.sets}×${p.repsMin}${pct ? ` al ${pct}% de tu 1RM base` : ""}.${
          p.status === "deload_recommended" ? " Semana de descarga." : ""
        }`,
        tone: p.status === "deload_recommended" ? "warning" : "default",
      };
    }

    case "double_progression": {
      if (p.reason === "first_session") {
        return {
          title: "Doble progresión: primera sesión",
          detail: `Elige un peso con el que llegues a ${p.repsMin}-${p.repsMax} reps con 1-2 RIR.`,
          tone: "default",
        };
      }
      if (p.reason === "increase_weight") {
        return {
          title: `Doble progresión: sube a ${weight} hoy`,
          detail: `Completaste ${p.sets}×${p.repsMax} con ${formatKg(p.lastWeightKg ?? 0)}. Reinicia en ${p.repsToBeat} reps.`,
          tone: "success",
        };
      }
      return {
        title: `Doble progresión: mantén ${weight}`,
        detail: `La última vez hiciste ${p.previousReps.join(" / ")} reps. Supéralas hasta llegar a ${p.repsMax} en todas las series.`,
        tone: "default",
      };
    }

    case "linear_progression": {
      if (p.reason === "first_session") {
        return {
          title: "Progresión lineal: primera sesión",
          detail: `Elige un peso para ${p.sets}×${p.repsMax} con técnica limpia.`,
          tone: "default",
        };
      }
      if (p.reason === "increase_weight") {
        return {
          title: `Progresión lineal: sube a ${weight} hoy`,
          detail: `Completaste ${p.sets}×${p.repsMax} con ${formatKg(p.lastWeightKg ?? 0)}.`,
          tone: "success",
        };
      }
      return {
        title: `Progresión lineal: mantén ${weight}`,
        detail: `Te faltaron repeticiones la última vez (${p.previousReps.join(" / ")}). Busca ${p.sets}×${p.repsMax}.`,
        tone: "default",
      };
    }
  }
}
