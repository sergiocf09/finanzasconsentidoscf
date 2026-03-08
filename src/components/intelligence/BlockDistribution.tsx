import type { BlockSummary } from "@/hooks/useFinancialIntelligence";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const blockColors: Record<string, { bar: string; text: string; bg: string }> = {
  stability: { bar: "bg-[hsl(var(--block-stability))]", text: "text-[hsl(var(--block-stability))]", bg: "bg-[hsl(var(--block-stability)/0.1)]" },
  lifestyle: { bar: "bg-[hsl(var(--block-lifestyle))]", text: "text-[hsl(var(--block-lifestyle))]", bg: "bg-[hsl(var(--block-lifestyle)/0.1)]" },
  build: { bar: "bg-[hsl(var(--block-build))]", text: "text-[hsl(var(--block-build))]", bg: "bg-[hsl(var(--block-build)/0.1)]" },
};

interface BlockDistributionProps {
  blocks: Record<string, BlockSummary>;
  totalExpense: number;
  formatAmount: (v: number) => string;
}

export function BlockDistribution({ blocks, totalExpense, formatAmount }: BlockDistributionProps) {
  const entries = [
    { key: "stability", ...blocks.stability },
    { key: "lifestyle", ...blocks.lifestyle },
    { key: "build", ...blocks.build },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-heading font-semibold text-sm">Distribución por bloques</h3>

      {/* Stacked bar */}
      {totalExpense > 0 && (
        <div className="h-5 rounded-full overflow-hidden flex">
          {entries.map((e) => (
            <div
              key={e.key}
              className={cn(blockColors[e.key].bar, "transition-all")}
              style={{ width: `${e.percent}%` }}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded-full", blockColors[e.key].bar)} />
              <span className="text-sm">{e.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">{e.percent.toFixed(0)}%</span>
              <span className="text-sm font-medium tabular-nums">{formatAmount(e.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
