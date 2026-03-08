import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers } from "@/hooks/useTransfers";
import { useHideAmounts } from "@/hooks/useHideAmounts";

export function PeriodSummaryCards() {
  const navigate = useNavigate();
  const { totals } = useTransactions();
  const { totalTransferAmount } = useTransfers();
  const { mask } = useHideAmounts();

  const cards = [
    {
      label: "Ingresos",
      amount: totals.income,
      icon: TrendingUp,
      color: "income" as const,
    },
    {
      label: "Gastos",
      amount: totals.expense,
      icon: TrendingDown,
      color: "expense" as const,
    },
    {
      label: "Transferencias",
      amount: totalTransferAmount,
      icon: ArrowRightLeft,
      color: "transfer" as const,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => navigate("/transactions")}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-all card-interactive",
            card.color === "income" && "bg-income/5 hover:bg-income/10",
            card.color === "expense" && "bg-expense/5 hover:bg-expense/10",
            card.color === "transfer" && "bg-transfer/5 hover:bg-transfer/10"
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              card.color === "income" && "bg-income/10",
              card.color === "expense" && "bg-expense/10",
              card.color === "transfer" && "bg-transfer/10"
            )}
          >
            <card.icon
              className={cn(
                "h-5 w-5",
                card.color === "income" && "text-income",
                card.color === "expense" && "text-expense",
                card.color === "transfer" && "text-transfer"
              )}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{card.label}</span>
          <span
            className={cn(
              "text-sm font-bold font-heading tabular-nums leading-tight",
              card.color === "income" && "text-income",
              card.color === "expense" && "text-expense",
              card.color === "transfer" && "text-transfer"
            )}
          >
            {mask(formatCurrencyAbs(card.amount))}
          </span>
        </button>
      ))}
    </div>
  );
}
