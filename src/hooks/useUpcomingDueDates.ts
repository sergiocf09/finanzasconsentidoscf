import { useMemo, useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, addDays, subMonths } from "date-fns";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useDebts } from "@/hooks/useDebts";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useAccounts } from "@/hooks/useAccounts";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import type { DashboardSummary } from "@/hooks/useDashboardSummary";
import {
  DueItem,
  TimeFilter,
  getNextOccurrence,
  getMaxDays,
} from "@/components/dashboard/upcomingDueDatesUtils";

type AccountSummaryItem = NonNullable<DashboardSummary["accounts_summary"]>[number];

export interface UpcomingDueDatesProps {
  summaryDebts?: NonNullable<DashboardSummary["upcoming_debts"]>;
  summaryGoals?: NonNullable<DashboardSummary["upcoming_goals"]>;
  summaryPaidDueDates?: NonNullable<DashboardSummary["paid_due_dates"]>;
  summaryAccounts?: AccountSummaryItem[];
}

export interface RecurringDueItem {
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

export function useUpcomingDueDates({
  summaryDebts,
  summaryGoals,
  summaryPaidDueDates,
  summaryAccounts,
}: UpcomingDueDatesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { rates: fxRates } = useExchangeRate();

  const hasSummary = Array.isArray(summaryDebts);
  const { debts: hookDebts } = useDebts({ enabled: !hasSummary });
  const { goals: hookGoals } = useSavingsGoals({ enabled: !hasSummary });
  const { accounts: hookAccounts } = useAccounts({ enabled: !summaryAccounts });
  const { mask } = useHideAmounts("balances");

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7");
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

  const recurringMaxDate = useMemo(() => {
    const maxDays = getMaxDays(timeFilter, today);
    return format(addDays(today, maxDays), "yyyy-MM-dd");
  }, [timeFilter, today]);

  const { data: upcomingRecurring } = useQuery({
    queryKey: ["upcoming_recurring", user?.id, monthStart, recurringMaxDate],
    queryFn: async () => {
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
      const allAccs = summaryAccounts ?? hookAccounts ?? [];
      const sourceAcc = allAccs.find((a: any) => a.id === accountToUse);
      const liabilityTypes = ["credit_card", "personal_loan", "mortgage", "auto_loan", "payable"];
      const isLiability = sourceAcc && liabilityTypes.includes(sourceAcc.type);

      const usdRateForCurrency = recurringItem.currency === "MXN" ? 1 : (fxRates[recurringItem.currency] || 1);
      const amountInBase = recurringItem.amount * usdRateForCurrency;
      const exchangeRate = usdRateForCurrency;

      if (isLiability) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: accountToUse,
          category_id: recurringItem.category_id || null,
          type: recurringItem.type || "expense",
          amount: recurringItem.amount,
          currency: recurringItem.currency,
          exchange_rate: exchangeRate,
          amount_in_base: amountInBase,
          description: recurringItem.name,
          transaction_date: recurringItem.next_execution_date,
          is_recurring: true,
          recurring_payment_id: recurringItem.id,
        });
        if (txErr) throw txErr;
      } else {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: accountToUse,
          category_id: recurringItem.category_id || null,
          type: recurringItem.type || "expense",
          amount: recurringItem.amount,
          currency: recurringItem.currency,
          exchange_rate: exchangeRate,
          amount_in_base: amountInBase,
          description: recurringItem.name,
          transaction_date: recurringItem.next_execution_date,
          is_recurring: true,
          recurring_payment_id: recurringItem.id,
        });
        if (txErr) throw txErr;
      }

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
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
      toast.success("Pago confirmado y registrado");
      setRecurringSourceAccountId("");
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar");
    } finally {
      setConfirmingRecurring(null);
    }
  }, [user, queryClient, summaryAccounts, hookAccounts, fxRates]);

  const cycleLookbackStart = useMemo(() => format(subMonths(today, 1), "yyyy-MM-dd"), [today]);

  const { data: paidTransfers } = useQuery({
    queryKey: ["due_date_transfers_cycle", user?.id, cycleLookbackStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("description, to_account_id, transfer_date")
        .eq("created_from", "due_dates")
        .gte("transfer_date", cycleLookbackStart)
        .lte("transfer_date", monthEnd);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: ccBalances } = useQuery({
    queryKey: ["cc_cut_balances", user?.id, todayStr],
    queryFn: async () => {
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

  const paidByKey = useMemo(() => {
    const map = new Map<string, Date[]>();

    const ingest = (entries: any[], fallbackDate: Date | null) => {
      entries.forEach((t: any) => {
        if (!t.description) return;
        const dateStr = t.transfer_date as string | undefined;
        const d = dateStr ? new Date(dateStr + "T00:00:00") : fallbackDate;
        if (!d || isNaN(d.getTime())) return;
        const keys = [t.description as string];
        if (t.to_account_id) keys.push(`${t.description}::${t.to_account_id}`);
        keys.forEach(k => {
          const arr = map.get(k) ?? [];
          arr.push(d);
          map.set(k, arr);
        });
      });
    };

    if (Array.isArray(paidTransfers)) ingest(paidTransfers, null);
    if (Array.isArray(summaryPaidDueDates)) ingest(summaryPaidDueDates, today);

    map.forEach(arr => arr.sort((a, b) => b.getTime() - a.getTime()));
    return map;
  }, [paidTransfers, summaryPaidDueDates, today]);

  const visibleItems = useMemo(() => {
    const maxDays = getMaxDays(timeFilter, today);
    const result: DueItem[] = [];

    for (const item of items) {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
      const key = `${descLabel}: ${item.name}`;
      const keyWithAccount = item.accountId ? `${key}::${item.accountId}` : null;
      const dates = [
        ...((keyWithAccount && paidByKey.get(keyWithAccount)) || []),
        ...(paidByKey.get(key) || []),
      ];

      const next = item.nextDate;
      const prev = new Date(next.getFullYear(), next.getMonth() - 1, next.getDate());
      prev.setHours(0, 0, 0, 0);
      const followingMonth = new Date(next.getFullYear(), next.getMonth() + 1, 1);
      const daysInFollowing = new Date(followingMonth.getFullYear(), followingMonth.getMonth() + 1, 0).getDate();
      const followingDue = new Date(followingMonth.getFullYear(), followingMonth.getMonth(), Math.min(item.day, daysInFollowing));
      followingDue.setHours(0, 0, 0, 0);

      const paidThisCycle = dates.some(d => {
        if (!d || isNaN(d.getTime())) return false;
        return d.getTime() > prev.getTime() && d.getTime() <= followingDue.getTime();
      });

      if (!paidThisCycle) {
        result.push(item);
        continue;
      }

      const diff = Math.ceil((followingDue.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= maxDays) {
        result.push({ ...item, nextDate: followingDue, daysLeft: diff });
      }
    }

    return result.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [items, paidByKey, today, timeFilter]);

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

    if (amount === 0) {
      const descLabel = item.type === "debt" ? "Pago" : "Aportación";
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
        queryClient.invalidateQueries({ queryKey: ["due_date_transfers_cycle"] });
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

    const userCurrency = transferCurrency || item.currency;
    let amountFrom = amount;
    let amountTo = amount;
    let fxRateUsed: number | null = null;

    if (source.currency !== dest.currency) {
      const usdRate = fxRates["USD"] || 1;

      if (userCurrency === source.currency) {
        amountFrom = amount;
        if (source.currency === "USD" && dest.currency === "MXN") amountTo = amount * usdRate;
        else if (source.currency === "MXN" && dest.currency === "USD") amountTo = amount / usdRate;
        fxRateUsed = usdRate;
      } else if (userCurrency === dest.currency) {
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
      queryClient.invalidateQueries({ queryKey: ["due_date_transfers_cycle"] });
      toast.success("Transferencia registrada");
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

  return {
    // data
    items,
    visibleItems,
    recurringItems,
    accounts,
    sourceAccounts,
    hasAnyDueItems,
    fxRates,
    mask,
    // filter state
    timeFilter,
    setTimeFilter,
    // amount editing state
    editedAmounts,
    handleAmountChange,
    getDisplayAmount,
    focusedItemId,
    setFocusedItemId,
    // transfer flow
    transferringItemId,
    sourceAccountId,
    setSourceAccountId,
    transferCurrency,
    setTransferCurrency,
    isSaving,
    handleStartTransfer,
    handleCancelTransfer,
    handleConfirmTransfer,
    // recurring flow
    confirmingRecurring,
    setConfirmingRecurring,
    recurringSourceAccountId,
    setRecurringSourceAccountId,
    handleConfirmRecurring,
  };
}
