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
  const { assetsByCurrency, liabilitiesByCurrency } = useAccounts();
  const { totals } = useTransactions();
  const { budgets } = useBudgets();
  const displayName = profile?.display_name || "bienvenido";

  const currentMonth = format(new Date(), "MMMM yyyy", { locale: es });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const activeBudgets = budgets.filter((b) => b.is_active);

  const fmt = (v: number, c: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const assetCurrencies = Object.entries(assetsByCurrency);
  const liabCurrencies = Object.entries(liabilitiesByCurrency);

  return (
    <div className="space-y-6 stagger-children">
      {/* Welcome */}
      <div className="space-y-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">Hola, {displayName} 👋</h1>
        <p className="text-muted-foreground">Tu dinero con calma. Tu vida con sentido.</p>
      </div>

      {/* Balance summary by currency */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {assetCurrencies.map(([currency, total]) => (
          <BalanceCard key={`a-${currency}`} title={`Activos (${currency})`} amount={total} currency={currency} type="balance" />
        ))}
        {liabCurrencies.map(([currency, total]) => (
          <BalanceCard key={`l-${currency}`} title={`Pasivos (${currency})`} amount={-total} currency={currency} type="expense" />
        ))}
        {assetCurrencies.length === 0 && liabCurrencies.length === 0 && (
          <BalanceCard title="Balance total" amount={0} type="balance" />
        )}
      </div>

      {/* Month activity */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <BalanceCard title="Ingresos del mes" amount={totals.income} type="income" />
        <BalanceCard title="Gastos del mes" amount={totals.expense} type="expense" />
        <BalanceCard title="Transferencias" amount={totals.transfer} type="transfer" />
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold text-foreground">Acciones rápidas</h2>
        <QuickActions />
      </div>

      {/* Two Column */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-foreground">Presupuesto del mes</h2>
            <span className="text-xs text-muted-foreground">{capitalizedMonth}</span>
          </div>
          <div className="rounded-2xl bg-card border border-border p-5 space-y-5 card-elevated">
            {activeBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin presupuestos activos.</p>
            ) : (
              activeBudgets.slice(0, 4).map((budget) => (
                <BudgetProgress key={budget.id} category={budget.name} spent={budget.spent ?? 0} budgeted={budget.amount} />
              ))
            )}
          </div>
        </div>

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
            <p className="text-sm text-muted-foreground break-words">
              Toca el micrófono y di: "Gasto 900 pesos HSBC Viva gasolina". La app detecta monto, cuenta y categoría automáticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
