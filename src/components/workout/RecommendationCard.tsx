import { Lightbulb, TrendingUp, TriangleAlert } from "lucide-react";
import type { Recommendation } from "@/lib/progression/messages";

const TONE_STYLES: Record<Recommendation["tone"], string> = {
  default: "border-primary/30 bg-primary/10",
  success: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
};

const TONE_ICON = {
  default: Lightbulb,
  success: TrendingUp,
  warning: TriangleAlert,
} as const;

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const Icon = TONE_ICON[recommendation.tone];
  return (
    <div className={`flex gap-3 rounded-xl border p-3 ${TONE_STYLES[recommendation.tone]}`}>
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{recommendation.title}</p>
        <p className="text-xs text-muted-foreground">{recommendation.detail}</p>
      </div>
    </div>
  );
}
