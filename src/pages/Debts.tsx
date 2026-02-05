import { Plus, CreditCard, Calendar, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const debts = [
  {
    id: "1",
    name: "Tarjeta HSBC",
    balance: 8500,
    limit: 30000,
    minimumPayment: 850,
    dueDate: "15 Feb",
    interestRate: 36,
    currency: "MXN",
  },
  {
    id: "2",
    name: "Tarjeta Banamex",
    balance: 15200,
    limit: 50000,
    minimumPayment: 1520,
    dueDate: "20 Feb",
    interestRate: 42,
    currency: "MXN",
  },
  {
    id: "3",
    name: "Crédito Auto",
    balance: 85000,
    limit: 150000,
    minimumPayment: 4500,
    dueDate: "05 Mar",
    interestRate: 15,
    currency: "MXN",
  },
];

export default function Debts() {
  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimum = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const formatAmount = (value: number, currency: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Deudas
          </h1>
          <p className="text-muted-foreground">
            Controla y reduce tus compromisos financieros
          </p>
        </div>

        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar deuda
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-expense/5 border border-expense/20 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
              <CreditCard className="h-5 w-5 text-expense" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deuda total</p>
              <p className="text-2xl font-bold font-heading text-expense">
                {formatAmount(totalDebt, "MXN")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pago mínimo mensual</p>
              <p className="text-2xl font-bold font-heading">
                {formatAmount(totalMinimum, "MXN")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Debt List */}
      <div className="space-y-4">
        {debts.map((debt) => {
          const usedPercentage = (debt.balance / debt.limit) * 100;

          return (
            <div
              key={debt.id}
              className="rounded-2xl bg-card border border-border p-5 card-interactive"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-expense/10">
                    <CreditCard className="h-5 w-5 text-expense" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{debt.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Límite: {formatAmount(debt.limit, debt.currency)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-expense">
                    {formatAmount(debt.balance, debt.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {usedPercentage.toFixed(0)}% utilizado
                  </p>
                </div>
              </div>

              <Progress
                value={usedPercentage}
                className="h-2 mb-4 [&>div]:bg-expense"
              />

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground">Pago mínimo: </span>
                    <span className="font-medium">
                      {formatAmount(debt.minimumPayment, debt.currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tasa: </span>
                    <span className="font-medium">{debt.interestRate}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-status-warning">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Vence: {debt.dueDate}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategy Suggestion */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <TrendingDown className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Estrategia: Bola de nieve
            </p>
            <p className="text-sm text-muted-foreground">
              Paga primero la deuda más pequeña (Tarjeta HSBC) mientras haces
              pagos mínimos en las demás. Esto te dará momentum para seguir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
