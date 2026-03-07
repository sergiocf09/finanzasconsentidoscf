import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ShoppingBag, Utensils, Car, Home, Briefcase, Gift, ArrowRightLeft, Receipt, SlidersHorizontal,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";

const categoryIcons: Record<string, typeof ShoppingBag> = {
  Transporte: Car, Salario: Briefcase, Alimentación: Utensils, Vivienda: Home,
  Compras: ShoppingBag, Ahorro: Gift, default: Receipt,
};

interface RecentTransactionsProps {
  limit?: number;
}

export function RecentTransactions({ limit = 5 }: RecentTransactionsProps) {
  const { transactions, isLoading } = useTransactions();
  const { categories } = useCategories();
  const [selectedTx, setSelectedTx] = useState<typeof transactions[0] | null>(null);

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "dd MMM", { locale: es });
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Sin categoría";
    return categories.find((c) => c.id === categoryId)?.name || "Sin categoría";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  const displayed = transactions.slice(0, limit);

  if (displayed.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Sin movimientos recientes</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {displayed.map((transaction) => {
          const catName = getCategoryName(transaction.category_id);
          const isAdjustment = transaction.type === "adjustment_income" || transaction.type === "adjustment_expense";
          const Icon = isAdjustment ? SlidersHorizontal : transaction.type === "transfer" ? ArrowRightLeft : categoryIcons[catName] || categoryIcons.default;

          return (
            <div
              key={transaction.id}
              className={cn("flex items-center gap-3 p-3 rounded-xl bg-card border card-interactive cursor-pointer overflow-hidden", isAdjustment ? "border-dashed border-muted-foreground/30" : "border-border")}
              onClick={() => setSelectedTx(transaction)}
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0",
                transaction.type === "income" && "bg-income/10",
                transaction.type === "expense" && "bg-muted",
                transaction.type === "transfer" && "bg-transfer/10",
                isAdjustment && "bg-muted"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  transaction.type === "income" && "text-income",
                  transaction.type === "expense" && "text-muted-foreground",
                  transaction.type === "transfer" && "text-transfer",
                  isAdjustment && "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{isAdjustment ? "Ajuste de saldo" : (transaction.description || catName)}</p>
                <p className="text-xs text-muted-foreground truncate">{isAdjustment ? formatDate(transaction.transaction_date) : `${catName} · ${formatDate(transaction.transaction_date)}`}</p>
              </div>
              <p className={cn(
                "text-sm font-semibold tabular-nums shrink-0 text-right",
                transaction.type === "income" && "text-income",
                transaction.type === "expense" && "text-foreground",
                transaction.type === "transfer" && "text-transfer",
                isAdjustment && "text-muted-foreground"
              )}>
                {transaction.type === "expense" && "-"}
                {transaction.type === "income" && "+"}
                {isAdjustment && (transaction.type === "adjustment_expense" ? "-" : "+")}
                {formatAmount(transaction.amount, transaction.currency)}
              </p>
            </div>
          );
        })}
      </div>
      <TransactionDetailSheet
        transaction={selectedTx}
        open={!!selectedTx}
        onOpenChange={(open) => { if (!open) setSelectedTx(null); }}
      />
    </>
  );
}
