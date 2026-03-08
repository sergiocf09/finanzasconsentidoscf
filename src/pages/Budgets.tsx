import { useState } from "react";
import { Plus, Activity, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories } from "@/hooks/useCategories";
import { useDiagnostic } from "@/hooks/useDiagnostic";
import { BudgetSummary } from "@/components/budgets/BudgetSummary";
import { BudgetBlockCard } from "@/components/budgets/BudgetBlockCard";
import { BudgetCategoryDetail } from "@/components/budgets/BudgetCategoryDetail";
import { BudgetCreationWizard } from "@/components/budgets/BudgetCreationWizard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  const { budgets, isLoading, totalBudgeted, totalSpent, deleteBudget, updateBudget } =
    useBudgets(currentYear, currentMonth);
  const { categories } = useCategories();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailBudget, setDetailBudget] = useState<{
    id: string;
    name: string;
    amount: number;
    spent: number;
    category_id: string | null;
  } | null>(null);

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

      {/* Blocks */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-2xl bg-card border border-border p-8 animate-fade-in-up">
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
