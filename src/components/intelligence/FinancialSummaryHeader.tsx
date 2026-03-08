import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialSummaryHeaderProps {
  income: number;
  expense: number;
  balance: number;
  prevIncome: number;
  prevExpense: number;
  formatAmount: (v: number) => string;
}

export function FinancialSummaryHeader({ income, expense, balance, prevIncome, prevExpense, formatAmount }: FinancialSummaryHeaderProps) {
  const incomeChange = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;
  const expenseChange = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

  return (
    <div className="grid gap-3 grid-cols-3">
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--income)/0.1)]">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--income))]" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Ingresos</p>
        <p className="text-base font-bold font-heading text-[hsl(var(--income))] tabular-nums">{formatAmount(income)}</p>
        {prevIncome > 0 && (
          <p className={cn("text-[10px] mt-0.5", incomeChange >= 0 ? "text-[hsl(var(--income))]" : "text-[hsl(var(--expense))]")}>
            {incomeChange >= 0 ? "+" : ""}{incomeChange.toFixed(0)}% vs anterior
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--expense)/0.1)]">
            <TrendingDown className="h-4 w-4 text-[hsl(var(--expense))]" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Gastos</p>
        <p className="text-base font-bold font-heading text-[hsl(var(--expense))] tabular-nums">{formatAmount(expense)}</p>
        {prevExpense > 0 && (
          <p className={cn("text-[10px] mt-0.5", expenseChange <= 0 ? "text-[hsl(var(--income))]" : "text-[hsl(var(--expense))]")}>
            {expenseChange >= 0 ? "+" : ""}{expenseChange.toFixed(0)}% vs anterior
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Balance</p>
        <p className={cn("text-base font-bold font-heading tabular-nums", balance >= 0 ? "text-primary" : "text-[hsl(var(--expense))]")}>
          {formatAmount(balance)}
        </p>
      </div>
    </div>
  );
}
