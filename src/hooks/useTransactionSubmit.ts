import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useRecurringPayments, getNextExecutionDate } from "@/hooks/useRecurringPayments";
import { useDebts } from "@/hooks/useDebts";
import { useCategories } from "@/hooks/useCategories";

export const LONG_TERM_TYPES = ["mortgage", "personal_loan", "auto_loan", "caucion_bursatil"];

export interface TransactionSubmitInput {
  type: "income" | "expense";
  amount: number;
  currency: string;
  account_id: string;
  category_id?: string;
  description?: string;
  transaction_date: Date;
}

export interface TransactionSubmitContext {
  activeTab: "income" | "expense" | "transfer";
  toAccountId: string;
  debtTargetId: string;
  makeRecurring: boolean;
  recurringFrequency: string;
  recurringManual: boolean;
}

export function useTransactionSubmit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { categories: allCategories } = useCategories();
  const { checkAlerts } = useBudgetAlerts();
  const { rate: fxRate, rates: fxRates } = useExchangeRate();
  const { createPayment: createRecurring } = useRecurringPayments();
  const { debts } = useDebts({ enabled: true });

  const [transferSaving, setTransferSaving] = useState(false);

  const activeAccounts = accounts.filter((a) => a.is_active);

  const isLongTermDebt = (d: typeof debts[0]) =>
    d.is_active &&
    Math.abs(d.current_balance) > 0 &&
    (LONG_TERM_TYPES.includes(d.type) || d.debt_category === "fixed");

  const allLongTermDebts = debts.filter(isLongTermDebt);

  /**
   * Submits a transaction in any of these modes (resolved by ctx.activeTab + flags):
   *  - Long-term debt payment via category "Créditos y Deudas" + debtTargetId
   *  - Plain transfer
   *  - Income / expense (with optional cross-currency, optional recurring)
   */
  const submitTransaction = async (
    data: TransactionSubmitInput,
    ctx: TransactionSubmitContext
  ): Promise<boolean> => {
    if (!user) return false;
    const { activeTab, toAccountId, debtTargetId, makeRecurring, recurringFrequency, recurringManual } = ctx;

    const selectedCategory = allCategories.find((c) => c.id === data.category_id);
    const isCreditsCategory =
      !!selectedCategory &&
      selectedCategory.is_system === true &&
      /cr[eé]dito.*deuda/i.test(selectedCategory.name);

    const transferableDebts = allLongTermDebts.filter(
      (d) => !!d.account_id && d.account_id !== data.account_id
    );
    const debtTarget = transferableDebts.find((d) => d.id === debtTargetId);
    const debtTargetAccount = debtTarget ? accounts.find((a) => a.id === debtTarget.account_id) : null;

    // ============================================================
    // OPCIÓN A: Gasto con categoría "Créditos y Deudas" + deuda destino
    // ============================================================
    if (activeTab === "expense" && isCreditsCategory && debtTargetId && debtTargetAccount) {
      setTransferSaving(true);
      try {
        const fromAcc = activeAccounts.find((a) => a.id === data.account_id);
        const toAcc = debtTargetAccount;
        if (!fromAcc) return false;

        const isCross = fromAcc.currency !== toAcc.currency;
        let amountFrom = data.amount;
        let amountTo = data.amount;
        let fxRateUsed: number | null = null;

        if (isCross && fxRate > 0) {
          fxRateUsed = fxRate;
          const userCurrency = data.currency;
          if (userCurrency === fromAcc.currency) {
            if (fromAcc.currency === "USD" && toAcc.currency === "MXN") amountTo = data.amount * fxRate;
            else if (fromAcc.currency === "MXN" && toAcc.currency === "USD") amountTo = data.amount / fxRate;
          } else if (userCurrency === toAcc.currency) {
            amountTo = data.amount;
            if (fromAcc.currency === "USD" && toAcc.currency === "MXN") amountFrom = data.amount / fxRate;
            else if (fromAcc.currency === "MXN" && toAcc.currency === "USD") amountFrom = data.amount * fxRate;
          }
        }

        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: data.account_id,
          to_account_id: toAcc.id,
          amount_from: Math.round(amountFrom * 100) / 100,
          currency_from: fromAcc.currency,
          amount_to: Math.round(amountTo * 100) / 100,
          currency_to: toAcc.currency,
          fx_rate: fxRateUsed,
          transfer_date: format(data.transaction_date, "yyyy-MM-dd"),
          description: data.description || `Pago: ${debtTarget!.name}`,
          created_from: "manual",
        });

        queryClient.invalidateQueries({ queryKey: ["transfers"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["debts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
        return true;
      } finally {
        setTransferSaving(false);
      }
    }

    // ============================================================
    // Plain transfer
    // ============================================================
    if (activeTab === "transfer") {
      if (!toAccountId || toAccountId === data.account_id) return false;
      setTransferSaving(true);
      try {
        const fromAcc = activeAccounts.find((a) => a.id === data.account_id);
        const toAcc = activeAccounts.find((a) => a.id === toAccountId);
        if (!fromAcc || !toAcc) return false;

        const isCross = fromAcc.currency !== toAcc.currency;
        let amountFrom = data.amount;
        let amountTo = data.amount;
        let fxRateUsed: number | null = null;

        if (isCross && fxRate > 0) {
          fxRateUsed = fxRate;
          const userCurrency = data.currency;
          if (userCurrency === fromAcc.currency) {
            amountFrom = data.amount;
            if (fromAcc.currency === "USD" && toAcc.currency === "MXN") amountTo = data.amount * fxRate;
            else if (fromAcc.currency === "MXN" && toAcc.currency === "USD") amountTo = data.amount / fxRate;
          } else if (userCurrency === toAcc.currency) {
            amountTo = data.amount;
            if (fromAcc.currency === "USD" && toAcc.currency === "MXN") amountFrom = data.amount / fxRate;
            else if (fromAcc.currency === "MXN" && toAcc.currency === "USD") amountFrom = data.amount * fxRate;
          }
        }

        // Auto-cierre de vencimiento
        const linkedDebt = debts.find((d) => d.account_id === toAccountId && d.is_active);
        let createdFrom = "manual";
        let finalDescription = data.description || undefined;
        if (linkedDebt && linkedDebt.due_day) {
          const today = new Date();
          const y = today.getFullYear();
          const m = today.getMonth();
          const dim = new Date(y, m + 1, 0).getDate();
          const dueDate = new Date(y, m, Math.min(linkedDebt.due_day, dim));
          dueDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);
          const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
          if (daysDiff <= 30) {
            createdFrom = "due_dates";
            finalDescription = `Pago: ${linkedDebt.name}`;
          }
        }

        await supabase.from("transfers").insert({
          user_id: user.id,
          from_account_id: data.account_id,
          to_account_id: toAccountId,
          amount_from: Math.round(amountFrom * 100) / 100,
          currency_from: fromAcc.currency,
          amount_to: Math.round(amountTo * 100) / 100,
          currency_to: toAcc.currency,
          fx_rate: fxRateUsed,
          transfer_date: format(data.transaction_date, "yyyy-MM-dd"),
          description: finalDescription,
          created_from: createdFrom,
        });

        queryClient.invalidateQueries({ queryKey: ["transfers"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
        return true;
      } finally {
        setTransferSaving(false);
      }
    }

    // ============================================================
    // Income / expense flow
    // ============================================================
    const account = accounts.find((a) => a.id === data.account_id);
    const crossCurrency = account && data.currency !== account.currency;

    let finalAmount = data.amount;
    let finalCurrency = data.currency;
    let exchangeRate = 1;
    let amountInBase: number | undefined;
    let description = data.description || "";
    let notes = "";

    if (crossCurrency && fxRate > 0) {
      if (data.currency === "USD" && account!.currency === "MXN") {
        finalAmount = data.amount * fxRate;
        amountInBase = finalAmount;
        exchangeRate = fxRate;
      } else if (data.currency === "MXN" && account!.currency === "USD") {
        finalAmount = data.amount / fxRate;
        amountInBase = data.amount;
        exchangeRate = 1 / fxRate;
      }
      finalCurrency = account!.currency;
      const eqMxn = amountInBase ?? finalAmount;
      notes = `Originalmente $${data.amount.toFixed(2)} ${data.currency} · TC: $${fxRate.toFixed(2)} · Equivalente: $${eqMxn.toFixed(2)} MXN`;
    } else if (!crossCurrency && account && account.currency !== "MXN") {
      const rateForCurrency = fxRates[account.currency] || fxRate;
      if (rateForCurrency > 0) {
        amountInBase = data.amount * rateForCurrency;
        exchangeRate = rateForCurrency;
        notes = `$${data.amount.toFixed(2)} ${account.currency} · TC: $${rateForCurrency.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`;
      }
    }

    await createTransaction.mutateAsync({
      account_id: data.account_id,
      amount: Math.round(finalAmount * 100) / 100,
      currency: finalCurrency,
      exchange_rate: exchangeRate,
      amount_in_base: amountInBase,
      notes: notes || undefined,
      category_id: data.category_id && data.category_id.length > 0 ? data.category_id : undefined,
      description,
      type: activeTab as "income" | "expense",
      transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
    });

    if (activeTab === "expense") {
      setTimeout(() => checkAlerts(), 1000);
    }

    if (makeRecurring && data.account_id) {
      const nextDate = getNextExecutionDate(data.transaction_date, recurringFrequency);
      await createRecurring.mutateAsync({
        name: data.description || "Pago recurrente",
        description: data.description || null,
        type: activeTab as "income" | "expense",
        account_id: data.account_id,
        category_id: data.category_id || undefined,
        amount: data.amount,
        currency: data.currency,
        frequency: recurringFrequency,
        start_date: format(data.transaction_date, "yyyy-MM-dd"),
        next_execution_date: format(nextDate, "yyyy-MM-dd"),
        payments_made: 1,
        requires_manual_action: recurringManual,
      });
      queryClient.invalidateQueries({ queryKey: ["upcoming_recurring"] });
    }

    return true;
  };

  const isPending = createTransaction.isPending || transferSaving;

  return {
    submitTransaction,
    isPending,
    LONG_TERM_TYPES,
    isLongTermDebt,
    allLongTermDebts,
  };
}
