import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2, Receipt, SlidersHorizontal, ArrowLeftRight, TrendingUp, TrendingDown, ArrowUpDown, CalendarDays, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions, useTransactionsPaginated } from "@/hooks/useTransactions";
import { useTransfers, Transfer } from "@/hooks/useTransfers";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { TransferDetailSheet } from "@/components/transfers/TransferDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeDate } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Page size handled by useTransactionsPaginated

type PeriodKey = "current" | "previous" | "last3" | "custom";

const periodLabels: Record<PeriodKey, string> = {
  current: "Mes en curso",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  custom: "Rango personalizado",
};

function getDateRange(period: PeriodKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (period) {
    case "previous":
      return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case "custom":
      return {
        startDate: customStart || startOfMonth(now),
        endDate: customEnd || endOfMonth(now),
      };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

interface UnifiedItem {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_base: number | null;
  exchange_rate?: number | null;
  source: "tx" | "transfer";
  accountName: string;
  secondaryInfo?: string;
  isRecurring?: boolean;
  // Transfer-specific multi-currency fields
  currency_from?: string;
  currency_to?: string;
  amount_to?: number;
  fx_rate?: number | null;
}

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("expense");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // visibleCount removed — now using server-side pagination
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  // Period selector state
  const [period, setPeriod] = useState<PeriodKey>("current");
  const [customStartDate, setCustomStartDate] = useState<Date>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date>(endOfMonth(new Date()));
  

  const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

  // Totals query (lightweight, full period)
  const { totals, deleteTransaction } = useTransactions({ startDate, endDate });
  const { transfers, isLoading: transfersLoading, totalTransferAmount, deleteTransfer } = useTransfers(undefined, { startDate, endDate });
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  // Paginated query for the list
  const {
    transactions,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useTransactionsPaginated({
    startDate,
    endDate,
    typeFilter: typeFilter === "transfer" ? "all" : typeFilter,
    searchQuery,
    sortAsc,
    categories: categories.map(c => ({ id: c.id, name: c.name })),
  });

  // Sync type filter from URL params
  useEffect(() => {
    const urlType = searchParams.get("type");
    if (urlType) setTypeFilter(urlType);
  }, [searchParams]);

  const getCategoryName = (id: string | null) => {
    if (!id) return "Sin categoría";
    return categories.find((c) => c.id === id)?.name || "Sin categoría";
  };

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "";

  const formatAmount = (value: number, currency: string) => formatCurrency(value, currency);
  const formatDate = (dateStr: string) => formatRelativeDate(dateStr, true);

  // Build unified list
  const txItems: UnifiedItem[] = transactions.map((tx) => {
    const isAdjustment = tx.type === "adjustment_income" || tx.type === "adjustment_expense";
    const catName = getCategoryName(tx.category_id);
    return {
      id: tx.id,
      date: tx.transaction_date,
      type: tx.type,
      description: isAdjustment ? "Ajuste de saldo" : (tx.description || catName),
      amount: tx.amount,
      currency: tx.currency,
      amount_in_base: tx.amount_in_base ?? null,
      exchange_rate: tx.exchange_rate ?? null,
      source: "tx" as const,
      accountName: getAccountName(tx.account_id),
      isRecurring: tx.is_recurring === true,
      secondaryInfo: isAdjustment
        ? `${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`
        : catName && catName !== "Sin categoría"
          ? `${catName} · ${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`
          : `${getAccountName(tx.account_id)} · ${formatDate(tx.transaction_date)}`,
    };
  });

  const transferItems: UnifiedItem[] = transfers.map((t) => ({
    id: t.id,
    date: t.transfer_date,
    type: "transfer",
    description: t.description || `${getAccountName(t.from_account_id)} → ${getAccountName(t.to_account_id)}`,
    amount: t.amount_from,
    currency: t.currency_from,
    amount_in_base: null,
    source: "transfer" as const,
    accountName: getAccountName(t.from_account_id),
    secondaryInfo: `${getAccountName(t.from_account_id)} → ${getAccountName(t.to_account_id)} · ${formatDate(t.transfer_date)}`,
    currency_from: t.currency_from,
    currency_to: t.currency_to,
    amount_to: t.amount_to,
    fx_rate: t.fx_rate,
  }));

  const allItems = [...txItems, ...transferItems].sort(
    (a, b) => sortAsc
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime()
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

  const displayed = filtered;
  const hasMore = hasNextPage && typeFilter !== "transfer";

  const handleDelete = async () => {
    if (!deleteId) return;
    const item = allItems.find(i => i.id === deleteId);
    if (item?.source === "transfer") {
      await deleteTransfer.mutateAsync(deleteId);
    } else {
      await deleteTransaction.mutateAsync(deleteId);
    }
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

  const handlePeriodChange = (v: string) => {
    setPeriod(v as PeriodKey);
  };

  const loading = isLoading || transfersLoading;

  const filterCards = [
    { key: "income", label: "Ingresos", amount: totals.income, icon: TrendingUp, colorText: "text-income", colorBg: "bg-income/10" },
    { key: "expense", label: "Gastos", amount: totals.expense, icon: TrendingDown, colorText: "text-expense", colorBg: "bg-expense/10" },
    { key: "transfer", label: "Transferencias", amount: totalTransferAmount, icon: ArrowLeftRight, colorText: "text-transfer", colorBg: "bg-transfer/10" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-semibold text-foreground">Movimientos</h1>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setDefaultType("expense"); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            Registrar
          </Button>
        </div>
      </div>

      {/* Period selector — same style as Dashboard */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 text-xs w-1/2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom date pickers below */}
        {period === "custom" && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {format(customStartDate, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customStartDate}
                  onSelect={(d) => d && setCustomStartDate(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs justify-start">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {format(customEndDate, "dd MMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={customEndDate}
                  onSelect={(d) => d && setCustomEndDate(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Clickable filter cards: Ingresos / Gastos / Transferencias */}
      <div className="grid grid-cols-3 gap-2">
        {filterCards.map((card) => {
          const isActive = typeFilter === card.key;
          const CardIcon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() => {
                setTypeFilter(isActive ? "all" : card.key);
              }}
              className={cn(
                "rounded-xl p-2.5 text-left transition-all border",
                isActive
                  ? "border-primary ring-1 ring-primary/30 bg-card shadow-sm"
                  : "border-border bg-card card-interactive"
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <p className="text-[10px] font-medium text-muted-foreground truncate">{card.label}</p>
                <div className={cn("flex h-5 w-5 items-center justify-center rounded-md shrink-0", card.colorBg)}>
                  <CardIcon className={cn("h-3 w-3", card.colorText)} />
                </div>
              </div>
              <p className={cn("text-sm font-bold font-heading tracking-tight leading-tight", card.colorText)}>
                {card.key === "expense" && "-"}{formatAmount(card.amount, "MXN")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar movimientos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={() => setSortAsc(prev => !prev)}
          title={sortAsc ? "Más antiguo primero" : "Más reciente primero"}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
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
            const itemDate = formatDate(item.date);
            return (
            <div key={`${item.source}-${item.id}`} className={cn("flex items-center gap-3 p-3 rounded-xl bg-card border cursor-pointer card-interactive", isAdjustment ? "border-dashed border-muted-foreground/30" : "border-border")}
              onClick={() => handleItemClick(item)}>
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                item.type === "income" && "bg-income/10",
                item.type === "expense" && "bg-expense/10",
                isTransfer && "bg-transfer/10",
                isAdjustment && "bg-muted"
              )}>
                {isAdjustment ? (
                  <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                ) : isTransfer ? (
                  <ArrowLeftRight className="h-5 w-5 text-transfer" />
                ) : (
                  <Receipt className={cn(
                    "h-5 w-5",
                    item.type === "income" && "text-income",
                    item.type === "expense" && "text-expense",
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.isRecurring && <Repeat className="inline h-3 w-3 text-primary mr-1" />}
                    {item.description}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <p className={cn(
                      "text-sm font-semibold tabular-nums",
                      item.type === "income" && "text-income",
                      item.type === "expense" && "text-expense",
                      isTransfer && "text-transfer",
                      isAdjustment && "text-muted-foreground"
                    )}>
                      {item.type === "expense" && "-"}{item.type === "income" && "+"}{isAdjustment && (item.type === "adjustment_expense" ? "-" : "+")}{formatAmount(item.amount, item.currency)}
                    </p>
                    {item.amount_in_base != null &&
                      item.exchange_rate != null &&
                      item.exchange_rate !== 1 && (() => {
                        if (item.currency !== "MXN") {
                          return (
                            <p className="text-[10px] text-muted-foreground tabular-nums text-right">
                              ≈ {formatAmount(item.amount_in_base, "MXN")}
                            </p>
                          );
                        } else {
                          const usdAmount = item.amount / item.exchange_rate;
                          return (
                            <p className="text-[10px] text-muted-foreground tabular-nums text-right">
                              ≈ {formatAmount(usdAmount, "USD")}
                            </p>
                          );
                        }
                      })()
                    }
                    <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isTransfer
                    ? `${itemDate} · ${getAccountName((transfers.find(t => t.id === item.id))?.from_account_id || "")} → ${getAccountName((transfers.find(t => t.id === item.id))?.to_account_id || "")}`
                    : `${itemDate} · ${getCategoryName(transactions.find(t => t.id === item.id)?.category_id || null)} · ${item.accountName}`
                  }
                </p>
                {isTransfer && item.currency_from && item.currency_to &&
                 item.currency_from !== item.currency_to && item.amount_to && item.fx_rate && (
                  <p className="text-[11px] text-muted-foreground">
                    {item.currency_from === "MXN"
                      ? `≈ ${formatAmount(item.amount_to, item.currency_to)} recibidos · TC: $${item.fx_rate.toFixed(2)}`
                      : `≈ ${formatAmount(item.amount_to, item.currency_to)} recibidos · TC: $${item.fx_rate.toFixed(2)}`
                    }
                  </p>
                )}
              </div>
            </div>
            );
          })}

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </div>
      )}

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} defaultType={defaultType} />

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