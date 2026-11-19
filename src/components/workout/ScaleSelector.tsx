"use client";

import { cn } from "@/lib/utils";

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

export function VelocitySelector(props: Omit<ScaleSelectorProps, "label" | "values" | "hint">) {
  return (
    <ScaleSelector
      {...props}
      label="Velocidad percibida"
      values={[1, 2, 3, 4, 5]}
      hint="1 = lenta, 5 = explosiva"
    />
  );
}
