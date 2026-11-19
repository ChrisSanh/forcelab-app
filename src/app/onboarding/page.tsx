import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Methodology } from "@/lib/types";
import { OnboardingForm } from "./OnboardingForm";

// Authenticated route: it reads the session, so it is allowed to block navigation.
export const instant = false;

export const metadata = { title: "Configura tu perfil · ForceLab" };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
      <OnboardingContent />
    </Suspense>
  );
}

async function OnboardingContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: methodologies } = await supabase
    .from("training_methodologies")
    .select("id, slug, name, description, default_config")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <OnboardingForm methodologies={(methodologies ?? []) as Methodology[]} userId={user.id} />
    </main>
  );
}
