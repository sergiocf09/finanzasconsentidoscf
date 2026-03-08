import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { BudgetBlockInsights } from "./BudgetBlockInsights";
import type { FinancialSignal, Recommendation } from "@/hooks/useFinancialIntelligence";

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category_id: string | null;
}

interface BudgetBlockCardProps {
  block: "stability" | "lifestyle" | "build";
  label: string;
  emoji: string;
  items: BudgetItem[];
  onDeleteBudget: (id: string) => void;
  onCategoryClick?: (item: BudgetItem) => void;
  currency?: string;
  signals?: FinancialSignal[];
  recommendations?: Recommendation[];
}

const blockColorMap = {
  stability: {
    bg: "bg-[hsl(var(--block-stability)/0.08)]",
    border: "border-[hsl(var(--block-stability)/0.2)]",
    text: "text-[hsl(var(--block-stability))]",
    bar: "[&>div]:bg-[hsl(var(--block-stability))]",
    dot: "bg-[hsl(var(--block-stability))]",
  },
  lifestyle: {
    bg: "bg-[hsl(var(--block-lifestyle)/0.08)]",
    border: "border-[hsl(var(--block-lifestyle)/0.2)]",
    text: "text-[hsl(var(--block-lifestyle))]",
    bar: "[&>div]:bg-[hsl(var(--block-lifestyle))]",
    dot: "bg-[hsl(var(--block-lifestyle))]",
  },
  build: {
    bg: "bg-[hsl(var(--block-build)/0.08)]",
    border: "border-[hsl(var(--block-build)/0.2)]",
    text: "text-[hsl(var(--block-build))]",
    bar: "[&>div]:bg-[hsl(var(--block-build))]",
    dot: "bg-[hsl(var(--block-build))]",
  },
};

export function BudgetBlockCard({
  block,
  label,
  emoji,
  items,
  onDeleteBudget,
  onCategoryClick,
  currency = "MXN",
  signals = [],
  recommendations = [],
}: BudgetBlockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = blockColorMap[block];

  const totalPlanned = items.reduce((s, b) => s + b.amount, 0);
  const totalSpent = items.reduce((s, b) => s + (b.spent ?? 0), 0);
  const percentage = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
  const remaining = totalPlanned - totalSpent;

  const fmt = (v: number) => formatCurrency(v, currency);

  const getBarStatus = (pct: number) => {
    if (pct > 100) return "[&>div]:bg-[hsl(var(--status-danger))]";
    if (pct >= 95) return "[&>div]:bg-[hsl(var(--accent))]";
    if (pct >= 80) return "[&>div]:bg-[hsl(var(--block-lifestyle))]";
    return colors.bar;
  };

  return (
    <div className={cn("rounded-2xl border transition-all duration-200", colors.bg, colors.border)}>
      {/* Block Header */}
      <button
        className="w-full p-4 flex items-center gap-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-heading font-semibold text-foreground text-sm">{label}</h3>
            <span className={cn("text-xs font-medium shrink-0", colors.text)}>
              {percentage.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={Math.min(percentage, 100)}
            className={cn("h-1.5", getBarStatus(percentage))}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-muted-foreground">
              {fmt(totalSpent)} / {fmt(totalPlanned)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {remaining > 0 ? `Quedan ${fmt(remaining)}` : remaining < 0 ? `Excedido ${fmt(Math.abs(remaining))}` : ""}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded Categories */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 animate-fade-in-up">
          <div className="border-t border-border/50 pt-3" />
          <BudgetBlockInsights block={block} signals={signals} recommendations={recommendations} />
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sin presupuestos en este bloque
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl bg-card border border-border p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => onCategoryClick?.(item)}
              >
                <div className={cn("w-1.5 h-8 rounded-full shrink-0", colors.dot)} />
                <div className="flex-1 min-w-0">
                  <BudgetProgress
                    category={item.name}
                    spent={item.spent ?? 0}
                    budgeted={item.amount}
                    currency={currency}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBudget(item.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
