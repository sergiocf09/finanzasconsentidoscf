import { useState } from "react";
import { Plus, Search, Filter, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Transactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { transactions, isLoading, totals, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const getCategoryName = (id: string | null) => {
    if (!id) return "Sin categoría";
    return categories.find((c) => c.id === id)?.name || "Sin categoría";
  };

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || "";
  };

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "dd MMM yyyy", { locale: es });
  };

  const filtered = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (tx.description || "").toLowerCase().includes(q) ||
      getCategoryName(tx.category_id).toLowerCase().includes(q) ||
      getAccountName(tx.account_id).toLowerCase().includes(q)
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Movimientos</h1>
          <p className="text-muted-foreground">Todos tus ingresos, gastos y transferencias</p>
        </div>
        <Button className="gap-2" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo movimiento
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="text-lg font-bold text-income">{formatAmount(totals.income, "MXN")}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="text-lg font-bold text-expense">{formatAmount(totals.expense, "MXN")}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Transferencias</p>
          <p className="text-lg font-bold text-transfer">{formatAmount(totals.transfer, "MXN")}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar movimientos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin movimientos</p>
          <p className="text-sm mt-1">
            {searchQuery ? "No se encontraron resultados." : "Registra tu primer movimiento."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const catName = getCategoryName(tx.category_id);
            const acctName = getAccountName(tx.account_id);

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                    tx.type === "income" && "bg-income/10",
                    tx.type === "expense" && "bg-muted",
                    tx.type === "transfer" && "bg-transfer/10"
                  )}
                >
                  <Receipt
                    className={cn(
                      "h-5 w-5",
                      tx.type === "income" && "text-income",
                      tx.type === "expense" && "text-muted-foreground",
                      tx.type === "transfer" && "text-transfer"
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tx.description || catName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {catName} · {acctName} · {formatDate(tx.transaction_date)}
                  </p>
                </div>

                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums shrink-0",
                    tx.type === "income" && "text-income",
                    tx.type === "expense" && "text-foreground",
                    tx.type === "transfer" && "text-transfer"
                  )}
                >
                  {tx.type === "expense" && "-"}
                  {tx.type === "income" && "+"}
                  {formatAmount(tx.amount, tx.currency)}
                </p>

                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteId(tx.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer y actualizará el saldo de la cuenta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
