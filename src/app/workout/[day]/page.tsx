import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserProgram } from "@/lib/types";
import { findDay } from "@/lib/presets/defaultSplit";
import { WorkoutLogger } from "./WorkoutLogger";

// Authenticated route: it reads the session, so it is allowed to block navigation.
export const instant = false;

export const metadata = { title: "Entrenamiento · ForceLab" };

export default function WorkoutPage({ params }: { params: Promise<{ day: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando entrenamiento…</p>}>
      <WorkoutContent params={params} />
    </Suspense>
  );
}

async function WorkoutContent({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: program }, { data: profile }] = await Promise.all([
    supabase
      .from("user_programs")
      .select("id, user_id, methodology_id, program_name, is_active, split_structure, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("current_pr_kg").eq("id", user.id).maybeSingle(),
  ]);

  const prog = program as UserProgram | null;
  if (!prog?.split_structure) redirect("/onboarding");

  const dayConfig = findDay(prog.split_structure, day);
  if (!dayConfig || dayConfig.type === "rest") notFound();

  return (
    <WorkoutLogger
      userId={user.id}
      programId={prog.id}
      day={dayConfig}
      benchPr={(profile as { current_pr_kg: number | null } | null)?.current_pr_kg ?? null}
    />
  );
}
