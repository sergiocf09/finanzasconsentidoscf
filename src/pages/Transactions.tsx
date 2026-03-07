import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2, Receipt, SlidersHorizontal, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers, Transfer } from "@/hooks/useTransfers";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { TransferDetailSheet } from "@/components/transfers/TransferDetailSheet";
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

interface UnifiedItem {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  source: "tx" | "transfer";
  accountName: string;
  secondaryInfo?: string;
}

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const { transactions, isLoading, totals, deleteTransaction } = useTransactions();
  const { transfers, isLoading: transfersLoading } = useTransfers();
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

  // Build unified list
  const txItems: UnifiedItem[] = transactions.map((tx) => {
    const isAdjustment = tx.type === "adjustment_income" || tx.type === "adjustment_expense";
    return {
      id: tx.id,
      date: tx.transaction_date,
      type: tx.type,
      description: isAdjustment ? "Ajuste de saldo" : (tx.description || getCategoryName(tx.category_id)),
      amount: tx.amount,
      currency: tx.currency,
      source: "tx" as const,
      accountName: getAccountName(tx.account_id),
      secondaryInfo: isAdjustment
        ? `${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`
        : `${getCategoryName(tx.category_id)} · ${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`,
    };
  });

  const transferItems: UnifiedItem[] = transfers.map((t) => ({
    id: t.id,
    date: t.transfer_date,
    type: "transfer",
    description: t.description || `${getAccountName(t.from_account_id)} → ${getAccountName(t.to_account_id)}`,
    amount: t.amount_from,
    currency: t.currency_from,
    source: "transfer" as const,
    accountName: getAccountName(t.from_account_id),
    secondaryInfo: `${getAccountName(t.from_account_id)} → ${getAccountName(t.to_account_id)} · ${formatDate(t.transfer_date)}`,
  }));

  const allItems = [...txItems, ...transferItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filtered = allItems.filter((item) => {
    if (typeFilter === "income" && item.type !== "income") return false;
    if (typeFilter === "expense" && item.type !== "expense") return false;
    if (typeFilter === "transfer" && item.type !== "transfer") return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.description.toLowerCase().includes(q) ||
      item.accountName.toLowerCase().includes(q) ||
      (item.secondaryInfo || "").toLowerCase().includes(q)
    );
  });

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTransaction.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleItemClick = (item: UnifiedItem) => {
    if (item.source === "transfer") {
      const t = transfers.find(tr => tr.id === item.id);
      if (t) setSelectedTransfer(t);
    } else {
      const tx = transactions.find(t => t.id === item.id);
      if (tx) setSelectedTx(tx);
    }
  };

  const defaultType = typeFilter === "income" ? "income" : "expense";
  const loading = isLoading || transfersLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Movimientos</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo movimiento
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="text-lg font-bold text-income">{formatAmount(totals.income, "MXN")}</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="text-lg font-bold text-expense">{formatAmount(totals.expense, "MXN")}</p>
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
      {loading ? (
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
          {displayed.map((item) => {
            const isAdjustment = item.type === "adjustment_income" || item.type === "adjustment_expense";
            const isTransfer = item.type === "transfer";
            return (
            <div key={`${item.source}-${item.id}`} className={cn("flex items-center gap-3 p-3 rounded-xl bg-card border cursor-pointer card-interactive", isAdjustment ? "border-dashed border-muted-foreground/30" : "border-border")}
              onClick={() => handleItemClick(item)}>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                item.type === "income" && "bg-income/10",
                item.type === "expense" && "bg-muted",
                isTransfer && "bg-primary/10",
                isAdjustment && "bg-muted"
              )}>
                {isAdjustment ? (
                  <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                ) : isTransfer ? (
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                ) : (
                  <Receipt className={cn(
                    "h-5 w-5",
                    item.type === "income" && "text-income",
                    item.type === "expense" && "text-muted-foreground",
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground truncate">{item.secondaryInfo}</p>
              </div>
              <p className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                item.type === "income" && "text-income",
                item.type === "expense" && "text-foreground",
                isTransfer && "text-primary",
                isAdjustment && "text-muted-foreground"
              )}>
                {item.type === "expense" && "-"}{item.type === "income" && "+"}{isAdjustment && (item.type === "adjustment_expense" ? "-" : "+")}{formatAmount(item.amount, item.currency)}
              </p>
              {item.source === "tx" && (
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
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

      <TransferDetailSheet
        transfer={selectedTransfer}
        open={!!selectedTransfer}
        onOpenChange={(open) => { if (!open) setSelectedTransfer(null); }}
      />
    </div>
  );
}
