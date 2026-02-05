import { cn } from "@/lib/utils";
import {
  ShoppingBag,
  Utensils,
  Car,
  Home,
  Briefcase,
  Gift,
  ArrowRightLeft,
} from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
  date: string;
  currency: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    description: "Uber al trabajo",
    amount: 85,
    type: "expense",
    category: "Transporte",
    date: "Hoy",
    currency: "MXN",
  },
  {
    id: "2",
    description: "Salario quincenal",
    amount: 15000,
    type: "income",
    category: "Salario",
    date: "Ayer",
    currency: "MXN",
  },
  {
    id: "3",
    description: "Supermercado",
    amount: 1250,
    type: "expense",
    category: "Alimentación",
    date: "Ayer",
    currency: "MXN",
  },
  {
    id: "4",
    description: "Renta mensual",
    amount: 12000,
    type: "expense",
    category: "Vivienda",
    date: "01 Feb",
    currency: "MXN",
  },
  {
    id: "5",
    description: "Transferencia a ahorro",
    amount: 3000,
    type: "transfer",
    category: "Ahorro",
    date: "01 Feb",
    currency: "MXN",
  },
];

const categoryIcons: Record<string, typeof ShoppingBag> = {
  Transporte: Car,
  Salario: Briefcase,
  Alimentación: Utensils,
  Vivienda: Home,
  Compras: ShoppingBag,
  Ahorro: Gift,
  default: ShoppingBag,
};

export function RecentTransactions() {
  const formatAmount = (value: number, currency: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-3">
      {mockTransactions.map((transaction) => {
        const Icon =
          transaction.type === "transfer"
            ? ArrowRightLeft
            : categoryIcons[transaction.category] || categoryIcons.default;

        return (
          <div
            key={transaction.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border card-interactive"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                transaction.type === "income" && "bg-income/10",
                transaction.type === "expense" && "bg-muted",
                transaction.type === "transfer" && "bg-transfer/10"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  transaction.type === "income" && "text-income",
                  transaction.type === "expense" && "text-muted-foreground",
                  transaction.type === "transfer" && "text-transfer"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {transaction.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {transaction.category} · {transaction.date}
              </p>
            </div>

            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                transaction.type === "income" && "text-income",
                transaction.type === "expense" && "text-foreground",
                transaction.type === "transfer" && "text-transfer"
              )}
            >
              {transaction.type === "expense" && "-"}
              {transaction.type === "income" && "+"}
              {formatAmount(transaction.amount, transaction.currency)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
