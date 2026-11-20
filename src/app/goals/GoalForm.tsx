"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  PROGRESSION_HINTS,
  PROGRESSION_LABELS,
  PROGRESSION_TYPES,
} from "@/lib/progression/messages";
import { defaultsFor, validateGoal, type GoalFormValues } from "@/lib/progression/goalActions";
import { usesCycles } from "@/lib/math/progressionEngine";
import type { MuscleGroup, ProgressionType, UserGoal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toNumber(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && value.trim() !== "" ? n : null;
}

const muscleItems = MUSCLE_GROUPS.map((g) => ({ value: g, label: MUSCLE_GROUP_LABELS[g] }));
const typeItems = PROGRESSION_TYPES.map((t) => ({ value: t, label: PROGRESSION_LABELS[t] }));

export function GoalForm({
  goal,
  onSubmit,
  onCancel,
}: {
  goal: UserGoal | null;
  onSubmit: (values: GoalFormValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const initialType = goal?.progression_type ?? "double_progression";
  const defaults = defaultsFor(initialType, goal?.exercise_name);

  const [exerciseName, setExerciseName] = useState(goal?.exercise_name ?? "");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(goal?.muscle_group ?? "chest");
  const [type, setType] = useState<ProgressionType>(initialType);
  const [currentPr, setCurrentPr] = useState(goal?.current_pr_kg != null ? String(goal.current_pr_kg) : "");
  const [targetPr, setTargetPr] = useState(goal?.target_pr_kg != null ? String(goal.target_pr_kg) : "");
  const [sets, setSets] = useState(String(goal?.target_sets ?? defaults.targetSets));
  const [repMin, setRepMin] = useState(String(goal?.rep_range_min ?? defaults.repRangeMin));
  const [repMax, setRepMax] = useState(String(goal?.rep_range_max ?? defaults.repRangeMax));
  const [step, setStep] = useState(String(goal?.increment_step_kg ?? defaults.incrementStepKg));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cycleBased = usesCycles(type);
  const isEdit = goal != null;

  function changeType(next: ProgressionType) {
    setType(next);
    const d = defaultsFor(next, exerciseName);
    setSets(String(d.targetSets));
    setRepMin(String(d.repRangeMin));
    setRepMax(String(d.repRangeMax));
    setStep(String(d.incrementStepKg));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const values: GoalFormValues = {
      exerciseName,
      muscleGroup,
      progressionType: type,
      currentPrKg: toNumber(currentPr),
      targetPrKg: toNumber(targetPr),
      targetSets: toNumber(sets) ?? 0,
      repRangeMin: toNumber(repMin) ?? 0,
      repRangeMax: toNumber(repMax) ?? 0,
      incrementStepKg: toNumber(step) ?? 0,
    };
    const problem = validateGoal(values);
    if (problem) return setError(problem);

    setError(null);
    setLoading(true);
    const message = await onSubmit(values);
    setLoading(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-exercise">Ejercicio</Label>
        <Input
          id="goal-exercise"
          placeholder="Ej: Press de Banca Plano"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Grupo muscular</Label>
          <Select items={muscleItems} value={muscleGroup} onValueChange={(v) => setMuscleGroup(v as MuscleGroup)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {muscleItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Progresión</Label>
          <Select items={typeItems} value={type} onValueChange={(v) => changeType(v as ProgressionType)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">{PROGRESSION_HINTS[type]}</p>

      {cycleBased || type === "linear_progression" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-current">Marca actual (kg)</Label>
            <Input
              id="goal-current"
              inputMode="decimal"
              value={currentPr}
              onChange={(e) => setCurrentPr(e.target.value)}
              disabled={isEdit}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-target">Marca objetivo (kg)</Label>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={targetPr}
              onChange={(e) => setTargetPr(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      ) : null}
      {isEdit && (cycleBased || type === "linear_progression") ? (
        <p className="-mt-1 text-xs text-muted-foreground">
          Para cambiar tu marca actual usa «Registrar nuevo PR oficial».
        </p>
      ) : null}

      {!cycleBased ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-sets">Series</Label>
            <Input id="goal-sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-min">Reps mín.</Label>
            <Input id="goal-min" inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-max">Reps máx.</Label>
            <Input id="goal-max" inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} className="h-10" />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-step">Incremento de carga (kg)</Label>
        <Input id="goal-step" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} className="h-10" />
        <span className="text-xs text-muted-foreground">2,5 kg en barras y máquinas; 1,25 kg en mancuernas y poleas.</span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="h-10 flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="h-10 flex-1" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          {isEdit ? "Guardar cambios" : "Crear meta"}
        </Button>
      </div>
    </form>
  );
}
