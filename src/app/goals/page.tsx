import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserGoal } from "@/lib/types";
import { GoalsManager } from "./GoalsManager";

// Authenticated route: it reads the session, so it is allowed to block navigation.
export const instant = false;

export const metadata = { title: "Metas · ForceLab" };

export default function GoalsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando tus metas…</p>}>
      <GoalsContent />
    </Suspense>
  );
}

async function GoalsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: goals }, { data: program }] = await Promise.all([
    supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("user_programs")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <GoalsManager
        userId={user.id}
        programId={(program as { id: string } | null)?.id ?? null}
        goals={(goals ?? []) as UserGoal[]}
      />
    </main>
  );
}
