import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/useAccounts";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useDebts } from "@/hooks/useDebts";
import { useRecurringPayments, getNextExecutionDate } from "@/hooks/useRecurringPayments";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { toast } from "sonner";
import { format } from "date-fns";

export interface VoiceSubmitInput {
  editType: string;
  editAmount: string;
  editAccountId: string;
  editToAccountId: string;
  editCategoryId: string;
  editDescription: string;
  editDate: string;
  editCurrency: string;
  cleanTranscript: string;
  committedText: string;
  makeRecurring: boolean;
  recurringFrequency: string;
  requiresManualAction: boolean;
}

export interface VoiceLogInput {
  transcript_raw: string;
  parsed_json: any;
  confidence: number;
}

export function useVoiceSubmit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { accounts } = useAccounts();
  const { checkAlerts } = useBudgetAlerts();
  const { debts } = useDebts({ enabled: true });
  const { createPayment: createRecurring } = useRecurringPayments();
  const { rates: fxRates } = useExchangeRate();
  const [isPending, setIsPending] = useState(false);

  const logVoiceTranscript = async (data: VoiceLogInput) => {
    if (!user) return;
    await supabase.from("voice_logs").insert([{
      user_id: user.id,
      transcript_raw: data.transcript_raw,
      parsed_json: data.parsed_json,
      confidence: data.confidence,
    }]);
  };

  const submitVoiceTransaction = async (input: VoiceSubmitInput): Promise<void> => {
    if (!user) return;
    setIsPending(true);
    try {
      const {
        editType, editAmount, editAccountId, editToAccountId, editCategoryId,
        editDescription, editDate, editCurrency, cleanTranscript, committedText,
        makeRecurring, recurringFrequency, requiresManualAction,
      } = input;
      const amount = parseFloat(editAmount);

      if (editType === "transfer") {
        const from = accounts.find(a => a.id === editAccountId)!;
        const to = accounts.find(a => a.id === editToAccountId)!;
        const usdRate = fxRates["USD"] || 1;
        const userCurrency = editCurrency;

        let amountFrom = amount;
        let amountTo = amount;
        let fxRateUsed: number | null = null;

        if (userCurrency === from.currency && from.currency !== to.currency) {
          fxRateUsed = usdRate;
          if (from.currency === "USD" && to.currency === "MXN") amountTo = amount * usdRate;
          else if (from.currency === "MXN" && to.currency === "USD") amountTo = amount / usdRate;
          amountFrom = amount;
        } else if (userCurrency !== from.currency && userCurrency === to.currency) {
          fxRateUsed = usdRate;
          amountTo = amount;
          if (from.currency === "USD" && to.currency === "MXN") amountFrom = amount / usdRate;
          else if (from.currency === "MXN" && to.currency === "USD") amountFrom = amount * usdRate;
        }

        // B.5: Auto-cierre de vencimiento si la cuenta destino tiene una deuda activa con due_day próximo (≤30 días)
        const linkedDebt = debts.find(d => d.account_id === editToAccountId && d.is_active);
        let createdFrom = "voice";
        let finalDescription = editDescription || cleanTranscript || committedText;
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
          from_account_id: editAccountId,
          to_account_id: editToAccountId,
          amount_from: Math.round(amountFrom * 100) / 100,
          currency_from: from.currency,
          amount_to: Math.round(amountTo * 100) / 100,
          currency_to: to.currency,
          fx_rate: fxRateUsed,
          transfer_date: editDate,
          description: finalDescription,
          created_from: createdFrom,
        });
        queryClient.invalidateQueries({ queryKey: ["transfers"] });
      } else {
        const acc = accounts.find(a => a.id === editAccountId)!;
        let finalAmount = amount;
        let amountInBase = amount;
        let exchangeRate = 1;
        let notes: string | null = null;

        const usdRate = fxRates["USD"] || 0;
        if (editCurrency !== acc.currency && usdRate > 0) {
          if (editCurrency === "MXN" && acc.currency === "USD") {
            finalAmount = amount / usdRate;
            amountInBase = amount;
            exchangeRate = 1 / usdRate;
            notes = `Registrado: $${amount.toFixed(2)} MXN · TC: $${usdRate.toFixed(2)} · En cuenta: $${finalAmount.toFixed(2)} USD`;
          } else if (editCurrency === "USD" && acc.currency === "MXN") {
            finalAmount = amount * usdRate;
            amountInBase = finalAmount;
            exchangeRate = usdRate;
            notes = `Registrado: $${amount.toFixed(2)} USD · TC: $${usdRate.toFixed(2)} · Equivalente: $${finalAmount.toFixed(2)} MXN`;
          }
        } else if (editCurrency === acc.currency && acc.currency !== "MXN") {
          const rateForCurrency = fxRates[acc.currency] || 0;
          if (rateForCurrency > 0) {
            amountInBase = amount * rateForCurrency;
            exchangeRate = rateForCurrency;
            notes = `$${amount.toFixed(2)} ${acc.currency} · TC: $${rateForCurrency.toFixed(2)} · Equivalente: $${amountInBase.toFixed(2)} MXN`;
          }
        }

        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: editAccountId,
          category_id: editCategoryId || null,
          type: editType,
          amount: finalAmount,
          currency: acc.currency,
          exchange_rate: exchangeRate,
          amount_in_base: amountInBase,
          notes,
          description: editDescription || cleanTranscript || committedText,
          transaction_date: editDate,
          voice_transcript: committedText,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });

      if (editType === "expense") {
        setTimeout(() => checkAlerts(), 1000);
      }

      if (makeRecurring && editType !== "transfer" && editAccountId) {
        const acc = accounts.find(a => a.id === editAccountId)!;
        const txDate = new Date(editDate + "T12:00:00");
        const nextDate = getNextExecutionDate(txDate, recurringFrequency);
        await createRecurring.mutateAsync({
          name: editDescription || cleanTranscript || committedText || "Pago recurrente",
          description: editDescription || cleanTranscript || committedText || null,
          type: editType,
          account_id: editAccountId,
          category_id: editCategoryId || undefined,
          amount: parseFloat(editAmount),
          currency: acc.currency,
          frequency: recurringFrequency,
          start_date: editDate,
          next_execution_date: format(nextDate, "yyyy-MM-dd"),
          payments_made: 1,
          requires_manual_action: requiresManualAction,
        });
        queryClient.invalidateQueries({ queryKey: ["recurring_payments"] });
        queryClient.invalidateQueries({ queryKey: ["upcoming_recurring"] });
      }

      toast.success("Registrado correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { submitVoiceTransaction, logVoiceTranscript, isPending };
}
