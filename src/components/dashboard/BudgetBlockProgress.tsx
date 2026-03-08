import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Progress } from "@/components/ui/progress";
import type { BlockSummary } from "@/hooks/useFinancialIntelligence";

interface BudgetBlockProgressProps {
  blockSummaries: Record<string, BlockSummary>;
  totalBudgeted: number;
  totalSpent: number;
}

const BLOCK_CONFIG = [
  { key: "stability", emoji: "🔵", barColor: "[&>div]:bg-[hsl(var(--block-stability))]", textColor: "text-[hsl(var(--block-stability))]" },
  { key: "lifestyle", emoji: "🟡", barColor: "[&>div]:bg-[hsl(var(--block-lifestyle))]", textColor: "text-[hsl(var(--block-lifestyle))]" },
  { key: "build", emoji: "🟢", barColor: "[&>div]:bg-[hsl(var(--block-build))]", textColor: "text-[hsl(var(--block-build))]" },
];

export function BudgetBlockProgress({ blockSummaries, totalBudgeted, totalSpent }: BudgetBlockProgressProps) {
  const totalPct = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0;

  const getBarStatus = (pct: number) => {
    if (pct > 100) return "[&>div]:bg-[hsl(var(--status-danger))]";
    if (pct >= 95) return "[&>div]:bg-[hsl(var(--accent))]";
    if (pct >= 80) return "[&>div]:bg-[hsl(var(--block-lifestyle))]";
    return "[&>div]:bg-[hsl(var(--block-build))]";
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-foreground">Avance del presupuesto</h3>
        <span className="text-xs font-semibold text-foreground tabular-nums">{totalPct.toFixed(0)}%</span>
      </div>

      {/* Global bar */}
      <div className="space-y-1">
        <Progress value={totalPct} className={cn("h-2.5 rounded-full", getBarStatus(totalPct))} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatCurrency(totalSpent)} gastado</span>
          <span>{formatCurrency(totalBudgeted)} presupuestado</span>
        </div>
      </div>

      {/* Per-block bars */}
      <div className="space-y-2.5 pt-1">
        {BLOCK_CONFIG.map(({ key, emoji, barColor, textColor }) => {
          const block = blockSummaries[key];
          if (!block || block.budgeted === 0) return null;
          const pct = Math.min(block.budgetPercent, 120);
          const displayPct = Math.min(pct, 100);
          const isOver = pct > 100;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {emoji} {block.label}
                </span>
                <span className={cn("text-[10px] font-semibold tabular-nums", isOver ? "text-[hsl(var(--status-danger))]" : textColor)}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <Progress value={displayPct} className={cn("h-1.5", isOver ? "[&>div]:bg-[hsl(var(--status-danger))]" : barColor)} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatCurrency(block.amount)}</span>
                <span>{formatCurrency(block.budgeted)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
