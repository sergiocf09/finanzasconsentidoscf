import { useMemo } from "react";
import { Lightbulb, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialSignal, Recommendation } from "@/hooks/useFinancialIntelligence";

interface BudgetBlockInsightsProps {
  block: "stability" | "lifestyle" | "build";
  signals: FinancialSignal[];
  recommendations: Recommendation[];
}

const blockKeywords: Record<string, string[]> = {
  stability: ["stability", "estabilidad", "obligaciones", "fijos"],
  lifestyle: ["lifestyle", "calidad de vida", "restaurantes", "entretenimiento"],
  build: ["build", "construcción", "ahorro", "inversión", "emergencia"],
};

export function BudgetBlockInsights({ block, signals, recommendations }: BudgetBlockInsightsProps) {
  const relevantSignals = useMemo(() => {
    return signals.filter((s) => {
      if (s.block === block) return true;
      const kw = blockKeywords[block];
      return kw.some((k) => s.message.toLowerCase().includes(k) || s.title.toLowerCase().includes(k));
    }).slice(0, 2);
  }, [signals, block]);

  const relevantRecs = useMemo(() => {
    const kw = blockKeywords[block];
    return recommendations.filter((r) =>
      kw.some((k) => r.message.toLowerCase().includes(k))
    ).slice(0, 1);
  }, [recommendations, block]);

  if (relevantSignals.length === 0 && relevantRecs.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-1">
      {relevantSignals.map((s) => {
        const isPositive = s.type === "positive";
        return (
          <div
            key={s.id}
            className={cn(
              "flex gap-2 items-start rounded-lg px-2.5 py-2 text-xs",
              isPositive
                ? "bg-[hsl(var(--income)/0.08)] text-[hsl(var(--income))]"
                : "bg-[hsl(var(--status-warning)/0.08)] text-[hsl(var(--status-warning))]"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            )}
            <span className="text-foreground/80 leading-relaxed">{s.message}</span>
          </div>
        );
      })}
      {relevantRecs.map((r) => (
        <div
          key={r.id}
          className="flex gap-2 items-start rounded-lg px-2.5 py-2 text-xs bg-[hsl(var(--block-build)/0.08)]"
        >
          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[hsl(var(--block-build))]" />
          <span className="text-foreground/80 leading-relaxed">{r.message}</span>
        </div>
      ))}
    </div>
  );
}
