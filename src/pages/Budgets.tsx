import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const budgetCategories = [
  { category: "Alimentación", spent: 4500, budgeted: 6000 },
  { category: "Transporte", spent: 2100, budgeted: 2500 },
  { category: "Entretenimiento", spent: 1800, budgeted: 2000 },
  { category: "Vivienda", spent: 12000, budgeted: 12000 },
  { category: "Servicios", spent: 1500, budgeted: 2000 },
  { category: "Salud", spent: 800, budgeted: 1500 },
  { category: "Educación", spent: 0, budgeted: 1000 },
  { category: "Otros", spent: 350, budgeted: 1000 },
];

export default function Budgets() {
  const totalSpent = budgetCategories.reduce((sum, b) => sum + b.spent, 0);
  const totalBudgeted = budgetCategories.reduce((sum, b) => sum + b.budgeted, 0);
  const percentage = (totalSpent / totalBudgeted) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Presupuestos
          </h1>
          <p className="text-muted-foreground">
            Planea y controla tus gastos
          </p>
        </div>

        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo presupuesto
        </Button>
      </div>

      {/* Period Tabs */}
      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Mensual
          </TabsTrigger>
          <TabsTrigger value="annual">Anual</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-6">
          {/* Summary Card */}
          <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-primary-foreground/80">
                  Presupuesto Febrero 2026
                </p>
                <p className="text-3xl font-bold font-heading mt-1">
                  ${totalSpent.toLocaleString()} / ${totalBudgeted.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold font-heading">
                  {percentage.toFixed(0)}%
                </p>
                <p className="text-sm text-primary-foreground/80">usado</p>
              </div>
            </div>

            <div className="h-3 rounded-full bg-primary-foreground/20 overflow-hidden">
              <div
                className="h-full bg-primary-foreground rounded-full transition-all duration-500"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>

            <p className="text-sm text-primary-foreground/80 mt-3">
              Te quedan ${(totalBudgeted - totalSpent).toLocaleString()} para
              este mes
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {budgetCategories.map((budget) => (
              <div
                key={budget.category}
                className="rounded-2xl bg-card border border-border p-5 card-interactive"
              >
                <BudgetProgress {...budget} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="annual">
          <div className="rounded-2xl bg-muted/50 border border-border p-8 text-center">
            <p className="text-muted-foreground">
              El presupuesto anual te permite planear todo el año.
            </p>
            <Button className="mt-4">Crear presupuesto anual</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
