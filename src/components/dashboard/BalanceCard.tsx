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
        "rounded-xl p-2.5 card-interactive overflow-hidden",
        type === "balance" && "bg-primary text-primary-foreground",
        type === "income" && "bg-card border border-border",
        type === "expense" && "bg-card border border-border",
        type === "transfer" && "bg-card border border-border"
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <p
          className={cn(
            "text-[10px] font-medium truncate",
            type === "balance" ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          {title}
        </p>
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
            type === "balance" && "bg-primary-foreground/20",
            type === "income" && "bg-income/10",
            type === "expense" && "bg-expense/10",
            type === "transfer" && "bg-transfer/10"
          )}
        >
          <Icon
            className={cn(
              "h-3 w-3",
              type === "balance" && "text-primary-foreground",
              type === "income" && "text-income",
              type === "expense" && "text-expense",
              type === "transfer" && "text-transfer"
            )}
          />
        </div>
      </div>
      <p
        className={cn(
          "text-xs font-bold font-heading tracking-tight leading-tight",
          type === "balance" && "text-primary-foreground",
          type === "income" && "text-income",
          type === "expense" && "text-expense",
          type === "transfer" && "text-transfer"
        )}
      >
        {type === "expense" && "-"}
        {formatAmount(amount)}
      </p>

      {trend && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p
            className={cn(
              "text-[10px]",
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
