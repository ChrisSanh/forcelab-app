import Link from "next/link";
import { Activity, Dumbbell, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Dumbbell, title: "Multi-metodología", text: "Bilbo, fuerza pesada, DUP y más en una sola rutina." },
  { icon: Activity, title: "e1RM en vivo", text: "Estimación de tu 1RM serie a serie, con RIR y velocidad." },
  { icon: ShieldCheck, title: "Basado en evidencia", text: "Volumen, carga y recuperación con respaldo científico." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold tracking-widest text-primary">FORCELAB</span>
        <h1 className="text-4xl leading-tight font-bold">Entrena con ciencia, no con suposiciones.</h1>
        <p className="text-muted-foreground">
          Registra tus series, mide tu fuerza y avanza hacia tu próximo récord personal.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "h-11 text-base")}>
          Crear cuenta
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 text-base")}>
          Iniciar sesión
        </Link>
      </div>

      <ul className="flex flex-col gap-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
