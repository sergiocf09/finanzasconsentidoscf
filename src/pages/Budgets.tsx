import { useState, useEffect, useMemo } from "react";
import { Plus, Activity, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Copy, Eye, BarChart2, TrendingUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useDiagnostic } from "@/hooks/useDiagnostic";
import { useFinancialIntelligence } from "@/hooks/useFinancialIntelligence";
import { useTransactions } from "@/hooks/useTransactions";
import { BudgetSummary } from "@/components/budgets/BudgetSummary";
import { BudgetBlockCard } from "@/components/budgets/BudgetBlockCard";
import { BudgetCategoryDetail } from "@/components/budgets/BudgetCategoryDetail";
import { BudgetCreationWizard } from "@/components/budgets/BudgetCreationWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Progress } from "@/components/ui/progress";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const blockConfig = {
  stability: { label: "Estabilidad", emoji: "🔵" },
  lifestyle: { label: "Calidad de vida", emoji: "🟡" },
  build: { label: "Construcción", emoji: "🟢" },
};

const monthNames = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function Budgets() {
  const { user } = useAuth();
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const { budgets, incomeBudgets, isLoading, totalBudgeted, totalSpent, totalIncomeExpected, totalIncomeReceived, deleteBudget, updateBudget } =
    useBudgets(currentYear, currentMonth);
  const { categories } = useCategories();
  const { signals, recommendations } = useFinancialIntelligence();

  // Fetch transactions for the current budget period
  const periodStart = useMemo(() => new Date(currentYear, currentMonth - 1, 1), [currentYear, currentMonth]);
  const periodEnd = useMemo(() => endOfMonth(periodStart), [periodStart]);
  const { transactions: monthTransactions } = useTransactions({
    startDate: periodStart,
    endDate: periodEnd,
    enabled: !isLoading && budgets.length > 0,
  });

  // Compute unbudgeted expenses
  const budgetedCategoryIds = useMemo(
    () => new Set(budgets.filter(b => b.category_id).map(b => b.category_id!)),
    [budgets]
  );

  const unbudgetedExpenses = useMemo(() => {
    const expenseTxs = monthTransactions.filter(tx => tx.type === "expense" && tx.category_id && !budgetedCategoryIds.has(tx.category_id));
    const byCat: Record<string, { name: string; total: number }> = {};
    expenseTxs.forEach(tx => {
      const catId = tx.category_id!;
      if (!byCat[catId]) {
        const cat = categories.find(c => c.id === catId);
        byCat[catId] = { name: cat?.name || "Sin categoría", total: 0 };
      }
      byCat[catId].total += (tx.amount_in_base ?? tx.amount);
    });
    return Object.entries(byCat).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total);
  }, [monthTransactions, budgetedCategoryIds, categories]);

  const unbudgetedTotal = unbudgetedExpenses.reduce((s, e) => s + e.total, 0);
  const adjustedTotalSpent = totalSpent + unbudgetedTotal;
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailBudget, setDetailBudget] = useState<{
    id: string;
    name: string;
    amount: number;
    spent: number;
    category_id: string | null;
  } | null>(null);

  // Previous month budget check for suggestion banner
  const [prevMonthHasBudgets, setPrevMonthHasBudgets] = useState(false);
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const { budgets: prevBudgets } = useBudgets(prevYear, prevMonth);

  useEffect(() => {
    if (!user) return;
    const checkPrev = async () => {
      const { count } = await supabase
        .from("budgets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("year", prevYear)
        .eq("month", prevMonth)
        .eq("is_active", true);
      setPrevMonthHasBudgets((count ?? 0) > 0);
    };
    checkPrev();
  }, [user, currentYear, currentMonth, prevYear, prevMonth]);

  // Period navigation
  const goNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // Group budgets by block
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const getBucket = (categoryId: string | null) => {
    if (!categoryId) return null;
    const cat = catMap.get(categoryId);
    return (cat as any)?.bucket || null;
  };

  const budgetsByBlock = {
    stability: budgets.filter((b) => getBucket(b.category_id) === "stability"),
    lifestyle: budgets.filter((b) => getBucket(b.category_id) === "lifestyle"),
    build: budgets.filter((b) => getBucket(b.category_id) === "build"),
    unassigned: budgets.filter((b) => !b.category_id || !getBucket(b.category_id)),
  };

  const blockComparison = useMemo(() => {
    if (!prevMonthHasBudgets || budgets.length === 0) return null;
    return (["stability", "lifestyle", "build"] as const).map((block) => {
      const currentSpent = budgetsByBlock[block].reduce((s, b) => s + (b.spent ?? 0), 0);
      const prevSpent = prevBudgets
        .filter((b) => getBucket(b.category_id) === block)
        .reduce((s, b) => s + (b.spent ?? 0), 0);
      const spentDiff = prevSpent > 0 ? ((currentSpent - prevSpent) / prevSpent) * 100 : null;
      return { block, label: blockConfig[block].label, emoji: blockConfig[block].emoji, currentSpent, prevSpent, spentDiff };
    });
  }, [budgets, prevBudgets, budgetsByBlock, prevMonthHasBudgets]);

  const mapBudgetItems = (items: typeof budgets) =>
    items.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      spent: b.spent ?? 0,
      category_id: b.category_id,
    }));

  const handleUpdateAmount = (id: string, amount: number) => {
    updateBudget.mutate({ id, amount });
  };

  return (
    <div className="space-y-5 overflow-x-hidden">
      {/* Header with Period Selector */}
      <div className="pb-1">
        <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-heading font-semibold text-foreground shrink-0">
              Presupuestos
            </h1>
          <Button
            size="sm"
            className="gap-1 h-8 text-xs px-3"
            onClick={() => setWizardOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Crear
          </Button>
        </div>

        {/* Period Navigation */}
        <div className="flex items-center justify-center gap-3 mt-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-heading font-semibold text-foreground min-w-[140px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Income budgets section */}
      {!isLoading && incomeBudgets.length > 0 && (
        <div className="rounded-2xl border border-income/20 bg-income/5 p-4 space-y-3 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-income shrink-0" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Ingresos esperados del mes</h3>
          </div>

          <div className="space-y-2">
            {incomeBudgets.map((b) => {
              const pct = b.amount > 0 ? Math.min(Math.round((b.spent / b.amount) * 100), 150) : 0;
              const isComplete = pct >= 100;
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate">{b.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="tabular-nums text-muted-foreground">{formatCurrency(b.spent)}</span>
                      <span className="text-muted-foreground/60">/</span>
                      <span className="tabular-nums font-medium">{formatCurrency(b.amount)}</span>
                      {isComplete && <Check className="h-3.5 w-3.5 text-income" />}
                    </div>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className="h-2 bg-income/10"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-income/20 text-xs">
            <span className="font-semibold text-foreground">Total esperado</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-bold text-foreground">{formatCurrency(totalIncomeExpected)}</span>
              <span className="text-muted-foreground">Recibido</span>
              <span className={cn("tabular-nums font-bold", totalIncomeReceived >= totalIncomeExpected ? "text-income" : "text-foreground")}>
                {formatCurrency(totalIncomeReceived)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {isLoading ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : (
        <BudgetSummary totalBudgeted={totalBudgeted} totalSpent={adjustedTotalSpent} />
      )}

      {/* Comparativa vs mes anterior */}
      {!isLoading && blockComparison && budgets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-heading font-semibold text-foreground">
              vs {monthNames[prevMonth]} {prevYear}
            </h3>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-[10px] text-muted-foreground font-medium px-1">
            <span>Bloque</span>
            <span className="text-right min-w-[70px]">Actual</span>
            <span className="text-right min-w-[70px]">Anterior</span>
          </div>

          {/* Table rows */}
          <div className="space-y-1">
            {blockComparison.map(({ block, label, emoji, currentSpent, prevSpent, spentDiff }) => (
              <div key={block} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center rounded-lg bg-secondary/40 px-2.5 py-2">
                <span className="text-xs font-medium text-foreground">{emoji} {label}</span>
                <span className="text-xs font-bold tabular-nums text-foreground text-right min-w-[70px]">
                  {formatCurrency(currentSpent)}
                </span>
                <div className="text-right min-w-[70px]">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {prevSpent > 0 ? formatCurrency(prevSpent) : "—"}
                  </span>
                  {spentDiff !== null && prevSpent > 0 && (
                    <p className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      Math.abs(spentDiff) < 1 ? "text-muted-foreground" :
                      spentDiff < 0 ? "text-income" : "text-expense"
                    )}>
                      {Math.abs(spentDiff) < 1 ? "=" :
                       spentDiff < 0 ? `▼${Math.abs(spentDiff).toFixed(0)}%` : `▲${spentDiff.toFixed(0)}%`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const totalCurrent = blockComparison.reduce((s, b) => s + b.currentSpent, 0);
            const totalPrev = blockComparison.reduce((s, b) => s + b.prevSpent, 0);
            const totalDiff = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : null;
            return (
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center pt-2 border-t border-border px-1">
                <span className="text-[11px] font-semibold text-foreground">Gasto acumulado</span>
                <span className="text-xs font-bold tabular-nums text-foreground text-right min-w-[70px]">
                  {formatCurrency(totalCurrent)}
                </span>
                <div className="text-right min-w-[70px]">
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {totalPrev > 0 ? formatCurrency(totalPrev) : "—"}
                  </span>
                  {totalDiff !== null && (
                    <p className={cn(
                      "text-[10px] font-semibold tabular-nums",
                      Math.abs(totalDiff) < 1 ? "text-muted-foreground" :
                      totalDiff < 0 ? "text-income" : "text-expense"
                    )}>
                      {totalDiff > 0 ? "+" : ""}{totalDiff.toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Unbudgeted expenses alert */}
      {!isLoading && unbudgetedExpenses.length > 0 && budgets.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--block-lifestyle)/0.3)] bg-[hsl(var(--block-lifestyle)/0.06)] p-4 space-y-2 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[hsl(var(--block-lifestyle))] shrink-0" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Gastos sin presupuesto</h3>
          </div>
          <div className="space-y-1.5">
            {unbudgetedExpenses.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs bg-[hsl(var(--block-lifestyle)/0.08)]"
              >
                <span className="font-medium truncate">{item.name}</span>
                <span className="text-foreground font-bold tabular-nums shrink-0">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Estos gastos ({formatCurrency(unbudgetedTotal)}) están incluidos en el total pero no tienen presupuesto asignado.
          </p>
        </div>
      )}

      {/* Alert Banner for budgets over threshold */}
      {!isLoading && budgets.filter(b => b.amount > 0 && (b.spent / b.amount) >= b.alert_threshold).length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--status-warning)/0.3)] bg-[hsl(var(--status-warning)/0.06)] p-4 space-y-2 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))] shrink-0" />
            <h3 className="text-sm font-heading font-semibold text-foreground">Presupuestos en alerta</h3>
          </div>
          <div className="space-y-1.5">
            {budgets
              .filter(b => b.amount > 0 && (b.spent / b.amount) >= b.alert_threshold)
              .sort((a, b) => (b.spent / b.amount) - (a.spent / a.amount))
              .map(b => {
                const pct = Math.round((b.spent / b.amount) * 100);
                const isOver = pct >= 100;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors",
                      isOver
                        ? "bg-destructive/10 hover:bg-destructive/15"
                        : "bg-[hsl(var(--status-warning)/0.08)] hover:bg-[hsl(var(--status-warning)/0.14)]"
                    )}
                    onClick={() => setDetailBudget({ id: b.id, name: b.name, amount: b.amount, spent: b.spent, category_id: b.category_id })}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "inline-block h-2 w-2 rounded-full shrink-0",
                        isOver ? "bg-destructive" : "bg-[hsl(var(--status-warning))]"
                      )} />
                      <span className="font-medium truncate">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">
                        {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                      </span>
                      <span className={cn(
                        "font-semibold tabular-nums",
                        isOver ? "text-destructive" : "text-[hsl(var(--status-warning))]"
                      )}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Blocks */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : budgets.length === 0 && incomeBudgets.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground rounded-2xl bg-card border border-border p-8 animate-fade-in-up">
          {prevMonthHasBudgets && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-6 text-left">
              <p className="text-sm text-foreground font-medium">
                Tienes un presupuesto en {monthNames[prevMonth]} {prevYear}. ¿Quieres usarlo como base para {monthNames[currentMonth]}?
              </p>
              <Button
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setWizardOpen(true)}
              >
                <Copy className="h-3.5 w-3.5" />
                Sí, copiar como base
              </Button>
            </div>
          )}
          <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-heading font-medium">Aún no tienes un presupuesto activo</p>
          <p className="text-sm mt-1 mb-4">
            Un presupuesto no es una restricción — es una decisión sobre a dónde quieres que vaya tu dinero antes de que llegue.
          </p>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear mi presupuesto
          </Button>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {(["stability", "lifestyle", "build"] as const).map((block) => (
            <BudgetBlockCard
              key={block}
              block={block}
              label={blockConfig[block].label}
              emoji={blockConfig[block].emoji}
              items={mapBudgetItems(budgetsByBlock[block])}
              onDeleteBudget={(id) => deleteBudget.mutate(id)}
              onCategoryClick={(item) => setDetailBudget(item)}
              signals={signals}
              recommendations={recommendations}
            />
          ))}

          {/* Unassigned */}
          {budgetsByBlock.unassigned.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-sm font-heading font-semibold text-muted-foreground">
                Sin bloque asignado
              </h3>
              {budgetsByBlock.unassigned.map((budget) => (
                <div
                  key={budget.id}
                  className="flex items-center gap-2 rounded-xl bg-secondary/30 p-3 cursor-pointer"
                  onClick={() =>
                    setDetailBudget({
                      id: budget.id,
                      name: budget.name,
                      amount: budget.amount,
                      spent: budget.spent ?? 0,
                      category_id: budget.category_id,
                    })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{budget.name}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBudget.mutate(budget.id);
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wizard */}
      <BudgetCreationWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Category Detail */}
      <BudgetCategoryDetail
        open={!!detailBudget}
        onOpenChange={(open) => !open && setDetailBudget(null)}
        budget={detailBudget}
        year={currentYear}
        month={currentMonth}
        onUpdateAmount={handleUpdateAmount}
      />
    </div>
  );
}
