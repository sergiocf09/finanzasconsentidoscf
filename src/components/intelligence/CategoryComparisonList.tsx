import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryComparison } from "@/hooks/useFinancialIntelligence";

const blockLabels: Record<string, string> = {
  stability: "Estabilidad",
  lifestyle: "Calidad de Vida",
  build: "Construcción",
};

interface CategoryComparisonListProps {
  comparisons: CategoryComparison[];
  formatAmount: (v: number) => string;
}

export function CategoryComparisonList({ comparisons, formatAmount }: CategoryComparisonListProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">Aún no hay suficientes datos para comparar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-heading font-semibold text-sm">Comparativo vs mes anterior</h3>
      <div className="space-y-2">
        {comparisons.slice(0, 10).map((c) => {
          const isUp = c.change > 5;
          const isDown = c.change < -5;
          return (
            <div key={c.name} className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{blockLabels[c.block] || c.block}</p>
              </div>
              <div className="text-right shrink-0 min-w-[5rem]">
                <p className="text-sm font-medium tabular-nums">{formatAmount(c.current)}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">{formatAmount(c.previous)}</p>
              </div>
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded shrink-0 min-w-[3.5rem] justify-center",
                isUp ? "text-[hsl(var(--expense))] bg-[hsl(var(--expense)/0.1)]" :
                isDown ? "text-[hsl(var(--income))] bg-[hsl(var(--income)/0.1)]" :
                "text-muted-foreground bg-secondary"
              )}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {Math.abs(c.change).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
