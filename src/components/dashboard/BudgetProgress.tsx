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
    if (percent >= 100) return "danger";
    if (percent >= 80) return "warning";
    return "safe";
  };

  const status = getStatusColor(percentage);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{category}</span>
        <span className="text-xs text-muted-foreground">
          {formatAmount(spent)} / {formatAmount(budgeted)}
        </span>
      </div>

      <div className="relative">
        <Progress
          value={percentage}
          className={cn(
            "h-2",
            status === "safe" && "[&>div]:bg-status-safe",
            status === "warning" && "[&>div]:bg-status-warning",
            status === "danger" && "[&>div]:bg-status-danger"
          )}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            status === "safe" && "text-status-safe",
            status === "warning" && "text-status-warning",
            status === "danger" && "text-status-danger"
          )}
        >
          {percentage.toFixed(0)}% usado
        </span>
        <span className="text-muted-foreground">
          {remaining > 0 ? `Quedan ${formatAmount(remaining)}` : "Sin saldo"}
        </span>
      </div>
    </div>
  );
}
