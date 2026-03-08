import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface BudgetProgressProps {
  category: string;
  spent: number;
  budgeted: number;
  currency?: string;
  compact?: boolean;
}

export function BudgetProgress({
  category,
  spent,
  budgeted,
  currency = "MXN",
  compact = false,
}: BudgetProgressProps) {
  const percentage = budgeted > 0 ? Math.min((spent / budgeted) * 100, 120) : 0;
  const displayPercentage = Math.min(percentage, 100);
  const remaining = budgeted - spent;

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatus = (percent: number) => {
    if (percent > 100) return "over";
    if (percent >= 95) return "caution";
    if (percent >= 80) return "warning";
    return "safe";
  };

  const status = getStatus(percentage);

  const barColorClass = {
    safe: "[&>div]:bg-[hsl(var(--block-build))]",
    warning: "[&>div]:bg-[hsl(var(--block-lifestyle))]",
    caution: "[&>div]:bg-[hsl(var(--accent))]",
    over: "[&>div]:bg-[hsl(var(--status-danger))]",
  }[status];

  const textColorClass = {
    safe: "text-[hsl(var(--block-build))]",
    warning: "text-[hsl(var(--block-lifestyle))]",
    caution: "text-[hsl(var(--accent))]",
    over: "text-[hsl(var(--status-danger))]",
  }[status];

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate min-w-0">{category}</span>
          <span className={cn("text-xs font-medium whitespace-nowrap shrink-0", textColorClass)}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <Progress value={displayPercentage} className={cn("h-1.5", barColorClass)} />
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground truncate min-w-0">{category}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatAmount(spent)} / {formatAmount(budgeted)}
        </span>
      </div>

      <div className="relative">
        <Progress value={displayPercentage} className={cn("h-2", barColorClass)} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", textColorClass)}>
          {percentage.toFixed(0)}% usado
        </span>
        <span className="text-muted-foreground whitespace-nowrap">
          {remaining > 0 ? `Quedan ${formatAmount(remaining)}` : remaining === 0 ? "Justo en presupuesto" : `Excedido ${formatAmount(Math.abs(remaining))}`}
        </span>
      </div>
    </div>
  );
}
