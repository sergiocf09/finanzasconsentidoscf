import { useState, useEffect } from "react";
import { Plus, Sparkles, Loader2, Trash2, Activity, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useDiagnostic, DiagnosticResult } from "@/hooks/useDiagnostic";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const blockConfig = {
  stability: { label: "Estabilidad", color: "hsl(var(--block-stability))", bgClass: "bg-[hsl(var(--block-stability))]", textClass: "text-[hsl(var(--block-stability))]", bgLightClass: "bg-[hsl(var(--block-stability)/0.1)]", emoji: "🔵" },
  lifestyle: { label: "Calidad de vida", color: "hsl(var(--block-lifestyle))", bgClass: "bg-[hsl(var(--block-lifestyle))]", textClass: "text-[hsl(var(--block-lifestyle))]", bgLightClass: "bg-[hsl(var(--block-lifestyle)/0.1)]", emoji: "🟡" },
  build: { label: "Construcción", color: "hsl(var(--block-build))", bgClass: "bg-[hsl(var(--block-build))]", textClass: "text-[hsl(var(--block-build))]", bgLightClass: "bg-[hsl(var(--block-build)/0.1)]", emoji: "🟢" },
};

export default function Budgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { budgets, isLoading, totalBudgeted, totalSpent, deleteBudget } = useBudgets(currentYear, currentMonth);
  const { totals } = useTransactions();
  const { categories } = useCategories();
  const { runDiagnostic, result: diagnostic, isRunning: diagRunning } = useDiagnostic();

  const [formOpen, setFormOpen] = useState(false);
  const [generatingBudget, setGeneratingBudget] = useState(false);
  const [diagMonths, setDiagMonths] = useState("3");
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const percentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const fmt = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  // Group budgets by block
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const budgetsByBlock = {
    stability: budgets.filter((b) => {
      const cat = b.category_id ? catMap.get(b.category_id) : null;
      return (cat as any)?.bucket === "stability";
    }),
    lifestyle: budgets.filter((b) => {
      const cat = b.category_id ? catMap.get(b.category_id) : null;
      return (cat as any)?.bucket === "lifestyle";
    }),
    build: budgets.filter((b) => {
      const cat = b.category_id ? catMap.get(b.category_id) : null;
      return (cat as any)?.bucket === "build";
    }),
    unassigned: budgets.filter((b) => {
      const cat = b.category_id ? catMap.get(b.category_id) : null;
      return !b.category_id || !(cat as any)?.bucket;
    }),
  };

  const blockTotals = (block: string) => {
    const items = (budgetsByBlock as any)[block] || [];
    return {
      planned: items.reduce((s: number, b: any) => s + b.amount, 0),
      spent: items.reduce((s: number, b: any) => s + (b.spent ?? 0), 0),
    };
  };

  const handleGenerateSuggested = async (months: number) => {
    if (!user) return;
    setGeneratingBudget(true);
    try {
      const end = endOfMonth(new Date());
      const start = startOfMonth(subMonths(new Date(), months));

      const { data: txs, error } = await supabase
        .from("transactions")
        .select("category_id, amount")
        .eq("type", "expense")
        .gte("transaction_date", format(start, "yyyy-MM-dd"))
        .lte("transaction_date", format(end, "yyyy-MM-dd"));

      if (error) throw error;

      const catTotals: Record<string, number> = {};
      (txs ?? []).forEach((tx) => {
        if (tx.category_id) {
          catTotals[tx.category_id] = (catTotals[tx.category_id] || 0) + Number(tx.amount);
        }
      });

      const totalAmount = Object.values(catTotals).reduce((s, v) => s + v / months, 0);

      const { data: budget, error: budgetError } = await supabase
        .from("budgets")
        .insert({
          user_id: user.id,
          name: `Sugerido ${months}m - ${format(new Date(), "MMM yyyy")}`,
          period: "monthly",
          year: currentYear,
          month: currentMonth,
          amount: totalAmount,
          created_from: `suggested_${months}m`,
          is_active: true,
        })
        .select("id")
        .single();

      if (budgetError) throw budgetError;

      const lines = Object.entries(catTotals).map(([catId, total]) => ({
        budget_id: budget.id,
        category_id: catId,
        planned_amount_monthly: Math.round(total / months),
      }));

      if (lines.length > 0) {
        const { error: lineError } = await supabase.from("budget_lines").insert(lines);
        if (lineError) throw lineError;
      }

      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success(`Presupuesto sugerido creado (${months} meses de histórico)`);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setGeneratingBudget(false);
    }
  };

  const renderBlockSection = (block: "stability" | "lifestyle" | "build") => {
    const config = blockConfig[block];
    const items = (budgetsByBlock as any)[block] || [];
    const totals = blockTotals(block);

    return (
      <div key={block} className="space-y-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">{config.emoji}</span>
          <h3 className="font-heading font-semibold text-foreground truncate">{config.label}</h3>
          {totals.planned > 0 && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto whitespace-nowrap shrink-0", config.bgLightClass, config.textClass)}>
              {fmt(totals.spent)} / {fmt(totals.planned)}
            </span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-6">Sin presupuestos en este bloque</p>
        ) : (
          <div className="space-y-2 pl-6">
            {items.map((budget: any) => (
              <div key={budget.id} className="flex items-center gap-2 rounded-xl bg-card border border-border p-3">
                <div className="flex-1 min-w-0">
                  <BudgetProgress category={budget.name} spent={budget.spent ?? 0} budgeted={budget.amount} />
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteBudget.mutate(budget.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 overflow-x-hidden">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-heading font-semibold text-foreground shrink-0">Presupuestos</h1>
          <div className="flex gap-1 shrink-0">
            <Button variant="outline" size="sm" className="gap-1 h-8 text-[11px] px-2" onClick={() => setShowDiagnostic(!showDiagnostic)}>
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diagnóstico</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1 h-8 text-[11px] px-2" onClick={() => handleGenerateSuggested(3)} disabled={generatingBudget}>
              {generatingBudget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Sugerido</span>
            </Button>
            <Button size="sm" className="gap-1 h-8 text-[11px] px-2" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Diagnostic Panel */}
      {showDiagnostic && (
        <div className="rounded-2xl bg-card border border-border p-5 space-y-5 card-elevated animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-[hsl(var(--block-stability))]" />
                Diagnóstico (con calma)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Analiza cómo distribuyes tus gastos para encontrar tu etapa.</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={diagMonths} onValueChange={setDiagMonths}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => runDiagnostic(parseInt(diagMonths))} disabled={diagRunning}>
                {diagRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Analizar
              </Button>
            </div>
          </div>

          {diagnostic && (
            <div className="space-y-5">
              {/* Stage */}
              <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {diagnostic.stage === "stabilize" ? "🔵" : diagnostic.stage === "balance" ? "🟡" : "🟢"}
                  </span>
                  <span className="font-heading font-semibold text-foreground">Etapa: {diagnostic.stageName}</span>
                </div>
                <p className="text-sm text-muted-foreground">{diagnostic.stageMessage}</p>
              </div>

              {/* Percentages */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                {(["stability", "lifestyle", "build"] as const).map((block) => {
                  const config = blockConfig[block];
                  const pct = block === "stability" ? diagnostic.stabilityPct : block === "lifestyle" ? diagnostic.lifestylePct : diagnostic.buildPct;
                  const range = diagnostic.suggestedRanges[block];
                  return (
                    <div key={block} className={cn("rounded-xl p-4 space-y-2", config.bgLightClass)}>
                      <div className="flex items-center gap-2">
                        <span>{config.emoji}</span>
                        <span className="text-sm font-medium text-foreground">{config.label}</span>
                      </div>
                      <p className={cn("text-2xl font-heading font-bold", config.textClass)}>{pct.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Rango sugerido: {range[0]}% – {range[1]}%</p>
                    </div>
                  );
                })}
              </div>

              {/* Total + actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">Total analizado: {fmt(diagnostic.totalExpenses)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleGenerateSuggested(parseInt(diagMonths))} disabled={generatingBudget}>
                    {generatingBudget ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Sugerir presupuesto
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic text-center">Esto es una guía. Tú decides.</p>
            </div>
          )}
        </div>
      )}

      {/* Budget Summary */}
      {isLoading ? (
        <Skeleton className="h-28 rounded-2xl" />
      ) : totalBudgeted > 0 ? (
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground card-elevated scroll-mt-20">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-primary-foreground/80">Presupuesto del mes</p>
              <p className="text-xl font-bold font-heading mt-1 truncate">{fmt(totalSpent)} / {fmt(totalBudgeted)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold font-heading">{percentage.toFixed(0)}%</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
            <div className="h-full bg-primary-foreground rounded-full transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%` }} />
          </div>
          {totalBudgeted > totalSpent && (
            <p className="text-xs text-primary-foreground/70 mt-2">Te quedan {fmt(totalBudgeted - totalSpent)} este mes</p>
          )}
        </div>
      ) : null}

      {/* Budgets by Block */}
      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-2xl bg-card border border-border p-8">
          <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">Sin presupuestos activos</p>
          <p className="text-sm mt-1">Usa el Diagnóstico para conocer tu etapa y genera un presupuesto sugerido, o crea uno manual.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderBlockSection("stability")}
          {renderBlockSection("lifestyle")}
          {renderBlockSection("build")}
          {budgetsByBlock.unassigned.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-heading font-semibold text-muted-foreground">Sin bloque asignado</h3>
              <div className="space-y-2 pl-6">
                {budgetsByBlock.unassigned.map((budget) => (
                  <div key={budget.id} className="flex items-center gap-2 rounded-xl bg-card border border-border p-3">
                    <div className="flex-1 min-w-0">
                      <BudgetProgress category={budget.name} spent={budget.spent ?? 0} budgeted={budget.amount} />
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteBudget.mutate(budget.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <BudgetForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
