import { useState } from "react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { Sparkles, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type PeriodKey = "current" | "previous" | "last3";

const periodLabels: Record<PeriodKey, string> = {
  current: "Mes en curso",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
};

function getDateRange(period: PeriodKey): { startDate: Date; endDate: Date } {
  const now = new Date();
  switch (period) {
    case "previous":
      return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { budgets } = useBudgets();
  const displayName = profile?.display_name || "bienvenido";

  const [period, setPeriod] = useState<PeriodKey>("current");
  const { startDate, endDate } = getDateRange(period);
  const { totals } = useTransactions({ startDate, endDate });

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const activeBudgets = budgets.filter((b) => b.is_active);

  return (
    <div className="space-y-4 stagger-children">
      {/* Welcome — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <h1 className="text-lg font-heading font-semibold text-foreground">Hola, {displayName} 👋</h1>
      </div>

      {/* Financial summary: two-column asset/liability cards */}
      <FinancialSummaryCards />

      {/* Period selector + I/G/T block */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-semibold text-foreground">Actividad</h2>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-7 w-auto gap-1 text-xs border-none bg-muted/50 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 grid-cols-3">
          <div className="cursor-pointer" onClick={() => navigate("/transactions?type=income")}>
            <BalanceCard title="Ingresos" amount={totals.income} type="income" />
          </div>
          <div className="cursor-pointer" onClick={() => navigate("/transactions?type=expense")}>
            <BalanceCard title="Gastos" amount={totals.expense} type="expense" />
          </div>
          <div className="cursor-pointer" onClick={() => navigate("/transfers")}>
            <BalanceCard title="Transferencias" amount={totals.transfer} type="transfer" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-heading font-semibold text-foreground">Acciones rápidas</h2>
        <QuickActions />
      </div>

      {/* Two Column */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-heading font-semibold text-foreground">Presupuesto del mes</h2>
            <span className="text-[10px] text-muted-foreground">{capitalizedMonth}</span>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 space-y-4 card-elevated">
            {activeBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin presupuestos activos.</p>
            ) : (
              activeBudgets.slice(0, 4).map((budget) => (
                <BudgetProgress key={budget.id} category={budget.name} spent={budget.spent ?? 0} budgeted={budget.amount} />
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-heading font-semibold text-foreground">Movimientos recientes</h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <RecentTransactions />
        </div>
      </div>

      {/* Voice Tip */}
      <div className="rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Registra con tu voz</p>
            <p className="text-xs text-muted-foreground break-words">
              Toca el micrófono y di: "900 pesos gasolina HSBC".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
