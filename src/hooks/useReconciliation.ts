import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyAbs } from "@/lib/formatters";

export interface UnregisteredExpense {
  id: string;
  concept: string;
  amount: number;
  category_id: string | null;
  expense_date?: string; // YYYY-MM-DD; falls back to params.date when missing
}

export function useReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const reconcileFixedDebt = async (params: {
    debtId: string;
    previousBalance: number;
    realBalance: number;
    currency: string;
    debtName: string;
  }) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const difference = params.realBalance - params.previousBalance;
      if (difference === 0) {
        toast({ title: "El saldo ya está actualizado" });
        return;
      }

      // 1. Update debt balance
      await supabase
        .from("debts")
        .update({
          current_balance: params.realBalance,
          last_statement_balance: params.realBalance,
          last_statement_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", params.debtId);

      // 2. If real > expected → financial cost
      if (difference > 0) {
        await supabase.from("debt_payments").insert({
          debt_id: params.debtId,
          user_id: user.id,
          amount: difference,
          payment_type: "interest_insurance",
          interest_amount: difference,
          payment_date: new Date().toISOString().split("T")[0],
          notes: "Intereses y seguros — ajuste por estado de cuenta",
        });
      }

      // 3. Reconciliation log
      await supabase.from("reconciliation_logs" as any).insert({
        user_id: user.id,
        debt_id: params.debtId,
        reconciliation_date: new Date().toISOString().split("T")[0],
        previous_balance: params.previousBalance,
        real_balance: params.realBalance,
        difference: Math.abs(difference),
        financial_cost: difference > 0 ? difference : 0,
        unregistered_expenses: 0,
      });

      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });

      const financialCostMsg = difference > 0
        ? ` · Costo financiero: ${formatCurrencyAbs(difference, params.currency)}`
        : "";
      toast({ title: `Saldo actualizado${financialCostMsg}` });
    } catch (err: any) {
      toast({ title: "Error al actualizar el saldo", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const reconcileCreditCard = async (params: {
    debtId?: string;
    accountId?: string;
    previousBalance: number;
    realBalance: number;
    currency: string;
    unregisteredExpenses: UnregisteredExpense[];
    date: string;
  }) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const totalDifference = params.realBalance - params.previousBalance;
      if (totalDifference === 0 && params.unregisteredExpenses.length === 0) {
        toast({ title: "El saldo ya está actualizado" });
        return;
      }

      const totalUnregistered = params.unregisteredExpenses.reduce((s, e) => s + e.amount, 0);
      const financialCost = Math.max(0, totalDifference - totalUnregistered);

      // 1. Register unregistered expenses as real transactions
      for (const expense of params.unregisteredExpenses) {
        if (!expense.amount || expense.amount <= 0) continue;
        await supabase.from("transactions").insert({
          user_id: user.id,
          account_id: params.accountId || null,
          category_id: expense.category_id || null,
          type: "expense",
          amount: expense.amount,
          amount_in_base: expense.amount,
          currency: params.currency,
          exchange_rate: 1,
          description: expense.concept || "Gasto no registrado",
          transaction_date: params.date,
          notes: "Registrado durante conciliación de estado de cuenta",
        });
      }

      // 2. Financial cost as debt payment
      if (financialCost > 0 && params.debtId) {
        await supabase.from("debt_payments").insert({
          debt_id: params.debtId,
          user_id: user.id,
          amount: financialCost,
          payment_type: "interest_insurance",
          interest_amount: financialCost,
          payment_date: params.date,
          notes: "Intereses y comisiones — ajuste por estado de cuenta",
        });
      }

      // 3. Update debt balance
      if (params.debtId) {
        await supabase
          .from("debts")
          .update({
            current_balance: params.realBalance,
            last_statement_balance: params.realBalance,
            last_statement_date: params.date,
          })
          .eq("id", params.debtId);
      }

      // 4. Reconciliation log
      await supabase.from("reconciliation_logs" as any).insert({
        user_id: user.id,
        debt_id: params.debtId || null,
        account_id: params.accountId || null,
        reconciliation_date: params.date,
        previous_balance: params.previousBalance,
        real_balance: params.realBalance,
        difference: Math.abs(totalDifference),
        unregistered_expenses: totalUnregistered,
        financial_cost: financialCost,
      });

      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });

      const parts: string[] = [];
      if (totalUnregistered > 0) parts.push(`Gastos registrados: ${formatCurrencyAbs(totalUnregistered, params.currency)}`);
      if (financialCost > 0) parts.push(`Costo financiero: ${formatCurrencyAbs(financialCost, params.currency)}`);
      toast({ title: `Conciliación completada${parts.length ? " · " + parts.join(" · ") : ""}` });
    } catch (err: any) {
      toast({ title: "Error al conciliar", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { reconcileFixedDebt, reconcileCreditCard, isLoading };
}
