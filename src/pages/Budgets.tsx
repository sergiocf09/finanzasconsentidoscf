import { useState, useEffect, useMemo } from "react";
import { Plus, Activity, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Copy, Eye } from "lucide-react";
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
import { startOfMonth, endOfMonth } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const { budgets, isLoading, totalBudgeted, totalSpent, deleteBudget, updateBudget } =
    useBudgets(currentYear, currentMonth);
  const { categories } = useCategories();
  const { signals, recommendations } = useFinancialIntelligence();

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

      {/* Summary */}
      {isLoading ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : (
        <BudgetSummary totalBudgeted={totalBudgeted} totalSpent={totalSpent} />
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
      ) : budgets.length === 0 ? (
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
          <p className="font-heading font-medium">Sin presupuestos activos</p>
          <p className="text-sm mt-1 mb-4">
            Crea tu primer presupuesto para ver cómo avanzas cada mes.
          </p>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear presupuesto
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
