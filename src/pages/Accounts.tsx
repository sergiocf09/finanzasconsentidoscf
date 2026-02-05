import { Plus, Wallet, Building2, PiggyBank, CreditCard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const accounts = [
  {
    id: "1",
    name: "Efectivo",
    type: "cash",
    balance: 2500,
    currency: "MXN",
    icon: Wallet,
  },
  {
    id: "2",
    name: "BBVA Débito",
    type: "bank",
    balance: 28750,
    currency: "MXN",
    icon: Building2,
  },
  {
    id: "3",
    name: "Cuenta de Ahorro",
    type: "savings",
    balance: 45000,
    currency: "MXN",
    icon: PiggyBank,
  },
  {
    id: "4",
    name: "Tarjeta HSBC",
    type: "credit",
    balance: -8500,
    currency: "MXN",
    icon: CreditCard,
  },
  {
    id: "5",
    name: "Inversión GBM",
    type: "investment",
    balance: 15000,
    currency: "MXN",
    icon: TrendingUp,
  },
  {
    id: "6",
    name: "Cuenta USD",
    type: "bank",
    balance: 500,
    currency: "USD",
    icon: Building2,
  },
];

const typeLabels: Record<string, string> = {
  cash: "Efectivo",
  bank: "Cuenta bancaria",
  savings: "Ahorro",
  credit: "Tarjeta de crédito",
  investment: "Inversión",
};

export default function Accounts() {
  const totalMXN = accounts
    .filter((a) => a.currency === "MXN")
    .reduce((sum, a) => sum + a.balance, 0);

  const formatAmount = (value: number, currency: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Cuentas
          </h1>
          <p className="text-muted-foreground">
            Administra tu dinero en diferentes lugares
          </p>
        </div>

        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </Button>
      </div>

      {/* Total Balance */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground card-elevated">
        <p className="text-sm text-primary-foreground/80">Saldo total (MXN)</p>
        <p className="text-4xl font-bold font-heading mt-1">
          {formatAmount(totalMXN, "MXN")}
        </p>
        <p className="text-sm text-primary-foreground/80 mt-2">
          En {accounts.length} cuentas
        </p>
      </div>

      {/* Accounts List */}
      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-4 rounded-2xl bg-card border border-border p-4 card-interactive"
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                account.type === "credit"
                  ? "bg-expense/10"
                  : account.type === "savings"
                  ? "bg-income/10"
                  : "bg-muted"
              )}
            >
              <account.icon
                className={cn(
                  "h-6 w-6",
                  account.type === "credit"
                    ? "text-expense"
                    : account.type === "savings"
                    ? "text-income"
                    : "text-muted-foreground"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {account.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {typeLabels[account.type]}
              </p>
            </div>

            <div className="text-right">
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  account.balance < 0 ? "text-expense" : "text-foreground"
                )}
              >
                {account.balance < 0 && "-"}
                {formatAmount(account.balance, account.currency)}
              </p>
              <p className="text-xs text-muted-foreground">{account.currency}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
