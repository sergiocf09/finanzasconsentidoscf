import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CreditCard, PiggyBank, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useDebts } from "@/hooks/useDebts";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useHideAmounts } from "@/hooks/useHideAmounts";

interface DueItem {
  id: string;
  name: string;
  day: number;
  nextDate: Date;
  daysLeft: number;
  amount: number | null;
  currency: string;
  type: "debt" | "goal";
  route: string;
}

function getNextOccurrence(day: number, today: Date): Date {
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = new Date(y, m, day);
  if (thisMonth >= today) return thisMonth;
  return new Date(y, m + 1, day);
}

export function UpcomingDueDates() {
  const navigate = useNavigate();
  const { debts } = useDebts();
  const { goals } = useSavingsGoals();
  const { mask } = useHideAmounts("balances");

  const items = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: DueItem[] = [];

    // Debts with due_day
    (debts ?? [])
      .filter(d => d.is_active && d.due_day)
      .forEach(d => {
        const next = getNextOccurrence(d.due_day!, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= 15) {
          result.push({
            id: d.id,
            name: d.name,
            day: d.due_day!,
            nextDate: next,
            daysLeft: diff,
            amount: d.minimum_payment || null,
            currency: d.currency,
            type: "debt",
            route: d.account_id ? `/accounts/${d.account_id}` : "/debts",
          });
        }
      });

    // Savings goals with contribution_day
    (goals ?? [])
      .filter(g => g.is_active && (g as any).contribution_day)
      .forEach(g => {
        const cDay = (g as any).contribution_day as number;
        const next = getNextOccurrence(cDay, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= 15) {
          result.push({
            id: g.id,
            name: g.name,
            day: cDay,
            nextDate: next,
            daysLeft: diff,
            amount: null,
            currency: "MXN",
            type: "goal",
            route: "/construction",
          });
        }
      });

    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [debts, goals]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-heading font-semibold text-foreground">Próximos vencimientos</h2>
      </div>

      <div className="space-y-1.5">
        {items.map(item => {
          const isUrgent = item.daysLeft <= 3;
          const Icon = item.type === "debt" ? CreditCard : PiggyBank;

          return (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors",
                isUrgent
                  ? "border-expense/30 bg-expense/5 hover:bg-expense/10"
                  : "border-border bg-card hover:bg-muted/50"
              )}
              onClick={() => navigate(item.route)}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                isUrgent ? "bg-expense/10" : "bg-primary/10"
              )}>
                <Icon className={cn("h-4 w-4", isUrgent ? "text-expense" : "text-primary")} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Día {item.day} · {item.daysLeft === 0 ? "Hoy" : item.daysLeft === 1 ? "Mañana" : `En ${item.daysLeft} días`}
                </p>
              </div>

              <div className="text-right shrink-0 flex items-center gap-1">
                {isUrgent && <AlertTriangle className="h-3 w-3 text-expense" />}
                {item.amount ? (
                  <span className={cn("text-xs font-semibold tabular-nums", isUrgent ? "text-expense" : "text-foreground")}>
                    {mask(formatCurrencyAbs(item.amount, item.currency))}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Aportación</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
