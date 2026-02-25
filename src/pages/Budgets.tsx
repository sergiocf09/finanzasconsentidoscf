import { useState, useEffect } from "react";
import { Plus, Calendar, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useBudgets } from "@/hooks/useBudgets";
import { useBudgetRules } from "@/hooks/useBudgetRules";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export default function Budgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { budgets, isLoading, totalBudgeted, totalSpent, deleteBudget } = useBudgets(currentYear, currentMonth);
  const { rule, upsertRule } = useBudgetRules();
  const { totals } = useTransactions();
  const { categories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [essentialRatio, setEssentialRatio] = useState(50);
  const [discretionaryRatio, setDiscretionaryRatio] = useState(30);
  const [savingRatio, setSavingRatio] = useState(20);
  const [generatingBudget, setGeneratingBudget] = useState(false);

  useEffect(() => {
    if (rule) {
      setEssentialRatio(Math.round((rule.essential_ratio ?? 0.5) * 100));
      setDiscretionaryRatio(Math.round((rule.discretionary_ratio ?? 0.3) * 100));
      setSavingRatio(Math.round((rule.saving_investing_ratio ?? 0.2) * 100));
    }
  }, [rule]);

  const percentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
  const monthIncome = totals.income;

  const fmt = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

  const handleSaveRatios = () => {
    upsertRule.mutate({
      essential_ratio: essentialRatio / 100,
      discretionary_ratio: discretionaryRatio / 100,
      saving_investing_ratio: savingRatio / 100,
    });
  };

  const handleGenerateSuggested = async (months: number) => {
    if (!user) return;
    setGeneratingBudget(true);
    try {
      const end = endOfMonth(new Date());
      const start = startOfMonth(subMonths(new Date(), months));

      const { data: txs, error } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('type', 'expense')
        .gte('transaction_date', format(start, 'yyyy-MM-dd'))
        .lte('transaction_date', format(end, 'yyyy-MM-dd'));

      if (error) throw error;

      // Group by category and average
      const catTotals: Record<string, number> = {};
      (txs ?? []).forEach((tx) => {
        if (tx.category_id) {
          catTotals[tx.category_id] = (catTotals[tx.category_id] || 0) + Number(tx.amount);
        }
      });

      // Create budget
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          name: `Sugerido ${months}m - ${format(new Date(), 'MMM yyyy')}`,
          period: 'monthly',
          year: currentYear,
          month: currentMonth,
          amount: Object.values(catTotals).reduce((s, v) => s + v / months, 0),
          created_from: `suggested_${months}m`,
          is_active: true,
        })
        .select('id')
        .single();

      if (budgetError) throw budgetError;

      // Create budget lines
      const lines = Object.entries(catTotals).map(([catId, total]) => ({
        budget_id: budget.id,
        category_id: catId,
        planned_amount_monthly: Math.round(total / months),
      }));

      if (lines.length > 0) {
        const { error: lineError } = await supabase.from('budget_lines').insert(lines);
        if (lineError) throw lineError;
      }

      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success(`Presupuesto sugerido creado (${months} meses de histórico)`);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setGeneratingBudget(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Presupuestos</h1>
          <p className="text-muted-foreground">Planea y controla tus gastos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handleGenerateSuggested(3)} disabled={generatingBudget}>
            {generatingBudget ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sugerido 3m
          </Button>
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Manual
          </Button>
        </div>
      </div>

      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2"><Calendar className="h-4 w-4" />Mensual</TabsTrigger>
          <TabsTrigger value="rule">50/30/20</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          {/* Summary */}
          {isLoading ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : (
            <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-primary-foreground/80">Presupuesto {format(new Date(), 'MMMM yyyy')}</p>
                  <p className="text-3xl font-bold font-heading mt-1">{fmt(totalSpent)} / {fmt(totalBudgeted)}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold font-heading">{percentage.toFixed(0)}%</p>
                  <p className="text-sm text-primary-foreground/80">usado</p>
                </div>
              </div>
              <div className="h-3 rounded-full bg-primary-foreground/20 overflow-hidden">
                <div className="h-full bg-primary-foreground rounded-full transition-all duration-500" style={{ width: `${Math.min(percentage, 100)}%` }} />
              </div>
              {totalBudgeted > 0 && (
                <p className="text-sm text-primary-foreground/80 mt-3">Te quedan {fmt(totalBudgeted - totalSpent)} este mes</p>
              )}
            </div>
          )}

          {/* Budget categories */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">Sin presupuestos activos</p>
              <p className="text-sm mt-1">Crea uno manual o genera uno sugerido basado en tu historial.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {budgets.map((budget) => (
                <div key={budget.id} className="rounded-2xl bg-card border border-border p-5 card-interactive">
                  <div className="flex items-center justify-between mb-2">
                    <BudgetProgress category={budget.name} spent={budget.spent ?? 0} budgeted={budget.amount} />
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive ml-2"
                      onClick={() => deleteBudget.mutate(budget.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rule" className="space-y-6">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <h3 className="font-heading font-semibold text-foreground">Regla de distribución</h3>
            <p className="text-sm text-muted-foreground">Configura cómo distribuir tus ingresos entre categorías esenciales, variables y ahorro/inversión.</p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-foreground">Esencial (%)</label>
                <Input type="number" value={essentialRatio} onChange={(e) => setEssentialRatio(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Variable (%)</label>
                <Input type="number" value={discretionaryRatio} onChange={(e) => setDiscretionaryRatio(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Ahorro/Inversión (%)</label>
                <Input type="number" value={savingRatio} onChange={(e) => setSavingRatio(Number(e.target.value))} />
              </div>
            </div>

            {essentialRatio + discretionaryRatio + savingRatio !== 100 && (
              <p className="text-xs text-expense">Los porcentajes deben sumar 100% (actual: {essentialRatio + discretionaryRatio + savingRatio}%)</p>
            )}

            <Button onClick={handleSaveRatios} disabled={essentialRatio + discretionaryRatio + savingRatio !== 100 || upsertRule.isPending}>
              Guardar regla
            </Button>
          </div>

          {/* Comparison vs real */}
          {monthIncome > 0 && (
            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <h3 className="font-heading font-semibold text-foreground">Comparación del mes</h3>
              <p className="text-sm text-muted-foreground">Ingreso del mes: {fmt(monthIncome)}</p>

              {[
                { label: "Esencial", ratio: essentialRatio / 100, color: "bg-primary" },
                { label: "Variable", ratio: discretionaryRatio / 100, color: "bg-accent" },
                { label: "Ahorro/Inversión", ratio: savingRatio / 100, color: "bg-income" },
              ].map((block) => {
                const target = monthIncome * block.ratio;
                // We'd need bucket classification on categories to be precise, for now show target
                return (
                  <div key={block.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">{block.label}</span>
                      <span className="text-muted-foreground">Meta: {fmt(target)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", block.color)} style={{ width: `${block.ratio * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BudgetForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
