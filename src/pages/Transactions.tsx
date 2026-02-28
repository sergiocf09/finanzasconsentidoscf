import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2, Receipt, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const { transactions, isLoading, totals, deleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const getCategoryName = (id: string | null) => {
    if (!id) return "Sin categoría";
    return categories.find((c) => c.id === id)?.name || "Sin categoría";
  };

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "";

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "dd MMM yyyy", { locale: es });
  };

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (tx.description || "").toLowerCase().includes(q) ||
      getCategoryName(tx.category_id).toLowerCase().includes(q) ||
      getAccountName(tx.account_id).toLowerCase().includes(q)
    );
  });

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const defaultType = typeFilter === "income" ? "income" : typeFilter === "transfer" ? "transfer" : "expense";

  return (
    <div className="space-y-6">
      {/* Header — sticky */}
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Movimientos</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo movimiento
          </Button>
        </div>
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

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar movimientos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setVisibleCount(PAGE_SIZE); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="expense">Gastos</SelectItem>
            <SelectItem value="income">Ingresos</SelectItem>
            <SelectItem value="transfer">Transferencias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin movimientos</p>
          <p className="text-sm mt-1">{searchQuery || typeFilter !== "all" ? "No se encontraron resultados." : "Registra tu primer movimiento."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((tx) => {
            const isAdjustment = tx.type === "adjustment_income" || tx.type === "adjustment_expense";
            return (
            <div key={tx.id} className={cn("flex items-center gap-3 p-3 rounded-xl bg-card border cursor-pointer card-interactive", isAdjustment ? "border-dashed border-muted-foreground/30" : "border-border")}
              onClick={() => setSelectedTx(tx)}>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                tx.type === "income" && "bg-income/10",
                tx.type === "expense" && "bg-muted",
                tx.type === "transfer" && "bg-transfer/10",
                isAdjustment && "bg-muted"
              )}>
                {isAdjustment ? (
                  <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Receipt className={cn(
                    "h-5 w-5",
                    tx.type === "income" && "text-income",
                    tx.type === "expense" && "text-muted-foreground",
                    tx.type === "transfer" && "text-transfer"
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {isAdjustment ? "Ajuste de saldo" : (tx.description || getCategoryName(tx.category_id))}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {isAdjustment ? `${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}` : `${getCategoryName(tx.category_id)} · ${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`}
                </p>
              </div>
              <p className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                tx.type === "income" && "text-income",
                tx.type === "expense" && "text-foreground",
                tx.type === "transfer" && "text-transfer",
                isAdjustment && "text-muted-foreground"
              )}>
                {tx.type === "expense" && "-"}{tx.type === "income" && "+"}{isAdjustment && (tx.type === "adjustment_expense" ? "-" : "+")}{formatAmount(tx.amount, tx.currency)}
              </p>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(tx.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            );
          })}


          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Cargar más ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} defaultType={defaultType as any} />

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

      <TransactionDetailSheet
        transaction={selectedTx}
        open={!!selectedTx}
        onOpenChange={(open) => { if (!open) setSelectedTx(null); }}
      />
    </div>
  );
}
