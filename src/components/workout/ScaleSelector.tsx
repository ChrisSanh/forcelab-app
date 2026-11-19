"use client";

import { cn } from "@/lib/utils";
import type { BarSpeed } from "@/lib/types";

export interface ScaleSelectorProps {
  label: string;
  /** Values to render as one-tap buttons. */
  values: number[];
  value: number | null;
  onChange: (value: number | null) => void;
  /** Optional hint under the buttons (Spanish). */
  hint?: string;
}

/** One-tap selector used for RIR (0-5) and perceived velocity (1-5). */
export function ScaleSelector({ label, values, value, onChange, hint }: ScaleSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={cn(
              "h-11 rounded-lg border text-base font-semibold transition-colors",
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-secondary/60 text-foreground hover:bg-secondary",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function RirSelector(props: Omit<ScaleSelectorProps, "label" | "values" | "hint">) {
  return (
    <ScaleSelector
      {...props}
      label="RIR (repeticiones en recámara)"
      values={[0, 1, 2, 3, 4, 5]}
      hint="0 = fallo, 5 = muy fácil"
    />
  );
}

export const BAR_SPEED_OPTIONS: { value: BarSpeed; label: string }[] = [
  { value: "grind", label: "Lenta" },
  { value: "moderate", label: "Media" },
  { value: "fast", label: "Rápida" },
  { value: "explosive", label: "Explosiva" },
];

export function VelocitySelector({
  value,
  onChange,
}: {
  value: BarSpeed | null;
  onChange: (value: BarSpeed | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">Velocidad percibida de la barra</span>
      <div className="grid grid-cols-4 gap-1">
        {BAR_SPEED_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
            className={cn(
              "h-11 rounded-lg border text-sm font-semibold transition-colors",
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-secondary/60 text-foreground hover:bg-secondary",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
