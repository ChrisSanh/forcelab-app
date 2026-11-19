"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calculateE1rm, loadForPercent } from "@/lib/math/e1rm";
import type { PresetDay, PresetExercise } from "@/lib/presets/defaultSplit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RestTimer } from "@/components/workout/RestTimer";
import { RirSelector, VelocitySelector } from "@/components/workout/ScaleSelector";

interface SetDraft {
  weight: string;
  reps: string;
  rir: number | null;
  velocity: number | null;
}

interface SavedSet {
  weightKg: number;
  reps: number;
  rir: number | null;
  e1rm: number | null;
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && value.trim() !== "" ? n : null;
}

function emptyDraft(rir: number | null): SetDraft {
  return { weight: "", reps: "", rir, velocity: null };
}

export function WorkoutLogger({
  userId,
  programId,
  day,
  benchPr,
}: {
  userId: string;
  programId: string;
  day: PresetDay;
  benchPr: number | null;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>(() =>
    Object.fromEntries(day.exercises.map((e) => [e.name, emptyDraft(e.scheme.targetRir ?? null)])),
  );
  const [saved, setSaved] = useState<Record<string, SavedSet[]>>({});
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restSignal, setRestSignal] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const totalSets = useMemo(() => Object.values(saved).reduce((n, s) => n + s.length, 0), [saved]);

  function update(name: string, patch: Partial<SetDraft>) {
    setDrafts((d) => ({ ...d, [name]: { ...d[name], ...patch } }));
  }

  async function ensureWorkout(): Promise<string | null> {
    if (workoutId) return workoutId;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        user_id: userId,
        program_id: programId,
        day_label: day.label,
        session_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("workout_logs insert failed", error);
      setError(`No pudimos iniciar el entrenamiento. (${error?.message ?? "sin datos"}${error?.details ? ` — ${error.details}` : ""})`);
      return null;
    }
    setWorkoutId(data.id);
    return data.id as string;
  }

  async function saveSet(exercise: PresetExercise) {
    const draft = drafts[exercise.name];
    const weight = toNumber(draft.weight);
    const reps = toNumber(draft.reps);
    if (weight == null || weight <= 0 || reps == null || reps < 1 || !Number.isInteger(reps)) {
      setError("Ingresa un peso y repeticiones válidos.");
      return;
    }
    setError(null);
    setSavingKey(exercise.name);

    const id = await ensureWorkout();
    if (!id) return setSavingKey(null);

    const e1rm = calculateE1rm({ weightKg: weight, reps, rir: draft.rir ?? 0 });
    const setNumber = (saved[exercise.name]?.length ?? 0) + 1;

    const supabase = createClient();
    const { error } = await supabase.from("set_logs").insert({
      workout_id: id,
      user_id: userId,
      exercise_name: exercise.label,
      set_number: setNumber,
      weight_kg: weight,
      reps,
      rir: draft.rir,
      perceived_velocity: draft.velocity,
      calculated_e1rm: e1rm,
    });
    setSavingKey(null);
    if (error) {
      console.error("set_logs insert failed", error);
      return setError(`No pudimos guardar la serie. (${error.message}${error.details ? ` — ${error.details}` : ""})`);
    }

    setSaved((s) => ({
      ...s,
      [exercise.name]: [...(s[exercise.name] ?? []), { weightKg: weight, reps, rir: draft.rir, e1rm }],
    }));
    // Keep the weight (usual next-set load), clear reps and velocity.
    update(exercise.name, { reps: "", velocity: null });
    setRestSignal((n) => n + 1);
  }

  async function finish() {
    setFinishing(true);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-72">
      <header className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Volver al panel" className="rounded-lg p-2 hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{day.label}</h1>
          <p className="truncate text-xs text-muted-foreground">{day.focus}</p>
        </div>
      </header>

      {day.exercises.map((exercise) => {
        const draft = drafts[exercise.name];
        const sets = saved[exercise.name] ?? [];
        const liveE1rm = calculateE1rm({
          weightKg: toNumber(draft.weight) ?? 0,
          reps: toNumber(draft.reps) ?? 0,
          rir: draft.rir ?? 0,
        });
        const suggested =
          exercise.isMainLift && exercise.scheme.percent1rm && benchPr
            ? loadForPercent(benchPr, exercise.scheme.percent1rm)
            : null;

        return (
          <Card key={exercise.name}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {exercise.label}
                <Badge variant="secondary">
                  {exercise.scheme.sets}×{exercise.scheme.reps}
                </Badge>
                {suggested ? <Badge>{suggested} kg sugeridos</Badge> : null}
              </CardTitle>
              {exercise.notes ? <p className="text-xs text-muted-foreground">{exercise.notes}</p> : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {sets.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {sets.map((s, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Check className="size-4 text-primary" aria-hidden />
                        Serie {i + 1}: {s.weightKg} kg × {s.reps}
                        {s.rir != null ? ` · RIR ${s.rir}` : ""}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{s.e1rm ? `e1RM ${s.e1rm}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`w-${exercise.name}`}>Peso (kg)</Label>
                  <Input
                    id={`w-${exercise.name}`}
                    inputMode="decimal"
                    placeholder={suggested ? String(suggested) : "0"}
                    value={draft.weight}
                    onChange={(e) => update(exercise.name, { weight: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`r-${exercise.name}`}>Repeticiones</Label>
                  <Input
                    id={`r-${exercise.name}`}
                    inputMode="numeric"
                    placeholder="0"
                    value={draft.reps}
                    onChange={(e) => update(exercise.name, { reps: e.target.value })}
                    className="h-12 text-lg"
                  />
                </div>
              </div>

              <RirSelector value={draft.rir} onChange={(v) => update(exercise.name, { rir: v })} />
              <VelocitySelector value={draft.velocity} onChange={(v) => update(exercise.name, { velocity: v })} />

              <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
                <span className="text-xs text-muted-foreground">e1RM en vivo</span>
                <span className="text-xl font-bold text-primary tabular-nums">
                  {liveE1rm ? `${liveE1rm} kg` : "—"}
                </span>
              </div>

              <Button
                size="lg"
                className="h-12 text-base"
                disabled={savingKey === exercise.name}
                onClick={() => saveSet(exercise)}
              >
                {savingKey === exercise.name ? <Loader2 className="animate-spin" /> : <Plus />}
                Guardar serie
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <RestTimer restartSignal={restSignal} />
          <Button size="lg" variant="outline" className="h-11" disabled={finishing} onClick={finish}>
            {finishing ? <Loader2 className="animate-spin" /> : null}
            {totalSets > 0 ? `Terminar entrenamiento (${totalSets} series)` : "Salir sin registrar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
