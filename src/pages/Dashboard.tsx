import { useState } from "react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FinancialSummaryCards } from "@/components/dashboard/FinancialSummaryCards";
import { Sparkles, Brain, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers } from "@/hooks/useTransfers";
import { useBudgets } from "@/hooks/useBudgets";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

type PeriodKey = "current" | "previous" | "last3" | "custom";

const periodLabels: Record<PeriodKey, string> = {
  current: "Mes en curso",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  custom: "Rango personalizado",
};

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  switch (period) {
    case "previous":
      return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case "custom":
      return {
        startDate: customStart ? new Date(customStart + "T00:00:00") : startOfMonth(now),
        endDate: customEnd ? new Date(customEnd + "T23:59:59") : endOfMonth(now),
      };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { budgets } = useBudgets();
  const { signals } = useFinancialIntelligence();
  const displayName = profile?.display_name || "bienvenido";

  const [period, setPeriod] = useState<PeriodKey>("current");
  const [customStart, setCustomStart] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const { startDate, endDate } = getDateRange(period, customStart, customEnd);
  const { totals } = useTransactions({ startDate, endDate });
  const { totalTransferAmount } = useTransfers(undefined, { startDate, endDate });

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const activeBudgets = budgets.filter((b) => b.is_active);

  const handlePeriodChange = (v: string) => {
    const key = v as PeriodKey;
    setPeriod(key);
    if (key === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  };

  const customLabel = period === "custom"
    ? `${format(new Date(customStart + "T12:00:00"), "d MMM", { locale: es })} – ${format(new Date(customEnd + "T12:00:00"), "d MMM", { locale: es })}`
    : null;

  return (
    <div className="space-y-4 stagger-children overflow-x-hidden">
      {/* Welcome */}
      <div className="pb-1">
        <h1 className="text-lg font-heading font-semibold text-foreground">Hola, {displayName} 👋</h1>
      </div>

      {/* Financial summary */}
      <FinancialSummaryCards />

      {/* Period selector + I/G/T block */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-heading font-semibold text-foreground shrink-0">Actividad</h2>
          <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
            <div className="flex items-center gap-1">
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-7 w-auto gap-1 text-xs border-none bg-muted/50 px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === "custom" && (
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary px-1.5">
                    {customLabel}
                  </Button>
                </PopoverTrigger>
              )}
            </div>
            <PopoverContent className="w-auto p-3 space-y-3" align="end">
              <p className="text-xs font-medium text-foreground">Selecciona un rango</p>
              <div className="flex items-center gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Desde</label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 text-xs w-[130px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Hasta</label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 text-xs w-[130px]"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => setShowCustomPicker(false)}
              >
                Aplicar
              </Button>
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid gap-2 grid-cols-3">
          <div className="cursor-pointer" onClick={() => navigate("/transactions?type=income")}>
            <BalanceCard title="Ingresos" amount={totals.income} type="income" />
          </div>
          <div className="cursor-pointer" onClick={() => navigate("/transactions?type=expense")}>
            <BalanceCard title="Gastos" amount={totals.expense} type="expense" />
          </div>
        <div className="cursor-pointer" onClick={() => navigate("/transactions?type=transfer")}>
            <BalanceCard title="Transferencias" amount={totalTransferAmount} type="transfer" />
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

      {/* Financial Signals */}
      {signals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-heading font-semibold text-foreground">Señales del mes</h2>
            </div>
            <Link to="/intelligence" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
              Ver más <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {signals.slice(0, 3).map((s) => {
              const isPositive = s.type === "positive";
              const isAttention = s.type === "attention";
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex gap-3 rounded-xl p-3 border",
                    isPositive && "bg-[hsl(var(--income)/0.06)] border-[hsl(var(--income)/0.15)]",
                    isAttention && "bg-[hsl(var(--status-warning)/0.06)] border-[hsl(var(--status-warning)/0.15)]",
                    !isPositive && !isAttention && "bg-[hsl(var(--transfer)/0.06)] border-[hsl(var(--transfer)/0.15)]"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isPositive && "bg-[hsl(var(--income)/0.12)]",
                    isAttention && "bg-[hsl(var(--status-warning)/0.12)]",
                    !isPositive && !isAttention && "bg-[hsl(var(--transfer)/0.12)]"
                  )}>
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4 text-[hsl(var(--income))]" />
                    ) : (
                      <AlertCircle className={cn("h-4 w-4", isAttention ? "text-[hsl(var(--status-warning))]" : "text-[hsl(var(--transfer))]")} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
