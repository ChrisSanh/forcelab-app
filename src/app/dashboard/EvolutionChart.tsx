"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildSeries, exerciseOptions, type SetPoint } from "@/lib/progression/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function EvolutionChart({ sets }: { sets: SetPoint[] }) {
  const options = useMemo(() => exerciseOptions(sets), [sets]);
  const [selected, setSelected] = useState<string | null>(options[0] ?? null);

  const series = useMemo(() => (selected ? buildSeries(sets, selected) : []), [sets, selected]);
  const items = options.map((o) => ({ value: o, label: o }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución</CardTitle>
        <CardDescription>e1RM y tonelaje por sesión</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Registra tu primer entrenamiento para ver tu curva de progreso.</p>
        ) : (
          <>
            <Select items={items} value={selected} onValueChange={(v) => setSelected(v as string | null)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Elige un ejercicio" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {series.length < 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Necesitas al menos 2 sesiones de este ejercicio para ver la curva.
              </p>
            ) : (
              <div className="h-64 w-full" role="img" aria-label={`Evolución de ${selected}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis yAxisId="e1rm" stroke="var(--chart-1)" fontSize={11} unit=" kg" width={52} domain={["auto", "auto"]} />
                    <YAxis yAxisId="tonnage" orientation="right" stroke="var(--chart-3)" fontSize={11} width={48} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(label) => shortDate(String(label))}
                      formatter={(value, name) =>
                        name === "e1RM"
                          ? [`${value} kg`, "e1RM"]
                          : [`${new Intl.NumberFormat("es-CL").format(Number(value))} kg`, "Tonelaje"]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="e1rm" type="monotone" dataKey="e1rm" name="e1RM" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line yAxisId="tonnage" type="monotone" dataKey="tonnage" name="Tonelaje" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
