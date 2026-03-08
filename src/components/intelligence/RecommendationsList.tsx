import { Lightbulb } from "lucide-react";
import type { Recommendation } from "@/hooks/useFinancialIntelligence";

interface RecommendationsListProps {
  recommendations: Recommendation[];
  maxItems?: number;
}

export function RecommendationsList({ recommendations, maxItems }: RecommendationsListProps) {
  const visible = maxItems ? recommendations.slice(0, maxItems) : recommendations;

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">No hay recomendaciones por ahora. ¡Vas bien!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-heading font-semibold text-sm">Recomendaciones</h3>
      <div className="space-y-2.5">
        {visible.map((r) => (
          <div key={r.id} className="flex gap-3 rounded-xl bg-[hsl(var(--block-build)/0.08)] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--block-build)/0.15)]">
              <Lightbulb className="h-4 w-4 text-[hsl(var(--block-build))]" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">{r.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
