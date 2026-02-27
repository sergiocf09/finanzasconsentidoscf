import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const { profile } = useProfile();
  const { totalBalance } = useAccounts();
  const { totals } = useTransactions();
  const { budgets } = useBudgets();
  const displayName = profile?.display_name || "bienvenido";

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  // Get active budgets for current month
  const activeBudgets = budgets.filter((b) => b.is_active);

  return (
    <div className="space-y-6 stagger-children">
      {/* Welcome Message */}
      <div className="space-y-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Hola, {displayName} 👋
        </h1>
        <p className="text-muted-foreground">
          Tu dinero con calma. Tu vida con sentido.
        </p>
      </div>

      {/* Balance Cards - real data */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard title="Balance total" amount={totalBalance} type="balance" />
        <BalanceCard title="Ingresos del mes" amount={totals.income} type="income" />
        <BalanceCard title="Gastos del mes" amount={totals.expense} type="expense" />
        <BalanceCard title="Transferencias" amount={totals.transfer} type="transfer" />
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold text-foreground">Acciones rápidas</h2>
        <QuickActions />
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-foreground">Presupuesto del mes</h2>
            <span className="text-xs text-muted-foreground">{capitalizedMonth}</span>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-5 card-elevated">
            {activeBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin presupuestos activos. Crea uno en la sección de Presupuestos.
              </p>
            ) : (
              activeBudgets.slice(0, 4).map((budget) => (
                <BudgetProgress
                  key={budget.id}
                  category={budget.name}
                  spent={budget.spent ?? 0}
                  budgeted={budget.amount}
                />
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-foreground">Movimientos recientes</h2>
            <Link to="/transactions" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <RecentTransactions />
        </div>
      </div>

      {/* Voice Tip */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Registra tus gastos con tu voz</p>
            <p className="text-sm text-muted-foreground">
              Toca el botón de micrófono y di algo como: "Gasté 250 pesos en Uber ayer". La app entenderá automáticamente el monto, categoría y fecha.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
