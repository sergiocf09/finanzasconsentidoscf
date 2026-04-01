import { useMemo, useState, useCallback } from "react";

import { format, startOfMonth, endOfMonth, addDays, subMonths } from "date-fns";
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
import { useExchangeRate } from "@/hooks/useExchangeRate";
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

/**
 * Returns this month's occurrence date regardless of whether it has passed.
 * This ensures overdue items remain visible until the user confirms payment.
 * Items with daysLeft < 0 are shown as "Vencido".
 */
function getNextOccurrence(day: number, today: Date): Date {
  const safeDay = Math.max(1, Math.min(31, Math.round(day)));
  const y = today.getFullYear();
  const m = today.getMonth();

  const daysInThisMonth = new Date(y, m + 1, 0).getDate();
  const clampedDay = Math.min(safeDay, daysInThisMonth);
  const thisMonth = new Date(y, m, clampedDay);
  thisMonth.setHours(0, 0, 0, 0);

  // Always return this month's date — overdue items stay visible
  return thisMonth;
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
  account_id: string | null;
  category_id: string | null;
  frequency: string;
  type: string;
  payments_made: number;
  payment_day: number | null;
}

export function UpcomingDueDates({
  summaryDebts,
  summaryGoals,
  summaryPaidDueDates,
  summaryAccounts,
}: UpcomingDueDatesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { rates: fxRates } = useExchangeRate();

  // Only fetch from DB when no summary data provided
  const hasSummary = Array.isArray(summaryDebts);
  const { debts: hookDebts } = useDebts({ enabled: !hasSummary });
  const { goals: hookGoals } = useSavingsGoals({ enabled: !hasSummary });
  const { accounts: hookAccounts } = useAccounts({ enabled: !summaryAccounts });
  const { mask } = useHideAmounts("balances");

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("15");
  const STORAGE_KEY = useMemo(() => {
    const month = format(new Date(), "yyyy-MM");
    return `due-amounts-${user?.id}-${month}`;
  }, [user?.id]);

  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(`due-amounts-${user?.id}-${format(new Date(), "yyyy-MM")}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [transferringItemId, setTransferringItemId] = useState<string | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [transferCurrency, setTransferCurrency] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [confirmingRecurring, setConfirmingRecurring] = useState<string | null>(null);
  const [recurringSourceAccountId, setRecurringSourceAccountId] = useState<string>("");

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const monthStart = useMemo(() => format(startOfMonth(today), "yyyy-MM-dd"), [today]);
  const monthEnd = useMemo(() => format(endOfMonth(today), "yyyy-MM-dd"), [today]);

  // Compute max date for recurring query based on timeFilter
  const recurringMaxDate = useMemo(() => {
    const maxDays = getMaxDays(timeFilter, today);
    return format(addDays(today, maxDays), "yyyy-MM-dd");
  }, [timeFilter, today]);

  // Query upcoming recurring payments (same filter as debts/goals)
  const { data: upcomingRecurring } = useQuery({
    queryKey: ["upcoming_recurring", user?.id, monthStart, recurringMaxDate],
    queryFn: async () => {
      // Include ALL active recurring payments (manual + automatic) in the date range
      const { data, error } = await supabase
        .from("recurring_payments" as any)
        .select("id, name, amount, currency, next_execution_date, type, requires_manual_action, confirmed_at, account_id, category_id, frequency, payment_day, payments_made")
        .eq("status", "active")
        .gte("next_execution_date", monthStart)
        .lte("next_execution_date", recurringMaxDate)
        .order("next_execution_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const recurringItems = useMemo<RecurringDueItem[]>(() => {
    if (!upcomingRecurring) return [];
    return upcomingRecurring.map((r: any) => {
      const execDate = new Date(r.next_execution_date + "T00:00:00");
      const diff = Math.ceil((execDate.getTime() - today.getTime()) / 86400000);
      return { ...r, daysLeft: diff };
    });
  }, [upcomingRecurring, today]);

  const handleConfirmRecurring = useCallback(async (recurringItem: RecurringDueItem, overrideAccountId?: string) => {
    if (!user) return;
    const accountToUse = overrideAccountId || recurringItem.account_id;
    if (!accountToUse) {
      toast.error("Selecciona una cuenta");
      return;
    }
    setConfirmingRecurring(recurringItem.id);
    try {
      // 1. Create the transaction for the confirmed payment
      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: accountToUse,
        category_id: recurringItem.category_id || null,
        type: recurringItem.type || "expense",
        amount: recurringItem.amount,
        currency: recurringItem.currency,
        exchange_rate: 1,
        amount_in_base: recurringItem.amount,
        description: recurringItem.name,
        transaction_date: recurringItem.next_execution_date,
        is_recurring: true,
        recurring_payment_id: recurringItem.id,
      });
      if (txErr) throw txErr;

      // 2. Advance next_execution_date, increment payments_made, reset confirmed_at
      const freq = recurringItem.frequency || "monthly";
      const currentDate = new Date(recurringItem.next_execution_date + "T12:00:00Z");
      const nextDate = (() => {
        const d = new Date(currentDate);
        switch (freq) {
          case "weekly": d.setDate(d.getDate() + 7); break;
          case "biweekly": d.setDate(d.getDate() + 14); break;
          case "monthly": d.setMonth(d.getMonth() + 1); break;
          case "bimonthly": d.setMonth(d.getMonth() + 2); break;
          case "quarterly": d.setMonth(d.getMonth() + 3); break;
          case "annual": d.setFullYear(d.getFullYear() + 1); break;
        }
        // Adjust to payment_day if set
        if (recurringItem.payment_day && recurringItem.payment_day >= 1 && recurringItem.payment_day <= 31) {
          const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(recurringItem.payment_day, maxDay));
        }
        return d.toISOString().split("T")[0];
      })();

      await supabase
        .from("recurring_payments" as any)
        .update({
          next_execution_date: nextDate,
          payments_made: (recurringItem.payments_made || 0) + 1,
          confirmed_at: null,
        } as any)
        .eq("id", recurringItem.id);

      queryClient.invalidateQueries({ queryKey: ["upcoming_recurring"] });
      queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
      toast.success("Pago confirmado y registrado");
      setRecurringSourceAccountId("");
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar");
    } finally {
      setConfirmingRecurring(null);
    }
  }, [user, queryClient]);

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

  // Query credit card spending since last cut date for each "current" debt
  const { data: ccBalances } = useQuery({
    queryKey: ["cc_cut_balances", user?.id, todayStr],
    queryFn: async () => {
      // Get all active current (credit card) debts with cut_day
      const { data: currentDebts, error: dErr } = await supabase
        .from("debts")
        .select("id, account_id, cut_day, debt_category")
        .eq("is_active", true)
        .eq("debt_category", "current")
        .not("cut_day", "is", null)
        .not("account_id", "is", null);
      if (dErr || !currentDebts) return {};

      const balances: Record<string, number> = {};

      for (const debt of currentDebts) {
        if (!debt.account_id || !debt.cut_day) continue;

        // Calculate last cut date: if today >= cut_day, it's this month's cut_day; otherwise last month's
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        let lastCutDate: Date;
        const thisCut = new Date(y, m, debt.cut_day);
        if (now >= thisCut) {
          lastCutDate = thisCut;
        } else {
          lastCutDate = new Date(y, m - 1, debt.cut_day);
        }
        const cutDateStr = format(lastCutDate, "yyyy-MM-dd");

        // Sum expenses on this account since last cut date
        const { data: txData } = await supabase
          .from("transactions")
          .select("amount, type, amount_in_base")
          .eq("account_id", debt.account_id)
          .gte("transaction_date", cutDateStr)
          .lte("transaction_date", todayStr);

        let balance = 0;
        (txData || []).forEach((tx: any) => {
          if (tx.type === "expense") {
            balance += (tx.amount_in_base || tx.amount);
          } else if (tx.type === "income") {
            balance -= (tx.amount_in_base || tx.amount);
          }
        });

        // Also subtract transfers TO this account (payments made)
        const { data: trData } = await supabase
          .from("transfers")
          .select("amount_to")
          .eq("to_account_id", debt.account_id)
          .gte("transfer_date", cutDateStr)
          .lte("transfer_date", todayStr);

        (trData || []).forEach((tr: any) => {
          balance -= tr.amount_to;
        });

        balances[`debt-${debt.id}`] = Math.max(0, balance);
      }

      return balances;
    },
    enabled: !!user,
    staleTime: 60000,
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
      summaryDebts.forEach(d => {
        const next = getNextOccurrence(d.due_day, today);
        const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
        // Show if within future range OR overdue (negative daysLeft = not yet paid)
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
    source.forEach((t: any) => {
      if (t.description) {
        set.add(t.description);
        if (t.to_account_id) set.add(`${t.description}::${t.to_account_id}`);
      }
    });
    return set;
  }, [summaryPaidDueDates, paidTransfers]);

  const visibleItems = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return items.filter(item => {
      const isCurrentMonth = item.nextDate.getMonth() === currentMonth && item.nextDate.getFullYear() === currentYear;
      if (!isCurrentMonth) return true;
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      const key = `${descLabel}: ${item.name}`;
      const keyWithAccount = item.accountId ? `${key}::${item.accountId}` : null;
      if (keyWithAccount && paidKeys.has(keyWithAccount)) return false;
      if (!keyWithAccount && paidKeys.has(key)) return false;
      return true;
    });
  }, [items, paidKeys]);

  const hasAnyDueItems = useMemo(() => {
    if (recurringItems.length > 0) return true;
    if (summaryDebts || summaryGoals) {
      return (summaryDebts?.length ?? 0) > 0 || (summaryGoals?.length ?? 0) > 0;
    }
    const hasDebts = (hookDebts ?? []).some(d => d.is_active && d.due_day);
    const hasGoals = (hookGoals ?? []).some(g => g.is_active && (g as any).contribution_day);
    return hasDebts || hasGoals;
  }, [summaryDebts, summaryGoals, hookDebts, hookGoals, recurringItems]);

  const handleAmountChange = useCallback((itemId: string, value: string) => {
    setEditedAmounts(prev => {
      const next = { ...prev, [itemId]: value };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [STORAGE_KEY]);

  const getDisplayAmount = useCallback((item: DueItem): string => {
    if (editedAmounts[item.id] !== undefined) return editedAmounts[item.id];
    // For credit card debts, use calculated balance since last cut date
    if (ccBalances && ccBalances[item.id] !== undefined) {
      return String(Math.round(ccBalances[item.id] * 100) / 100);
    }
    return item.amount ? String(item.amount) : "0";
  }, [editedAmounts, ccBalances]);

  const handleStartTransfer = useCallback((itemId: string, itemCurrency: string) => {
    setTransferringItemId(itemId);
    setSourceAccountId("");
    setTransferCurrency(itemCurrency);
  }, []);

  const handleCancelTransfer = useCallback(() => {
    setTransferringItemId(null);
    setSourceAccountId("");
    setTransferCurrency("");
  }, []);

  const handleConfirmTransfer = useCallback(async (item: DueItem) => {
    if (!user) return;
    const amountStr = getDisplayAmount(item);
    const amount = parseFloat(amountStr) || 0;

    // Allow $0 — skip transfer but mark as paid
    if (amount === 0) {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      // Register a zero-amount transfer to mark it as done
      try {
        setIsSaving(true);
        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: item.accountId!,
          to_account_id: item.accountId!,
          amount_from: 0,
          amount_to: 0,
          currency_from: item.currency,
          currency_to: item.currency,
          transfer_date: format(new Date(), "yyyy-MM-dd"),
          description: `${descLabel}: ${item.name}`,
          created_from: "due_dates",
        });
        queryClient.invalidateQueries({ queryKey: ["due_date_transfers"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
        toast.success("Vencimiento marcado como cubierto ($0)");
        setEditedAmounts(prev => {
          const next = { ...prev };
          delete next[item.id];
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
          return next;
        });
        handleCancelTransfer();
      } catch (err: any) {
        toast.error(err.message || "Error");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (amount < 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (!sourceAccountId) {
      toast.error("Selecciona una cuenta de origen");
      return;
    }
    if (!item.accountId) return;

    const source = accounts.find(a => a.id === sourceAccountId);
    const dest = accounts.find(a => a.id === item.accountId);
    if (!source || !dest) return;

    // Bidirectional FX calculation
    const userCurrency = transferCurrency || item.currency;
    let amountFrom = amount;
    let amountTo = amount;
    let fxRateUsed: number | null = null;

    if (source.currency !== dest.currency) {
      const usdRate = fxRates["USD"] || 1;

      if (userCurrency === source.currency) {
        // User expressed in source currency → convert to dest
        amountFrom = amount;
        if (source.currency === "USD" && dest.currency === "MXN") amountTo = amount * usdRate;
        else if (source.currency === "MXN" && dest.currency === "USD") amountTo = amount / usdRate;
        fxRateUsed = usdRate;
      } else if (userCurrency === dest.currency) {
        // User expressed in dest currency → calculate what leaves source
        amountTo = amount;
        if (source.currency === "USD" && dest.currency === "MXN") amountFrom = amount / usdRate;
        else if (source.currency === "MXN" && dest.currency === "USD") amountFrom = amount * usdRate;
        fxRateUsed = usdRate;
      }
    }

    setIsSaving(true);
    try {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      await supabase.from("transfers").insert({
        user_id: user.id,
        from_account_id: sourceAccountId,
        to_account_id: item.accountId,
        amount_from: Math.round(amountFrom * 100) / 100,
        amount_to: Math.round(amountTo * 100) / 100,
        currency_from: source.currency,
        currency_to: dest.currency,
        fx_rate: fxRateUsed,
        transfer_date: format(new Date(), "yyyy-MM-dd"),
        description: `${descLabel}: ${item.name}`,
        created_from: "due_dates",
      });

      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["savings_goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
      queryClient.invalidateQueries({ queryKey: ["due_date_transfers"] });
      toast.success("Transferencia registrada");
      // Limpiar monto editado del item ya pagado
      setEditedAmounts(prev => {
        const next = { ...prev };
        delete next[item.id];
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
      handleCancelTransfer();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar transferencia");
    } finally {
      setIsSaving(false);
    }
  }, [user, getDisplayAmount, sourceAccountId, transferCurrency, accounts, fxRates, queryClient, handleCancelTransfer, STORAGE_KEY]);

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
            const isOverdue = item.daysLeft < 0;
            const isUrgent = item.daysLeft >= 0 && item.daysLeft <= 3;
            const isHighlight = isOverdue || isUrgent;
            const Icon = item.type === "debt" ? CreditCard : PiggyBank;
            const isTransferring = transferringItemId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isOverdue
                    ? "border-destructive/40 bg-destructive/5"
                    : isUrgent
                      ? "border-expense/30 bg-expense/5"
                      : "border-border bg-card"
                )}
              >
              <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    isOverdue ? "bg-destructive/10" : isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Icon className={cn("h-5 w-5", isHighlight ? "text-expense" : "text-primary")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                      {isOverdue && (
                        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Vencido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(item.nextDate, "d 'de' MMMM", { locale: es })} · {
                        isOverdue
                          ? `Hace ${Math.abs(item.daysLeft)} día${Math.abs(item.daysLeft) !== 1 ? 's' : ''}`
                          : item.daysLeft === 0 ? "Hoy"
                          : item.daysLeft === 1 ? "Mañana"
                          : `En ${item.daysLeft} días`
                      }
                    </p>
                  </div>

                  {isHighlight && <AlertTriangle className="h-3 w-3 text-expense shrink-0" />}

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
                        isHighlight ? "border-expense/30" : "border-border"
                      )}
                    />
                  ) : (
                    <button
                      onClick={() => setFocusedItemId(item.id)}
                      className={cn(
                        "h-7 min-w-[5.5rem] rounded-md border px-1.5 text-xs text-right tabular-nums shrink-0 transition-colors",
                        "hover:border-primary/40 hover:bg-muted/50",
                        isHighlight ? "border-expense/30" : "border-border"
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
                      onClick={() => handleStartTransfer(item.id, item.currency)}
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

                {isTransferring && (() => {
                  const sourceAcc = accounts.find(a => a.id === sourceAccountId);
                  const destAcc = accounts.find(a => a.id === item.accountId);
                  const isCross = sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency;
                  const amt = parseFloat(getDisplayAmount(item)) || 0;
                  const usdRate = fxRates["USD"] || 1;

                  let previewFrom = amt;
                  let previewTo = amt;
                  if (isCross && amt > 0) {
                    if (transferCurrency === sourceAcc.currency) {
                      previewFrom = amt;
                      if (sourceAcc.currency === "USD" && destAcc.currency === "MXN") previewTo = amt * usdRate;
                      else if (sourceAcc.currency === "MXN" && destAcc.currency === "USD") previewTo = amt / usdRate;
                    } else if (transferCurrency === destAcc.currency) {
                      previewTo = amt;
                      if (sourceAcc.currency === "USD" && destAcc.currency === "MXN") previewFrom = amt / usdRate;
                      else if (sourceAcc.currency === "MXN" && destAcc.currency === "USD") previewFrom = amt * usdRate;
                    }
                  }

                  return (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border">
                      {/* Currency selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Moneda:</span>
                        <Select value={transferCurrency} onValueChange={setTransferCurrency}>
                          <SelectTrigger className="h-7 text-xs w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MXN" className="text-xs">MXN</SelectItem>
                            <SelectItem value="USD" className="text-xs">USD</SelectItem>
                            <SelectItem value="EUR" className="text-xs">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Source account selector */}
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

                      {/* FX preview */}
                      {isCross && amt > 0 && (
                        <div className="rounded-lg bg-muted px-3 py-2 text-xs space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sale de {sourceAcc.name}</span>
                            <span className="font-medium text-foreground">{formatCurrencyAbs(Math.round(previewFrom * 100) / 100, sourceAcc.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Llega a {destAcc.name}</span>
                            <span className="font-medium text-foreground">{formatCurrencyAbs(Math.round(previewTo * 100) / 100, destAcc.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tipo de cambio</span>
                            <span>TC: ${usdRate.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

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
                          disabled={isSaving || ((parseFloat(getDisplayAmount(item)) || 0) > 0 && !sourceAccountId)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {(parseFloat(getDisplayAmount(item)) || 0) === 0 ? "Marcar cubierto" : "Transferir"}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming recurring payments */}
      {recurringItems.length > 0 && (
        <div className="space-y-1.5 mt-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-heading font-semibold text-foreground">Cargos recurrentes próximos</h3>
          </div>
          {recurringItems.map(r => {
            const isManual = r.requires_manual_action;
            const isRecurringOverdue = r.daysLeft < 0;
            const isUrgent = r.daysLeft >= 0 && r.daysLeft <= 2;
            const isExpanded = confirmingRecurring === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isRecurringOverdue
                    ? "border-destructive/40 bg-destructive/5"
                    : isUrgent
                      ? "border-expense/30 bg-expense/5"
                      : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    isRecurringOverdue ? "bg-destructive/10" : isUrgent ? "bg-expense/10" : "bg-primary/10"
                  )}>
                    <Repeat className={cn("h-5 w-5", isRecurringOverdue || isUrgent ? "text-expense" : "text-primary")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                      {!isManual && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Automático
                        </span>
                      )}
                      {isRecurringOverdue && (
                        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Vencido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.next_execution_date + "T00:00:00"), "d 'de' MMMM", { locale: es })} · {
                        isRecurringOverdue
                          ? `Hace ${Math.abs(r.daysLeft)} día${Math.abs(r.daysLeft) !== 1 ? 's' : ''}`
                          : r.daysLeft === 0 ? "Hoy"
                          : r.daysLeft === 1 ? "Mañana"
                          : `En ${r.daysLeft} días`
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {formatCurrencyAbs(r.amount, r.currency)}
                    </span>
                    {!isExpanded && (
                      <button
                        onClick={() => {
                          setConfirmingRecurring(r.id);
                          setRecurringSourceAccountId(r.account_id || "");
                        }}
                        className="flex h-7 items-center gap-1 px-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Registrar cargo
                      </button>
                    )}
                  </div>
                </div>

                {/* Account picker for confirmation (manual & automatic) */}
                {isExpanded && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {isManual
                        ? "Confirma la cuenta donde se aplicó este cargo:"
                        : "Este cargo es automático. Confirma que ya se realizó:"}
                    </p>
                    <Select value={recurringSourceAccountId} onValueChange={setRecurringSourceAccountId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Cuenta afectada" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter(a => a.is_active)
                          .map(a => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span className="truncate">{a.name}</span>
                                <span className="tabular-nums text-muted-foreground shrink-0">
                                  {formatCurrencyAbs(Math.abs(a.current_balance ?? 0), a.currency)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setConfirmingRecurring(null);
                          setRecurringSourceAccountId("");
                        }}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-3 text-xs"
                        onClick={() => handleConfirmRecurring(r, recurringSourceAccountId)}
                        disabled={!recurringSourceAccountId}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Confirmar cargo
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
