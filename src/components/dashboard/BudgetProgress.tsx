import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface BudgetProgressProps {
  category: string;
  spent: number;
  budgeted: number;
  currency?: string;
}

export function BudgetProgress({
  category,
  spent,
  budgeted,
  currency = "MXN",
}: BudgetProgressProps) {
  const percentage = Math.min((spent / budgeted) * 100, 100);
  const remaining = budgeted - spent;

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "over";
    if (percent >= 80) return "warning";
    return "safe";
  };

  const status = getStatusColor(percentage);

  return (
    <div className="space-y-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground truncate min-w-0">{category}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatAmount(spent)} / {formatAmount(budgeted)}
        </span>
      </div>

      <div className="relative">
        <Progress
          value={percentage}
          className={cn(
            "h-2",
            status === "safe" && "[&>div]:bg-[hsl(var(--block-build))]",
            status === "warning" && "[&>div]:bg-[hsl(var(--block-lifestyle))]",
            status === "over" && "[&>div]:bg-[hsl(var(--status-danger))]"
          )}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            status === "safe" && "text-[hsl(var(--block-build))]",
            status === "warning" && "text-[hsl(var(--block-lifestyle))]",
            status === "over" && "text-[hsl(var(--status-danger))]"
          )}
        >
          {percentage.toFixed(0)}% usado
        </span>
        <span className="text-muted-foreground whitespace-nowrap">
          {remaining > 0 ? `Quedan ${formatAmount(remaining)}` : "Sin saldo"}
        </span>
      </div>
    </div>
  );
}
