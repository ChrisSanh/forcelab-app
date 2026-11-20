import { Check } from "lucide-react";
import { buildMilestones, hypertrophyLevel } from "@/lib/progression/analytics";
import { MUSCLE_GROUP_LABELS, PROGRESSION_LABELS, formatKg } from "@/lib/progression/messages";
import { usesCycles } from "@/lib/math/progressionEngine";
import type { UserGoal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function GoalSummaryCard({ goal, lastReps }: { goal: UserGoal; lastReps: number[] }) {
  const strength = usesCycles(goal.progression_type) || goal.progression_type === "linear_progression";
  const hasTarget = goal.starting_pr_kg != null && goal.target_pr_kg != null && goal.current_pr_kg != null;

  if (strength && hasTarget) {
    const start = Number(goal.starting_pr_kg);
    const target = Number(goal.target_pr_kg);
    const current = Number(goal.current_pr_kg);
    const pct = target > start ? Math.min(100, Math.max(0, ((current - start) / (target - start)) * 100)) : 100;
    const milestones = buildMilestones(start, target, current);

    return (
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <Header goal={goal} />
        <div className="flex items-end justify-between text-sm">
          <span className="text-xl font-bold tabular-nums">{formatKg(current)}</span>
          <span className="text-muted-foreground">Meta {formatKg(target)}</span>
        </div>
        <Progress value={pct} aria-label={`Progreso de ${goal.exercise_name}`} />
        {milestones.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {milestones.map((m) => (
              <li
                key={m.value}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${
                  m.reached ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                }`}
              >
                {m.reached ? <Check className="size-3" aria-hidden /> : null}
                {m.value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const level = hypertrophyLevel(lastReps, goal.rep_range_min, goal.rep_range_max);
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <Header goal={goal} />
      <div className="flex items-end justify-between text-sm">
        <span className="text-muted-foreground">
          Rango {goal.rep_range_min}-{goal.rep_range_max} reps · {goal.target_sets} series
        </span>
        <span className="font-semibold tabular-nums">{lastReps.length > 0 ? `${level}%` : "—"}</span>
      </div>
      <Progress value={level} aria-label={`Nivel de progreso de ${goal.exercise_name}`} />
      <span className="text-[11px] text-muted-foreground">
        {lastReps.length > 0
          ? "Nivel dentro del rango según tu última sesión. Al llegar al 100% en todas las series, sube el peso."
          : "Aún no registras este ejercicio."}
      </span>
    </div>
  );
}

function Header({ goal }: { goal: UserGoal }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{goal.exercise_name}</span>
      <Badge variant="secondary">{MUSCLE_GROUP_LABELS[goal.muscle_group]}</Badge>
      <Badge variant="secondary">{PROGRESSION_LABELS[goal.progression_type]}</Badge>
    </div>
  );
}
