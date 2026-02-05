import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Sparkles } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6 stagger-children">
      {/* Welcome Message */}
      <div className="space-y-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Hola, bienvenido 👋
        </h1>
        <p className="text-muted-foreground">
          Tu dinero con calma. Tu vida con sentido.
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard
          title="Balance total"
          amount={45250}
          type="balance"
          trend={{ value: 12, label: "vs mes anterior" }}
        />
        <BalanceCard
          title="Ingresos del mes"
          amount={32000}
          type="income"
          trend={{ value: 5, label: "vs mes anterior" }}
        />
        <BalanceCard
          title="Gastos del mes"
          amount={18750}
          type="expense"
          trend={{ value: -8, label: "vs mes anterior" }}
        />
        <BalanceCard
          title="Transferencias"
          amount={5000}
          type="transfer"
        />
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          Acciones rápidas
        </h2>
        <QuickActions />
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Budget Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Presupuesto del mes
            </h2>
            <span className="text-xs text-muted-foreground">Febrero 2026</span>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-5 card-elevated">
            <BudgetProgress
              category="Alimentación"
              spent={4500}
              budgeted={6000}
            />
            <BudgetProgress
              category="Transporte"
              spent={2100}
              budgeted={2500}
            />
            <BudgetProgress
              category="Entretenimiento"
              spent={1800}
              budgeted={2000}
            />
            <BudgetProgress
              category="Vivienda"
              spent={12000}
              budgeted={12000}
            />
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Movimientos recientes
            </h2>
            <a
              href="/transactions"
              className="text-xs text-primary hover:underline"
            >
              Ver todos
            </a>
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
            <p className="font-medium text-foreground">
              Registra tus gastos con tu voz
            </p>
            <p className="text-sm text-muted-foreground">
              Toca el botón de micrófono y di algo como: "Gasté 250 pesos en
              Uber ayer". La app entenderá automáticamente el monto, categoría y
              fecha.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
