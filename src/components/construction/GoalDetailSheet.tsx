import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers, Transfer } from "@/hooks/useTransfers";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { TransferDetailSheet } from "@/components/transfers/TransferDetailSheet";
import { SavingsGoal, getGoalProjection } from "@/hooks/useSavingsGoals";
import { formatCurrency, formatCurrencyAbs } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

const goalConfig: Record<string, { emoji: string; phrase: string }> = {
  emergency: { emoji: "🛡️", phrase: "Tu red de seguridad" },
  home: { emoji: "🏠", phrase: "Tu propio espacio" },
  car: { emoji: "🚗", phrase: "Tu movilidad propia" },
  travel: { emoji: "✈️", phrase: "Ese viaje que mereces" },
  education: { emoji: "🎓", phrase: "Invertir en tu futuro" },
  business: { emoji: "🌱", phrase: "Tu negocio propio" },
  retirement: { emoji: "🌅", phrase: "Tu libertad financiera" },
  custom: { emoji: "⭐", phrase: "Tu meta personal" },
};

type PeriodKey = "current" | "previous" | "last3" | "last6" | "custom";
type FilterKey = "all" | "movements" | "transfers";

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
      return { startDate: customStart || startOfMonth(now), endDate: customEnd || endOfMonth(now) };
    default:
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  }
}

interface GoalDetailSheetProps {
  goal: SavingsGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalDetailSheet({ goal, open, onOpenChange }: GoalDetailSheetProps) {
  const [period, setPeriod] = useState<PeriodKey>("last3");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [customStartDate, setCustomStartDate] = useState<Date>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date>(endOfMonth(new Date()));
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);
  const { transactions } = useTransactions({ startDate, endDate, enabled: open && !!goal?.account_id });
  const { transfers } = useTransfers(goal?.account_id ?? undefined, { startDate, endDate, enabled: open && !!goal?.account_id });
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  if (!goal) return null;

  const config = goalConfig[goal.goal_type] || goalConfig.custom;
  const pct = goal.target_amount > 0
    ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
    : 0;
  const projection = getGoalProjection(goal);

  const milestones = [
    { pct: 25, notified: goal.milestone_25_notified },
    { pct: 50, notified: goal.milestone_50_notified },
    { pct: 75, notified: goal.milestone_75_notified },
    { pct: 100, notified: goal.milestone_100_notified },
  ];

  const getAccountName = (accId: string) => accounts.find((a) => a.id === accId)?.name ?? "—";
  const getCategoryName = (catId: string | null) => categories.find((c) => c.id === catId)?.name ?? "";
  const fmt = (amount: number, currency: string) => formatCurrency(amount, currency);

  const accountTxs = goal.account_id ? transactions.filter((t) => t.account_id === goal.account_id) : [];

  const txItems = accountTxs.map((t) => ({
    id: t.id, date: t.transaction_date, type: t.type as string,
    description: t.description || getCategoryName(t.category_id),
    amount: t.type === "expense" ? -t.amount : t.amount,
    currency: t.currency, source: "tx" as const,
    categoryName: getCategoryName(t.category_id),
    amount_in_base: (t as any).amount_in_base ?? null,
    exchange_rate: (t as any).exchange_rate ?? null,
  }));

  const transferItems = (goal.account_id ? transfers : []).map((t) => ({
    id: t.id, date: t.transfer_date, type: "transfer",
    description: t.from_account_id === goal.account_id
      ? `→ ${getAccountName(t.to_account_id)}`
      : `← ${getAccountName(t.from_account_id)}`,
    amount: t.from_account_id === goal.account_id ? -t.amount_from : t.amount_to,
    currency: t.from_account_id === goal.account_id ? t.currency_from : t.currency_to,
    source: "transfer" as const, categoryName: "",
  }));

  const allItems = [...txItems, ...transferItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Todo", count: allItems.length },
    { key: "movements", label: "Mov.", count: txItems.length },
    { key: "transfers", label: "Transf.", count: transferItems.length },
  ];

  const visibleItems = filter === "movements"
    ? txItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : filter === "transfers"
      ? transferItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : allItems;

  const handleItemClick = (item: typeof allItems[0]) => {
    if (item.source === "tx") {
      const tx = accountTxs.find(t => t.id === item.id);
      if (tx) setSelectedTx(tx);
    } else {
      const tr = transfers.find(t => t.id === item.id);
      if (tr) setSelectedTransfer(tr);
    }
  };

  const renderItem = (item: typeof allItems[0]) => {
    const amt = item.amount;
    return (
      <div
        key={item.id}
        className="flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg px-1 -mx-1"
        onClick={() => handleItemClick(item)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.description || item.type}</p>
          <p className="text-xs text-muted-foreground truncate">
            {item.categoryName
              ? `${format(new Date(item.date), "d MMM yyyy", { locale: es })} · ${item.categoryName}`
              : format(new Date(item.date), "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("font-semibold tabular-nums text-sm", amt < 0 ? "text-expense" : "text-income")}>
            {amt < 0 ? "-" : "+"}{fmt(Math.abs(amt), item.currency)}
          </p>
          {item.source === "tx" && item.amount_in_base != null && item.exchange_rate != null && item.exchange_rate !== 1 && (
            item.currency !== "MXN"
              ? <p className="text-[10px] text-muted-foreground tabular-nums">≈ {formatCurrency(item.amount_in_base as number, "MXN")}</p>
              : <p className="text-[10px] text-muted-foreground tabular-nums">≈ {formatCurrency(Math.abs(item.amount) / (item.exchange_rate as number), "USD")}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              {goal.name}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 mt-3">
            {/* Header section */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">{config.phrase}</p>

              <div>
                <span className="text-2xl font-bold font-heading text-[hsl(var(--block-build))]">
                  {formatCurrencyAbs(goal.current_amount)}
                </span>
                <span className="text-sm text-muted-foreground ml-1.5">
                  de {formatCurrencyAbs(goal.target_amount)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Avance</span>
                  <span className="text-[hsl(var(--block-build))] font-bold tabular-nums">{pct.toFixed(0)}%</span>
                </div>
                <Progress
                  value={pct}
                  className="h-2"
                  style={{ "--progress-foreground": "hsl(var(--block-build))" } as React.CSSProperties}
                />
              </div>

              {/* Projection */}
              {projection.projectedLabel && (
                <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                  {projection.monthsRemaining === 0 ? (
                    <p className="text-xs font-medium text-[hsl(var(--block-build))]">🎉 ¡Meta alcanzada!</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Aportando{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrencyAbs(goal.monthly_contribution)}/mes
                      </span>{" "}
                      llegas en{" "}
                      <span className="font-semibold text-foreground">{projection.projectedLabel}</span>
                      {" "}({projection.monthsRemaining} meses)
                    </p>
                  )}
                </div>
              )}

              {/* Target date */}
              {goal.target_date && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Objetivo: {format(new Date(goal.target_date), "MMMM yyyy", { locale: es })}
                </div>
              )}

              {/* Milestones */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Hitos</p>
                <div className="flex gap-1">
                  {milestones.map((m) => {
                    const reached = pct >= m.pct;
                    return (
                      <div key={m.pct} className="flex-1 text-center">
                        <div className={cn(
                          "text-[10px] font-bold rounded-md py-0.5 transition-colors",
                          reached
                            ? "bg-[hsl(var(--block-build))]/15 text-[hsl(var(--block-build))]"
                            : "bg-muted/50 text-muted-foreground/50"
                        )}>
                          {reached ? "✓" : ""}{m.pct}%
                        </div>
                        <p className={cn(
                          "text-[9px] tabular-nums mt-0.5",
                          reached ? "text-foreground" : "text-muted-foreground/40"
                        )}>
                          {formatCurrencyAbs(goal.target_amount * m.pct / 100)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Movement history section */}
            {!goal.account_id ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta meta no tiene una cuenta vinculada.
                  Edita la meta para vincular una cuenta de ahorro o inversión.
                </p>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Editar meta
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Movimientos</h3>

                <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodLabels).map(([k, label]) => (
                      <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {period === "custom" && (
                  <div className="flex gap-2">
                    <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
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
                          onSelect={(d) => { if (d) { setCustomStartDate(d); setStartDateOpen(false); } }}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
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
                          onSelect={(d) => { if (d) { setCustomEndDate(d); setEndDateOpen(false); } }}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Filter pills */}
                <div className="flex gap-1.5">
                  {filters.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                        filter === f.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>

                {/* Items */}
                <div className="rounded-xl bg-card border border-border p-3">
                  {visibleItems.length === 0 ? (
                    <p className="text-center py-8 text-sm text-muted-foreground">Sin movimientos en este período</p>
                  ) : visibleItems.map(renderItem)}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TransactionDetailSheet
        transaction={selectedTx}
        open={!!selectedTx}
        onOpenChange={(o) => { if (!o) setSelectedTx(null); }}
      />
      <TransferDetailSheet
        transfer={selectedTransfer}
        open={!!selectedTransfer}
        onOpenChange={(o) => { if (!o) setSelectedTransfer(null); }}
      />
    </>
  );
}
