"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(
          error.message.toLowerCase().includes("invalid")
            ? "Correo o contraseña incorrectos."
            : "No pudimos iniciar sesión. Inténtalo de nuevo.",
        );
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("already")
          ? "Ya existe una cuenta con ese correo."
          : "No pudimos crear tu cuenta. Revisa los datos e inténtalo otra vez.",
      );
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setInfo("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</CardTitle>
          <CardDescription>
            {isLogin ? "Entra para registrar tu entrenamiento." : "Empieza a entrenar con datos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
              {!isLogin ? (
                <span className="text-xs text-muted-foreground">Mínimo 6 caracteres.</span>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {info ? <p className="text-sm text-primary">{info}</p> : null}
            <Button type="submit" size="lg" className="h-10" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {isLogin ? "Entrar" : "Crear cuenta"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
              <Link href={isLogin ? "/register" : "/login"} className="text-primary underline-offset-4 hover:underline">
                {isLogin ? "Crear cuenta" : "Iniciar sesión"}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
