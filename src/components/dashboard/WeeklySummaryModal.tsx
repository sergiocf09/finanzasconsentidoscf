import { useMemo } from "react";
import { Sparkles, CalendarDays } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { useTransactions } from "@/hooks/useTransactions";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { es } from "date-fns/locale";

interface WeeklySummaryModalProps {
  open: boolean;
  onClose: () => void;
  displayName: string;
}

export function WeeklySummaryModal({ open, onClose, displayName }: WeeklySummaryModalProps) {
  const now = new Date();
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const prevWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const twoWeeksStart = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
  const twoWeeksEnd = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });

  const { transactions: prevTxs } = useTransactions({ startDate: prevWeekStart, endDate: prevWeekEnd });
  const { transactions: twoWeeksTxs } = useTransactions({ startDate: twoWeeksStart, endDate: twoWeeksEnd });
  const { stage, signals, recommendations } = useFinancialIntelligence();

  const prevExpense = useMemo(() =>
    prevTxs.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [prevTxs]);
  const prevIncome = useMemo(() =>
    prevTxs.filter(t => t.type === "income").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [prevTxs]);
  const twoWeeksExpense = useMemo(() =>
    twoWeeksTxs.filter(t => t.type === "expense").reduce((s, t) => s + (t.amount_in_base ?? t.amount), 0), [twoWeeksTxs]);
  const prevBalance = prevIncome - prevExpense;
  const expenseDiff = twoWeeksExpense > 0 ? ((prevExpense - twoWeeksExpense) / twoWeeksExpense) * 100 : null;
  const prevWeekLabel = `${format(prevWeekStart, "d MMM", { locale: es })} – ${format(prevWeekEnd, "d MMM", { locale: es })}`;

  const weeklyTip = useMemo(() => {
    if (recommendations.length > 0) return recommendations[0].message;
    const positive = signals.find(s => s.type === "positive");
    if (positive) return positive.message;
    const fallbacks: Record<string, string> = {
      stabilize: "La semana que pasó ya es historia. Lo que registraste — aunque parezca poco — es información que te devuelve claridad. Esta semana, con más calma.",
      balance: "Terminaste la semana sosteniendo lo que importa. Ese equilibrio no es casualidad — es el resultado de pequeñas decisiones conscientes.",
      build: "Tu dinero siguió trabajando la semana pasada. Esta semana es buen momento para revisar si tus metas de Construcción avanzan como esperas.",
    };
    return fallbacks[stage] ?? fallbacks.stabilize;
  }, [recommendations, signals, stage]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <div className="space-y-5">
          {/* Header */}
          <div className="text-center space-y-1 pt-2">
            <div className="flex justify-center mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Hola, {displayName}</p>
            <h2 className="text-lg font-heading font-bold text-foreground">Tu semana anterior</h2>
            <p className="text-xs text-muted-foreground">{prevWeekLabel}</p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-income/5 border border-income/20 p-3 text-center space-y-1">
              <p className="text-[10px] text-muted-foreground">Entró</p>
              <p className="text-base font-bold text-income tabular-nums">{formatCurrency(prevIncome)}</p>
            </div>
            <div className="rounded-xl bg-expense/5 border border-expense/20 p-3 text-center space-y-1">
              <p className="text-[10px] text-muted-foreground">Gasté</p>
              <p className="text-base font-bold text-expense tabular-nums">{formatCurrency(prevExpense)}</p>
              {expenseDiff !== null && (
                <p className={cn("text-[10px] font-medium",
                  Math.abs(expenseDiff) < 2 ? "text-muted-foreground" :
                  expenseDiff < 0 ? "text-income" : "text-expense")}>
                  {expenseDiff < 0 ? "▼" : "▲"} {Math.abs(expenseDiff).toFixed(0)}% vs ant.
                </p>
              )}
            </div>
            <div className={cn("rounded-xl border p-3 text-center space-y-1",
              prevBalance >= 0 ? "bg-primary/5 border-primary/20" : "bg-expense/5 border-expense/20")}>
              <p className="text-[10px] text-muted-foreground">Balance</p>
              <p className={cn("text-base font-bold tabular-nums",
                prevBalance >= 0 ? "text-primary" : "text-expense")}>{formatCurrency(prevBalance)}</p>
            </div>
          </div>

          {/* Tip */}
          <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[11px] font-semibold text-primary">Para esta semana</p>
            </div>
            <p className="text-[12px] text-foreground leading-relaxed">{weeklyTip}</p>
          </div>

          {/* CTA */}
          <Button className="w-full" onClick={onClose}>
            Empezar la semana
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pb-1">
            Puedes revisarlo cuando quieras desde el inicio
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
