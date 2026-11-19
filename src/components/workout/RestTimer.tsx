"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRESETS = [60, 90, 120, 180];

function format(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface RestTimerProps {
  /** Incrementing value; each change restarts the timer (e.g. after saving a set). */
  restartSignal: number;
}

export function RestTimer({ restartSignal }: RestTimerProps) {
  const [duration, setDuration] = useState(120);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const lastSignal = useRef(restartSignal);

  useEffect(() => {
    if (restartSignal !== lastSignal.current) {
      lastSignal.current = restartSignal;
      setRemaining(duration);
      setRunning(true);
    }
  }, [restartSignal, duration]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const done = !running && remaining === 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" aria-hidden />
          Descanso
        </div>
        <span
          className={`font-mono text-3xl tabular-nums ${done ? "text-muted-foreground" : "text-primary"}`}
          aria-live="off"
        >
          {format(done ? duration : remaining)}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            aria-label={running ? "Pausar descanso" : "Iniciar descanso"}
            onClick={() => {
              if (running) setRunning(false);
              else {
                if (remaining === 0) setRemaining(duration);
                setRunning(true);
              }
            }}
          >
            {running ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Reiniciar descanso"
            onClick={() => {
              setRunning(false);
              setRemaining(0);
            }}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={duration === p ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setDuration(p);
              if (!running) setRemaining(0);
            }}
          >
            {format(p)}
          </Button>
        ))}
      </div>
    </div>
  );
}
