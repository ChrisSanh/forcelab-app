import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BedDouble, ChevronRight, Dumbbell, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { UserGoal, UserProgram, WorkoutLog } from "@/lib/types";
import type { SetPoint } from "@/lib/progression/analytics";
import { sameExercise } from "@/lib/progression/matching";
import { EvolutionChart } from "./EvolutionChart";
import { GoalSummaryCard } from "./GoalSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SignOutButton } from "./SignOutButton";

// Authenticated route: it reads the session, so it is allowed to block navigation.
export const instant = false;

export const metadata = { title: "Panel · ForceLab" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando tu panel…</p>}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: program }, { data: logs }, { data: setRows }, { data: goalRows }] = await Promise.all([
    supabase
      .from("user_programs")
      .select(
        "id, user_id, methodology_id, program_name, is_active, split_structure, main_lift_name, starting_pr_kg, current_pr_kg, target_pr_kg, created_at",
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_logs")
      .select("id, user_id, program_id, day_label, session_date, created_at")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("set_logs")
      .select("workout_id, exercise_name, weight_kg, reps, calculated_e1rm, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(2000),
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  const prog = program as UserProgram | null;
  if (!prog) redirect("/onboarding");

  const sets = (setRows ?? []) as SetPoint[];
  const goals = (goalRows ?? []) as UserGoal[];

  const start = Number(prog.starting_pr_kg);
  const target = Number(prog.target_pr_kg);
  // Only bench press sets count toward the bench PR (see docs/FUTURE_IMPROVEMENTS.md #1).
  const benchE1rm = sets
    .filter((s) => s.calculated_e1rm != null && sameExercise(prog.main_lift_name, s.exercise_name))
    .reduce((max, s) => Math.max(max, Number(s.calculated_e1rm)), 0);
  const best = Math.max(start, Number(prog.current_pr_kg), benchE1rm);
  const pct = target > start ? Math.min(100, Math.max(0, ((best - start) / (target - start)) * 100)) : 100;
  const days = prog.split_structure?.days ?? [];

  // Reps of the most recent session of each goal, used for the hypertrophy level.
  const lastRepsFor = (goal: UserGoal): number[] => {
    const own = sets.filter((s) => sameExercise(goal.exercise_name, s.exercise_name));
    if (own.length === 0) return [];
    const lastWorkout = own[own.length - 1].workout_id;
    const lastSets = own.filter((s) => s.workout_id === lastWorkout);
    const top = Math.max(...lastSets.map((s) => Number(s.weight_kg)));
    return lastSets.filter((s) => Number(s.weight_kg) === top).map((s) => s.reps);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary">FORCELAB</p>
          <h1 className="text-2xl font-bold">Tu panel</h1>
        </div>
        <SignOutButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" aria-hidden />
            Progreso hacia tu PR
          </CardTitle>
          <CardDescription>{prog.main_lift_name} · e1RM estimado</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold tabular-nums">
              {best.toFixed(1)} <span className="text-lg font-medium text-muted-foreground">kg</span>
            </span>
            <span className="text-sm text-muted-foreground">Meta {target} kg</span>
          </div>
          <Progress value={pct} aria-label="Progreso hacia tu PR objetivo" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Inicio {start} kg</span>
            <span>{pct.toFixed(0)}%</span>
            <span>Faltan {Math.max(0, target - best).toFixed(1)} kg</span>
          </div>
        </CardContent>
      </Card>

      <EvolutionChart sets={sets} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Mis metas</h2>
          <Link href="/goals" className="text-sm text-primary underline-offset-4 hover:underline">
            Gestionar
          </Link>
        </div>
        {goals.length === 0 ? (
          <Link href="/goals" className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-secondary/40">
            Aún no tienes metas. Crea una para recibir recomendaciones de carga.
          </Link>
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.map((g) => (
              <li key={g.id}>
                <GoalSummaryCard goal={g} lastReps={lastRepsFor(g)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {prog.program_name ?? "Rutina activa"}
        </h2>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tu programa no tiene días cargados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {days.map((d) => {
              const isRest = d.type === "rest";
              const inner = (
                <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold">
                    {d.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.focus}</p>
                  </div>
                  {isRest ? (
                    <BedDouble className="size-5 text-muted-foreground" aria-label="Día de descanso" />
                  ) : (
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  )}
                </div>
              );
              return (
                <li key={d.key}>
                  {isRest ? inner : <Link href={`/workout/${d.key}`}>{inner}</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Últimos entrenamientos</h2>
        {!logs || logs.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <Dumbbell className="size-5" aria-hidden />
            Aún no registras entrenamientos. Elige un día para comenzar.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(logs as WorkoutLog[]).map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                <span className="font-medium">{l.day_label ?? "Entrenamiento"}</span>
                <Badge variant="secondary">{formatDate(l.session_date)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
