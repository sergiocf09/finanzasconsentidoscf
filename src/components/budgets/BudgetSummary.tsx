import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface BudgetSummaryProps {
  totalBudgeted: number;
  totalSpent: number;
  currency?: string;
}

export function BudgetSummary({ totalBudgeted, totalSpent, currency = "MXN" }: BudgetSummaryProps) {
  const percentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const remaining = totalBudgeted - totalSpent;

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const getStatus = (pct: number) => {
    if (pct > 100) return "over";
    if (pct >= 95) return "caution";
    if (pct >= 80) return "warning";
    return "safe";
  };

  const status = getStatus(percentage);

  const barBg = {
    safe: "bg-[hsl(var(--block-build))]",
    warning: "bg-[hsl(var(--block-lifestyle))]",
    caution: "bg-[hsl(var(--accent))]",
    over: "bg-[hsl(var(--status-danger))]",
  }[status];

  if (totalBudgeted <= 0) return null;

  return (
    <div className="rounded-2xl bg-primary p-4 text-primary-foreground card-elevated animate-fade-in-up">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-primary-foreground/80">Presupuesto del mes</p>
          <p className="text-xl font-bold font-heading mt-1 truncate">
            {fmt(totalSpent)} / {fmt(totalBudgeted)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold font-heading">{percentage.toFixed(0)}%</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barBg)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {remaining > 0 && (
        <p className="text-xs text-primary-foreground/70 mt-2">Te quedan {fmt(remaining)} este mes</p>
      )}
      {remaining < 0 && (
        <p className="text-xs text-primary-foreground/70 mt-2">Excedido por {fmt(Math.abs(remaining))}</p>
      )}
    </div>
  );
}
