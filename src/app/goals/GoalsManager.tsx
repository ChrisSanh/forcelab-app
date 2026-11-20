"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Trophy, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  closeGoal,
  createGoal,
  registerNewPr,
  updateGoal,
  type GoalFormValues,
} from "@/lib/progression/goalActions";
import { MUSCLE_GROUP_LABELS, PROGRESSION_LABELS, formatKg } from "@/lib/progression/messages";
import { usesCycles } from "@/lib/math/progressionEngine";
import type { UserGoal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { GoalForm } from "./GoalForm";

type Modal =
  | { kind: "form"; goal: UserGoal | null }
  | { kind: "pr"; goal: UserGoal }
  | { kind: "close"; goal: UserGoal }
  | null;

function strengthProgress(goal: UserGoal): number | null {
  if (goal.starting_pr_kg == null || goal.target_pr_kg == null || goal.current_pr_kg == null) return null;
  const start = Number(goal.starting_pr_kg);
  const target = Number(goal.target_pr_kg);
  if (target <= start) return 100;
  return Math.min(100, Math.max(0, ((Number(goal.current_pr_kg) - start) / (target - start)) * 100));
}

export function GoalsManager({
  userId,
  programId,
  goals,
}: {
  userId: string;
  programId: string | null;
  goals: UserGoal[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [newPr, setNewPr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = goals.filter((g) => g.is_active);
  const closed = goals.filter((g) => !g.is_active);

  function open(next: Modal) {
    setError(null);
    setNewPr("");
    setModal(next);
  }

  function done() {
    setModal(null);
    router.refresh();
  }

  async function saveGoal(values: GoalFormValues): Promise<string | null> {
    if (modal?.kind !== "form") return null;
    const supabase = createClient();
    const result = modal.goal
      ? await updateGoal(supabase, modal.goal.id, values)
      : await createGoal(supabase, userId, programId, values);
    if (!result.ok) return result.message;
    done();
    return null;
  }

  async function submitPr() {
    if (modal?.kind !== "pr") return;
    const value = Number(newPr.replace(",", "."));
    setBusy(true);
    const result = await registerNewPr(createClient(), userId, modal.goal, value);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    done();
  }

  async function confirmClose() {
    if (modal?.kind !== "close") return;
    setBusy(true);
    const result = await closeGoal(createClient(), modal.goal.id);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    done();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Volver al panel" className="rounded-lg p-2 hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Mis metas</h1>
          <p className="text-xs text-muted-foreground">Un objetivo por ejercicio, cada uno con su progresión.</p>
        </div>
        <Button size="sm" onClick={() => open({ kind: "form", goal: null })}>
          <Plus /> Nueva
        </Button>
      </header>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no tienes metas activas. Crea la primera para recibir recomendaciones de carga en cada entrenamiento.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((g) => {
            const pct = strengthProgress(g);
            const reached = g.target_pr_kg != null && g.current_pr_kg != null && Number(g.current_pr_kg) >= Number(g.target_pr_kg);
            return (
              <li key={g.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {g.exercise_name}
                      <Badge variant="secondary">{MUSCLE_GROUP_LABELS[g.muscle_group]}</Badge>
                      <Badge>{PROGRESSION_LABELS[g.progression_type]}</Badge>
                      {reached ? <Badge variant="secondary">Meta alcanzada</Badge> : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {g.current_pr_kg != null ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-end justify-between text-sm">
                          <span>
                            <span className="text-2xl font-bold tabular-nums">{formatKg(Number(g.current_pr_kg))}</span>
                            <span className="text-muted-foreground"> actual</span>
                          </span>
                          {g.target_pr_kg != null ? (
                            <span className="text-muted-foreground">Meta {formatKg(Number(g.target_pr_kg))}</span>
                          ) : null}
                        </div>
                        {pct != null ? <Progress value={pct} aria-label={`Progreso de ${g.exercise_name}`} /> : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Rango {g.rep_range_min}-{g.rep_range_max} reps · {g.target_sets} series · +{formatKg(Number(g.increment_step_kg))}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {g.current_pr_kg != null && (usesCycles(g.progression_type) || g.progression_type === "linear_progression") ? (
                        <Button size="sm" onClick={() => open({ kind: "pr", goal: g })}>
                          <Trophy /> Registrar nuevo PR oficial
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => open({ kind: "form", goal: g })}>
                        <Pencil /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => open({ kind: "close", goal: g })}>
                        <XCircle /> Cerrar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Metas cerradas</h2>
          <ul className="flex flex-col gap-2">
            {closed.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                <span>{g.exercise_name}</span>
                <span className="text-muted-foreground">
                  {g.current_pr_kg != null ? formatKg(Number(g.current_pr_kg)) : PROGRESSION_LABELS[g.progression_type]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={modal?.kind === "form"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.kind === "form" && modal.goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
            <DialogDescription>Elige el ejercicio, su progresión y tu objetivo.</DialogDescription>
          </DialogHeader>
          {modal?.kind === "form" ? (
            <GoalForm key={modal.goal?.id ?? "new"} goal={modal.goal} onSubmit={saveGoal} onCancel={() => setModal(null)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={modal?.kind === "pr"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar nuevo PR oficial</DialogTitle>
            <DialogDescription>
              {modal?.kind === "pr"
                ? `${modal.goal.exercise_name}: tu marca actual es ${formatKg(Number(modal.goal.current_pr_kg))}. Se iniciará un ciclo nuevo recalculado desde tu nuevo PR.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-pr">Nuevo PR (kg)</Label>
            <Input id="new-pr" inputMode="decimal" value={newPr} onChange={(e) => setNewPr(e.target.value)} className="h-10" />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button className="h-10 flex-1" disabled={busy} onClick={submitPr}>
              {busy ? <Loader2 className="animate-spin" /> : <Trophy />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal?.kind === "close"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar meta</DialogTitle>
            <DialogDescription>
              {modal?.kind === "close"
                ? `«${modal.goal.exercise_name}» dejará de recomendarte cargas. Tu historial se conserva.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="h-10 flex-1" disabled={busy} onClick={confirmClose}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Cerrar meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
