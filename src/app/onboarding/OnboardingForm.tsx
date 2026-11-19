"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SPLIT } from "@/lib/presets/defaultSplit";
import type { Methodology } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toNumber(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && value.trim() !== "" ? n : null;
}

export function OnboardingForm({
  methodologies,
  userId,
}: {
  methodologies: Methodology[];
  userId: string;
}) {
  const router = useRouter();
  const hybrid = methodologies.find((m) => m.slug === "hybrid-bilbo-strength");
  const [bodyweight, setBodyweight] = useState("");
  const [startDate, setStartDate] = useState("");
  const [currentPr, setCurrentPr] = useState("");
  const [targetPr, setTargetPr] = useState("");
  const [methodologyId, setMethodologyId] = useState<string | null>(hybrid?.id ?? methodologies[0]?.id ?? null);
  const [loadSplit, setLoadSplit] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = methodologies.find((m) => m.id === methodologyId);
  const items = methodologies.map((m) => ({ label: m.name, value: m.id }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const bw = toNumber(bodyweight);
    const cur = toNumber(currentPr);
    const tgt = toNumber(targetPr);
    if (!bw || bw < 30 || bw > 300) return setError("Ingresa un peso corporal válido (30–300 kg).");
    if (!startDate) return setError("Indica la fecha en que empezaste a entrenar.");
    if (!cur || cur <= 0) return setError("Ingresa tu PR actual de press de banca.");
    if (!tgt || tgt <= cur) return setError("Tu PR objetivo debe ser mayor que tu PR actual.");
    if (!methodologyId) return setError("Elige una metodología.");

    setLoading(true);
    const supabase = createClient();

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      bodyweight_kg: bw,
      training_start_date: startDate,
      current_pr_kg: cur,
      target_pr_kg: tgt,
    });
    if (profileError) {
      setLoading(false);
      return setError(`No pudimos guardar tu perfil. (${profileError.message})`);
    }

    await supabase.from("user_programs").update({ is_active: false }).eq("user_id", userId);
    const { error: programError } = await supabase.from("user_programs").insert({
      user_id: userId,
      methodology_id: methodologyId,
      program_name: loadSplit ? DEFAULT_SPLIT.name : selected?.name ?? "Mi programa",
      is_active: true,
      split_structure: loadSplit ? DEFAULT_SPLIT : { ...DEFAULT_SPLIT, days: [] },
    });
    setLoading(false);
    if (programError) {
      return setError(`No pudimos crear tu programa. (${programError.message})`);
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Configura tu perfil</CardTitle>
        <CardDescription>Con estos datos calculamos tu progreso y tus cargas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bodyweight">Peso corporal (kg)</Label>
              <Input id="bodyweight" inputMode="decimal" placeholder="80" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start">Inicio de entrenamiento</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current">PR actual banca (kg)</Label>
              <Input id="current" inputMode="decimal" placeholder="110" value={currentPr} onChange={(e) => setCurrentPr(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target">PR objetivo (kg)</Label>
              <Input id="target" inputMode="decimal" placeholder="150" value={targetPr} onChange={(e) => setTargetPr(e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Metodología</Label>
            <Select items={items} value={methodologyId} onValueChange={(v) => setMethodologyId(v as string | null)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Elige una metodología" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.description ? <p className="text-xs text-muted-foreground">{selected.description}</p> : null}
          </div>

          <button
            type="button"
            onClick={() => setLoadSplit((v) => !v)}
            aria-pressed={loadSplit}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
              loadSplit ? "border-primary bg-primary/10" : "bg-card hover:bg-secondary/50"
            }`}
          >
            <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${loadSplit ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-medium">
                Cargar rutina {DEFAULT_SPLIT.name}
                <Badge variant="secondary">1 clic</Badge>
              </span>
              <span className="text-xs text-muted-foreground">{DEFAULT_SPLIT.description}</span>
            </div>
          </button>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="h-11 text-base" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Guardar y continuar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
