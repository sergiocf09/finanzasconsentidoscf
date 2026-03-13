import { useMemo, useState, useCallback } from "react";

import { format, startOfMonth, endOfMonth, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarClock, CreditCard, PiggyBank, AlertTriangle, ArrowRightLeft, X, Repeat, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyAbs } from "@/lib/formatters";
import { useDebts } from "@/hooks/useDebts";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useAccounts } from "@/hooks/useAccounts";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardSummary } from "@/hooks/useDashboardSummary";

interface DueItem {
  id: string;
  name: string;
  day: number;
  nextDate: Date;
  daysLeft: number;
  amount: number;
  currency: string;
  type: "debt" | "goal";
  accountId: string | null;
}

type TimeFilter = "15" | "30" | "next_month";

const filterLabels: Record<TimeFilter, string> = {
  "15": "15 días",
  "30": "30 días",
  "next_month": "Próx. mes",
};

function getNextOccurrence(day: number, today: Date): Date {
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = new Date(y, m, day);
  if (thisMonth >= today) return thisMonth;
  return new Date(y, m + 1, day);
}

function getMaxDays(filter: TimeFilter, today: Date): number {
  if (filter === "15") return 15;
  if (filter === "30") return 30;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return Math.ceil((nextMonth.getTime() - today.getTime()) / 86400000);
}

type AccountSummaryItem = NonNullable<DashboardSummary["accounts_summary"]>[number];

interface UpcomingDueDatesProps {
  summaryDebts?: NonNullable<DashboardSummary["upcoming_debts"]>;
  summaryGoals?: NonNullable<DashboardSummary["upcoming_goals"]>;
  summaryPaidDueDates?: NonNullable<DashboardSummary["paid_due_dates"]>;
  summaryAccounts?: AccountSummaryItem[];
}

interface RecurringDueItem {
  id: string;
  name: string;
  amount: number;
  currency: string;
  next_execution_date: string;
  requires_manual_action: boolean;
  confirmed_at: string | null;
  daysLeft: number;
}

export function UpcomingDueDates({
  summaryDebts,
  summaryGoals,
  summaryPaidDueDates,
  summaryAccounts,
}: UpcomingDueDatesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Only fetch from DB when no summary data provided
  const hasSummary = !!summaryDebts;
  const { debts: hookDebts } = useDebts({ enabled: !hasSummary });
  const { goals: hookGoals } = useSavingsGoals({ enabled: !hasSummary });
  const { accounts: hookAccounts } = useAccounts({ enabled: !summaryAccounts });
  const { mask } = useHideAmounts("balances");

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("15");
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
  const [transferringItemId, setTransferringItemId] = useState<string | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [confirmingRecurring, setConfirmingRecurring] = useState<string | null>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const in7days = useMemo(() => format(addDays(today, 7), "yyyy-MM-dd"), [today]);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const monthStart = useMemo(() => format(startOfMonth(today), "yyyy-MM-dd"), [today]);
  const monthEnd = useMemo(() => format(endOfMonth(today), "yyyy-MM-dd"), [today]);

  // Query upcoming recurring payments (next 7 days)
  const { data: upcomingRecurring } = useQuery({
    queryKey: ["upcoming_recurring", user?.id, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_payments" as any)
        .select("id, name, amount, currency, next_execution_date, type, requires_manual_action, confirmed_at")
        .eq("status", "active")
        .gte("next_execution_date", todayStr)
        .lte("next_execution_date", in7days)
        .order("next_execution_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const recurringItems = useMemo<RecurringDueItem[]>(() => {
    if (!upcomingRecurring) return [];
    return upcomingRecurring.map((r: any) => {
      const execDate = new Date(r.next_execution_date + "T00:00:00");
      const diff = Math.ceil((execDate.getTime() - today.getTime()) / 86400000);
      return { ...r, daysLeft: diff };
    });
  }, [upcomingRecurring, today]);

  const handleConfirmRecurring = useCallback(async (id: string) => {
    setConfirmingRecurring(id);
    try {
      await supabase
        .from("recurring_payments" as any)
        .update({ confirmed_at: new Date().toISOString() } as any)
        .eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["upcoming_recurring"] });
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      toast.success("Pago confirmado");
    } catch {
      toast.error("Error al confirmar");
    } finally {
      setConfirmingRecurring(null);
    }
  }, [queryClient]);

  // Only query paid transfers if no summary data
  const { data: paidTransfers } = useQuery({
    queryKey: ["due_date_transfers", user?.id, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("description, to_account_id")
        .eq("created_from", "due_dates")
        .gte("transfer_date", monthStart)
        .lte("transfer_date", monthEnd);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !summaryPaidDueDates,
  });

  // Normalize accounts from either source
  const accounts = useMemo(() => {
    if (summaryAccounts) {
      return summaryAccounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        current_balance: a.current_balance,
        is_active: a.is_active,
      }));
    }
    return hookAccounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      current_balance: a.current_balance,
      is_active: a.is_active,
    }));
  }, [summaryAccounts, hookAccounts]);

  const sourceAccounts = useMemo(() =>
    accounts.filter(a => a.is_active && !["credit_card", "payable", "mortgage", "auto_loan", "personal_loan", "caucion_bursatil"].includes(a.type)),
    [accounts]
  );

  const items = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDays = getMaxDays(timeFilter, today);
    const result: DueItem[] = [];

    if (summaryDebts) {
      // Use RPC data
      summaryDebts.forEach(d => {
        const next = getNextOccurrence(d.due_day, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= maxDays) {
          result.push({
            id: `debt-${d.id}`,
            name: d.name,
            day: d.due_day,
            nextDate: next,
            daysLeft: diff,
            amount: d.minimum_payment ?? 0,
            currency: d.currency,
            type: "debt",
            accountId: d.account_id,
          });
        }
      });
    } else {
      (hookDebts ?? [])
        .filter(d => d.is_active && d.due_day)
        .forEach(d => {
          const next = getNextOccurrence(d.due_day!, today);
          const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
          if (diff <= maxDays) {
            result.push({
              id: `debt-${d.id}`,
              name: d.name,
              day: d.due_day!,
              nextDate: next,
              daysLeft: diff,
              amount: d.minimum_payment ?? 0,
              currency: d.currency,
              type: "debt",
              accountId: d.account_id,
            });
          }
        });
    }

    if (summaryGoals) {
      summaryGoals.forEach(g => {
        const next = getNextOccurrence(g.contribution_day, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        if (diff <= maxDays) {
          result.push({
            id: `goal-${g.id}`,
            name: g.name,
            day: g.contribution_day,
            nextDate: next,
            daysLeft: diff,
            amount: g.monthly_contribution ?? 0,
            currency: "MXN",
            type: "goal",
            accountId: g.account_id,
          });
        }
      });
    } else {
      (hookGoals ?? [])
        .filter(g => g.is_active && (g as any).contribution_day)
        .forEach(g => {
          const cDay = (g as any).contribution_day as number;
          const next = getNextOccurrence(cDay, today);
          const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
          if (diff <= maxDays) {
            result.push({
              id: `goal-${g.id}`,
              name: g.name,
              day: cDay,
              nextDate: next,
              daysLeft: diff,
              amount: (g as any).monthly_contribution ?? 0,
              currency: "MXN",
              type: "goal",
              accountId: g.account_id,
            });
          }
        });
    }

    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [summaryDebts, summaryGoals, hookDebts, hookGoals, timeFilter]);

  // Filter out items that already have a due_dates transfer this month
  const paidKeys = useMemo(() => {
    const set = new Set<string>();
    const source = summaryPaidDueDates ?? paidTransfers ?? [];
    source.forEach(t => {
      if (t.description) set.add(t.description);
    });
    return set;
  }, [summaryPaidDueDates, paidTransfers]);

  const visibleItems = useMemo(() =>
    items.filter(item => {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      const key = `${descLabel}: ${item.name}`;
      return !paidKeys.has(key);
    }),
    [items, paidKeys]
  );

  const hasAnyDueItems = useMemo(() => {
    if (summaryDebts || summaryGoals) {
      return (summaryDebts?.length ?? 0) > 0 || (summaryGoals?.length ?? 0) > 0;
    }
    const hasDebts = (hookDebts ?? []).some(d => d.is_active && d.due_day);
    const hasGoals = (hookGoals ?? []).some(g => g.is_active && (g as any).contribution_day);
    return hasDebts || hasGoals;
  }, [summaryDebts, summaryGoals, hookDebts, hookGoals]);

  const handleAmountChange = useCallback((itemId: string, value: string) => {
    setEditedAmounts(prev => ({ ...prev, [itemId]: value }));
  }, []);

  const getDisplayAmount = useCallback((item: DueItem): string => {
    if (editedAmounts[item.id] !== undefined) return editedAmounts[item.id];
    return item.amount ? String(item.amount) : "";
  }, [editedAmounts]);

  const handleStartTransfer = useCallback((itemId: string) => {
    setTransferringItemId(itemId);
    setSourceAccountId("");
  }, []);

  const handleCancelTransfer = useCallback(() => {
    setTransferringItemId(null);
    setSourceAccountId("");
  }, []);

  const handleConfirmTransfer = useCallback(async (item: DueItem) => {
    if (!user) return;
    const amountStr = getDisplayAmount(item);
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (!sourceAccountId) {
      toast.error("Selecciona una cuenta de origen");
      return;
    }
    if (!item.accountId) return;

    const source = accounts.find(a => a.id === sourceAccountId);
    if (!source) return;

    setIsSaving(true);
    try {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      await supabase.from("transfers").insert({
        user_id: user.id,
        from_account_id: sourceAccountId,
        to_account_id: item.accountId,
        amount_from: amount,
        amount_to: source.currency === item.currency ? amount : amount,
        currency_from: source.currency,
        currency_to: item.currency,
        transfer_date: format(new Date(), "yyyy-MM-dd"),
        description: `${descLabel}: ${item.name}`,
        created_from: "due_dates",
      });

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
      toast.success("Transferencia registrada");
      queryClient.invalidateQueries({ queryKey: ["due_date_transfers"] });
      handleCancelTransfer();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar transferencia");
    } finally {
      setIsSaving(false);
    }
  }, [user, getDisplayAmount, sourceAccountId, accounts, queryClient, handleCancelTransfer]);

  if (!hasAnyDueItems) return null;

  return (
    <div className="space-y-2">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-foreground">Próximos vencimientos</h2>
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(filterLabels) as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "text-xs font-bold px-3 py-1 rounded-full border transition-colors",
                timeFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-foreground border-border hover:border-muted-foreground/30"
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Sin vencimientos en este periodo.
        </p>
      ) : (
        <div className="space-y-1.5">
          {visibleItems.map(item => {
            const isUrgent = item.daysLeft <= 3;
            const Icon = item.type === "debt" ? CreditCard : PiggyBank;
            const isTransferring = transferringItemId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isUrgent
                    ? "border-expense/30 bg-expense/5"
                    : "border-border bg-card"
                )}
              >
              <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Icon className={cn("h-5 w-5", isUrgent ? "text-expense" : "text-primary")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(item.nextDate, "d 'de' MMMM", { locale: es })} · {item.daysLeft === 0 ? "Hoy" : item.daysLeft === 1 ? "Mañana" : `En ${item.daysLeft} días`}
                    </p>
                  </div>

                  {isUrgent && <AlertTriangle className="h-3 w-3 text-expense shrink-0" />}

                  {focusedItemId === item.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={getDisplayAmount(item)}
                      onChange={(e) => handleAmountChange(item.id, e.target.value)}
                      onBlur={() => setFocusedItemId(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setFocusedItemId(null); }}
                      placeholder="0"
                      autoFocus
                      className={cn(
                        "h-7 w-24 text-xs text-right tabular-nums shrink-0 px-1.5",
                        isUrgent ? "border-expense/30" : "border-border"
                      )}
                    />
                  ) : (
                    <button
                      onClick={() => setFocusedItemId(item.id)}
                      className={cn(
                        "h-7 min-w-[5.5rem] rounded-md border px-1.5 text-xs text-right tabular-nums shrink-0 transition-colors",
                        "hover:border-primary/40 hover:bg-muted/50",
                        isUrgent ? "border-expense/30" : "border-border"
                      )}
                    >
                      {(() => {
                        const val = parseFloat(getDisplayAmount(item));
                        if (!val && val !== 0) return <span className="text-muted-foreground">$0</span>;
                        return <span className="text-foreground font-bold">{formatCurrencyAbs(val, item.currency)}</span>;
                      })()}
                    </button>
                  )}

                  {item.accountId && !isTransferring && (
                    <button
                      onClick={() => handleStartTransfer(item.id)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md transition-colors shrink-0",
                        "bg-primary/10 hover:bg-primary/20 text-primary"
                      )}
                      title="Transferir"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isTransferring && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-border">
                    <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecciona cuenta de origen" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceAccounts
                          .filter(a => a.id !== item.accountId)
                          .map(a => {
                            const bal = a.current_balance ?? 0;
                            const isNeg = bal < 0;
                            return (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span className="truncate">{a.name}</span>
                                  <span className={cn(
                                    "tabular-nums shrink-0",
                                    isNeg ? "text-expense" : "text-muted-foreground"
                                  )}>
                                    {isNeg ? "-" : ""}{formatCurrencyAbs(bal, a.currency)}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleCancelTransfer}
                        disabled={isSaving}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-3 text-xs"
                        onClick={() => handleConfirmTransfer(item)}
                        disabled={isSaving || !getDisplayAmount(item) || !sourceAccountId}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transferir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
