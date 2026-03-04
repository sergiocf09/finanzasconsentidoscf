import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";

interface BalanceCardProps {
  title: string;
  amount: number;
  currency?: string;
  type: "balance" | "income" | "expense" | "transfer";
  trend?: {
    value: number;
    label: string;
  };
}

export function BalanceCard({
  title,
  amount,
  currency = "MXN",
  type,
  trend,
}: BalanceCardProps) {
  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const Icon = type === "income" ? TrendingUp : type === "expense" ? TrendingDown : ArrowRightLeft;

  return (
    <div
      className={cn(
        "rounded-xl p-3 card-interactive",
        type === "balance" && "bg-primary text-primary-foreground",
        type === "income" && "bg-card border border-border",
        type === "expense" && "bg-card border border-border",
        type === "transfer" && "bg-card border border-border"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-0.5 min-w-0">
          <p
            className={cn(
              "text-[10px] font-medium truncate",
              type === "balance" ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-base font-bold font-heading tracking-tight leading-tight",
              type === "balance" && "text-primary-foreground",
              type === "income" && "text-income",
              type === "expense" && "text-expense",
              type === "transfer" && "text-transfer"
            )}
          >
            {type === "expense" && "-"}
            {formatAmount(amount)}
          </p>
        </div>

        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
            type === "balance" && "bg-primary-foreground/20",
            type === "income" && "bg-income/10",
            type === "expense" && "bg-expense/10",
            type === "transfer" && "bg-transfer/10"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              type === "balance" && "text-primary-foreground",
              type === "income" && "text-income",
              type === "expense" && "text-expense",
              type === "transfer" && "text-transfer"
            )}
          />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p
            className={cn(
              "text-xs",
              type === "balance" ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "font-medium",
                trend.value >= 0 ? "text-income" : "text-expense"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>{" "}
            {trend.label}
          </p>
        </div>
      )}
    </div>
  );
}
