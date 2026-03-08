import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeDate } from "@/lib/formatters";
import {
  ShoppingBag, Utensils, Car, Home, Briefcase, Gift, ArrowRightLeft, Receipt, SlidersHorizontal,
} from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";
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

  const formatAmount = (value: number, currency: string) => formatCurrency(value, currency);
  const formatDate = (dateStr: string) => formatRelativeDate(dateStr);

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
      <div className="space-y-2">
        {displayed.map((transaction) => {
          const catName = getCategoryName(transaction.category_id);
          const isAdjustment = transaction.type === "adjustment_income" || transaction.type === "adjustment_expense";
          const Icon = isAdjustment ? SlidersHorizontal : transaction.type === "transfer" ? ArrowRightLeft : categoryIcons[catName] || categoryIcons.default;

          const amountText = `${transaction.type === "expense" ? "-" : ""}${transaction.type === "income" ? "+" : ""}${isAdjustment ? (transaction.type === "adjustment_expense" ? "-" : "+") : ""}${formatAmount(transaction.amount, transaction.currency)}`;

          return (
            <div
              key={transaction.id}
              className={cn("flex items-center gap-2 p-2.5 rounded-xl bg-card border card-interactive cursor-pointer", isAdjustment ? "border-dashed border-muted-foreground/30" : "border-border")}
              onClick={() => setSelectedTx(transaction)}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                transaction.type === "income" && "bg-income/10",
                transaction.type === "expense" && "bg-muted",
                transaction.type === "transfer" && "bg-transfer/10",
                isAdjustment && "bg-muted"
              )}>
                <Icon className={cn(
                  "h-3.5 w-3.5",
                  transaction.type === "income" && "text-income",
                  transaction.type === "expense" && "text-muted-foreground",
                  transaction.type === "transfer" && "text-transfer",
                  isAdjustment && "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{isAdjustment ? "Ajuste de saldo" : (transaction.description || catName)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{isAdjustment ? formatDate(transaction.transaction_date) : `${catName} · ${formatDate(transaction.transaction_date)}`}</p>
              </div>
              <p className={cn(
                "text-xs font-semibold tabular-nums shrink-0",
                transaction.type === "income" && "text-income",
                transaction.type === "expense" && "text-foreground",
                transaction.type === "transfer" && "text-transfer",
                isAdjustment && "text-muted-foreground"
              )}>
                {amountText}
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
