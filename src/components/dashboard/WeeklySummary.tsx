import { useMemo } from "react";
import { CalendarDays, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useTransactions } from "@/hooks/useTransactions";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";

export function WeeklySummary({ onOpenModal }: { onOpenModal: () => void }) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const { transactions: weekTxs } = useTransactions({ startDate: weekStart, endDate: weekEnd });
  const { transactions: prevWeekTxs } = useTransactions({ startDate: prevWeekStart, endDate: prevWeekEnd });

  const weekExpense = useMemo(() =>
    weekTxs.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [weekTxs]);
  const weekIncome = useMemo(() =>
    weekTxs.filter(t => t.type === "income").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [weekTxs]);
  const prevWeekExpense = useMemo(() =>
    prevWeekTxs.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [prevWeekTxs]);

  const expenseDiff = prevWeekExpense > 0 ? ((weekExpense - prevWeekExpense) / prevWeekExpense) * 100 : null;
  const txCount = weekTxs.filter(t => t.type !== "transfer").length;
  const weekLabel = `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM", { locale: es })}`;
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-heading font-semibold text-foreground">Esta semana</p>
            <p className="text-[10px] text-muted-foreground">{weekLabel}</p>
          </div>
        </div>
        <button
          onClick={onOpenModal}
          className="text-[10px] text-primary font-medium hover:underline"
        >
          Ver semana anterior →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-income/5 border border-income/15 p-2.5 space-y-0.5">
          <p className="text-[10px] text-muted-foreground">Ingresos</p>
          <p className="text-sm font-bold tabular-nums text-income">{formatCurrency(weekIncome)}</p>
          <p className="text-[10px] text-muted-foreground">esta semana</p>
        </div>
        <div className="rounded-xl bg-expense/5 border border-expense/15 p-2.5 space-y-0.5">
          <p className="text-[10px] text-muted-foreground">Gastos</p>
          <p className="text-sm font-bold tabular-nums text-expense">{formatCurrency(weekExpense)}</p>
          {expenseDiff !== null && (
            <p className={cn("text-[10px] font-medium flex items-center gap-0.5",
              Math.abs(expenseDiff) < 2 ? "text-muted-foreground" :
              expenseDiff < 0 ? "text-income" : "text-expense")}>
              {Math.abs(expenseDiff) < 2 ? <Minus className="h-2.5 w-2.5" /> :
               expenseDiff < 0 ? <TrendingDown className="h-2.5 w-2.5" /> :
               <TrendingUp className="h-2.5 w-2.5" />}
              {Math.abs(expenseDiff) < 2 ? "Similar" : `${Math.abs(expenseDiff).toFixed(0)}% vs ant.`}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-secondary p-2.5 space-y-0.5">
          <p className="text-[10px] text-muted-foreground">Registros</p>
          <p className="text-sm font-bold tabular-nums text-foreground">{txCount}</p>
          <p className="text-[10px] text-muted-foreground">día {dayOfWeek} de 7</p>
        </div>
      </div>
    </div>
  );
}
