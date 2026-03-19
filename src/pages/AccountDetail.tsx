import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAccounts, isLiability } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers, Transfer } from "@/hooks/useTransfers";
import { useCategories } from "@/hooks/useCategories";
import { useReconciliations } from "@/hooks/useReconciliations";
import { formatCurrency } from "@/lib/formatters";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { TransferDetailSheet } from "@/components/transfers/TransferDetailSheet";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type PeriodKey = "current" | "previous" | "last3" | "last6" | "custom";

const periodLabels: Record<PeriodKey, string> = {
  current: "Mes en curso",
  previous: "Mes anterior",
  last3: "Últimos 3 meses",
  last6: "Últimos 6 meses",
  custom: "Rango personalizado",
};

function getDateRange(period: PeriodKey, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (period) {
    case "previous":
      return { startDate: startOfMonth(subMonths(now, 1)), endDate: endOfMonth(subMonths(now, 1)) };
    case "last3":
      return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
    case "last6":
      return { startDate: startOfMonth(subMonths(now, 5)), endDate: endOfMonth(now) };
    case "custom":
      return {
        startDate: customStart || startOfMonth(now),
        endDate: customEnd || endOfMonth(now),
      };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { reconciliations, deleteReconciliation } = useReconciliations(id);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Period state — independent from Transactions page
  const [period, setPeriod] = useState<PeriodKey>("last3");
  const [customStartDate, setCustomStartDate] = useState<Date>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date>(endOfMonth(new Date()));

  const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);

  const { transactions } = useTransactions({ startDate, endDate });
  const { transfers } = useTransfers(id, { startDate, endDate });

  const account = accounts.find((a) => a.id === id);

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cuenta no encontrada</p>
        <Link to="/accounts"><Button variant="outline" className="mt-4">Volver</Button></Link>
      </div>
    );
  }

  const isLiab = isLiability(account.type);
  const accountTxs = transactions.filter((t) => t.account_id === id);
  const getAccountName = (accId: string) => accounts.find((a) => a.id === accId)?.name ?? "—";
  const getCategoryName = (catId: string | null) => categories.find((c) => c.id === catId)?.name ?? "";

  const fmt = (amount: number, currency: string) => formatCurrency(amount, currency);

  const allItems = [
    ...accountTxs.map((t) => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type as string,
      description: t.description || getCategoryName(t.category_id),
      amount: t.type === "expense" ? -t.amount : t.amount,
      currency: t.currency,
      source: "tx" as const,
      categoryName: getCategoryName(t.category_id),
      amount_in_base: (t as any).amount_in_base ?? null,
      exchange_rate: (t as any).exchange_rate ?? null,
    })),
    ...transfers.map((t) => ({
      id: t.id,
      date: t.transfer_date,
      type: "transfer",
      description: t.from_account_id === id
        ? `→ ${getAccountName(t.to_account_id)}`
        : `← ${getAccountName(t.from_account_id)}`,
      amount: t.from_account_id === id ? -t.amount_from : t.amount_to,
      currency: t.from_account_id === id ? t.currency_from : t.currency_to,
      source: "transfer" as const,
      categoryName: "",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayAmount = (item: typeof allItems[0]) => {
    if (isLiab && item.source === "tx") {
      return item.type === "expense" ? -Math.abs(item.amount) : item.amount;
    }
    return item.amount;
  };

  const handleItemClick = (item: typeof allItems[0]) => {
    if (item.source === "tx") {
      const tx = accountTxs.find(t => t.id === item.id);
      if (tx) setSelectedTx(tx);
    } else if (item.source === "transfer") {
      const tr = transfers.find(t => t.id === item.id);
      if (tr) setSelectedTransfer(tr);
    }
  };

  const renderItem = (item: typeof allItems[0]) => {
    const amt = displayAmount(item);
    return (
      <div
        key={item.id}
        className={cn("flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg px-1 -mx-1")}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-2">{item.description || item.type}</p>
          <p className="text-xs text-muted-foreground">
            {item.categoryName
              ? `${format(new Date(item.date), "d MMM yyyy", { locale: es })} · ${item.categoryName}`
              : format(new Date(item.date), "d MMM yyyy", { locale: es })
            }
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("font-semibold tabular-nums text-sm", amt < 0 ? "text-expense" : "text-income")}>
            {amt < 0 ? "-" : "+"}{fmt(Math.abs(amt), item.currency)}
          </p>
          {item.source === "tx" &&
            item.amount_in_base != null &&
            item.exchange_rate != null &&
            item.exchange_rate !== 1 && (() => {
              if (item.currency !== "MXN") {
                return (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    ≈ {formatCurrency(item.amount_in_base as number, "MXN")}
                  </p>
                );
              } else {
                const usdAmount = Math.abs(item.amount) / (item.exchange_rate as number);
                return (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    ≈ {formatCurrency(usdAmount, "USD")}
                  </p>
                );
              }
            })()
          }
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-14 lg:top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1 space-y-3">
        <div className="flex items-center gap-3">
          <Link to="/accounts">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{account.name}</h1>
            <p className="text-muted-foreground text-sm">{account.currency} · Saldo: {formatCurrency(account.current_balance, account.currency)}</p>
          </div>
        </div>

        {/* Period selector inside sticky area */}
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
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

      <Tabs defaultValue="all" className="space-y-3">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="text-[11px] flex-1">Todo ({allItems.length})</TabsTrigger>
          <TabsTrigger value="movements" className="text-[11px] flex-1">Mov. ({accountTxs.length})</TabsTrigger>
          <TabsTrigger value="transfers" className="text-[11px] flex-1">Transf. ({transfers.length})</TabsTrigger>
          {reconciliations.length > 0 && (
            <TabsTrigger value="reconciliations" className="text-[11px] flex-1">Conc. ({reconciliations.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all">
          <div className="rounded-2xl bg-card border border-border p-4">
            {allItems.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin movimientos en este período</p>
            ) : allItems.map(renderItem)}
          </div>
        </TabsContent>

        <TabsContent value="movements">
          <div className="rounded-2xl bg-card border border-border p-4">
            {accountTxs.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin movimientos en este período</p>
            ) : accountTxs.map((t) => renderItem({
              id: t.id,
              date: t.transaction_date,
              type: t.type,
              description: t.description || getCategoryName(t.category_id),
              amount: t.type === "expense" ? -t.amount : t.amount,
              currency: t.currency,
              source: "tx",
              categoryName: getCategoryName(t.category_id),
              amount_in_base: (t as any).amount_in_base ?? null,
              exchange_rate: (t as any).exchange_rate ?? null,
            }))}
          </div>
        </TabsContent>

        <TabsContent value="transfers">
          <div className="rounded-2xl bg-card border border-border p-4">
            {transfers.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Sin transferencias en este período</p>
            ) : transfers.map((t) => renderItem({
              id: t.id,
              date: t.transfer_date,
              type: "transfer",
              description: t.from_account_id === id
                ? `→ ${getAccountName(t.to_account_id)}`
                : `← ${getAccountName(t.from_account_id)}`,
              amount: t.from_account_id === id ? -t.amount_from : t.amount_to,
              currency: t.from_account_id === id ? t.currency_from : t.currency_to,
              source: "transfer",
              categoryName: "",
            }))}
          </div>
        </TabsContent>

        <TabsContent value="reconciliations">
          <div className="rounded-2xl bg-card border border-border p-4 space-y-0">
            {reconciliations.map((r) => (
              <div key={r.id} className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {fmt(r.previous_balance, account.currency)} → {fmt(r.new_balance, account.currency)}
                  </p>
                  <p className={cn("text-xs font-medium tabular-nums", r.delta > 0 ? "text-income" : "text-expense")}>
                    Delta: {r.delta > 0 ? "+" : ""}{fmt(r.delta, account.currency)}
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.reconciled_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReconciliation.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

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
