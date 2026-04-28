import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export interface BudgetInsert {
  user_id: string;
  category_id: string;
  name: string;
  amount: number;
  period: "monthly";
  month: number;
  year: number;
  spent: number;
  created_from: string | null;
  is_active: boolean;
  budget_type: "expense" | "income";
}

export function useBudgetWizard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  /**
   * Fetches expense totals per category for the last `months` months.
   * Returns a map of category_id -> total amount across the period.
   */
  const fetchHistoricalSpend = async (
    months: number,
    type: "income" | "expense" = "expense"
  ): Promise<Record<string, number>> => {
    if (!user) return {};
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(new Date(), months));
    const { data: txs } = await supabase
      .from("transactions")
      .select("category_id, amount")
      .eq("type", type)
      .gte("transaction_date", format(start, "yyyy-MM-dd"))
      .lte("transaction_date", format(end, "yyyy-MM-dd"));
    const totals: Record<string, number> = {};
    (txs ?? []).forEach((tx: any) => {
      if (tx.category_id) {
        totals[tx.category_id] = (totals[tx.category_id] || 0) + Number(tx.amount);
      }
    });
    return totals;
  };

  /**
   * Upserts budget rows for the given period and recalculates spent.
   */
  const upsertBudgets = async (
    inserts: BudgetInsert[],
    year: number,
    month: number
  ): Promise<void> => {
    if (inserts.length === 0) return;
    setIsPending(true);
    try {
      const { error } = await supabase.from("budgets").upsert(inserts as any, {
        onConflict: "user_id,category_id,period,month,year",
        ignoreDuplicates: false,
      });
      if (error) throw error;

      await supabase.rpc("recalculate_budget_spent", {
        p_year: year,
        p_month: month,
      });

      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_summary"] });
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Marks all active budgets for the given year/month as inactive.
   */
  const deactivateOldBudgets = async (year: number, month: number): Promise<void> => {
    if (!user) return;
    await supabase
      .from("budgets")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_active", true);
  };

  /**
   * Returns the count of active budgets for the given year/month.
   */
  const checkExistingBudgets = async (year: number, month: number): Promise<number> => {
    if (!user) return 0;
    const { count, error } = await supabase
      .from("budgets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_active", true);
    if (error) {
      console.error("Budget check error:", error);
      return 0;
    }
    return count ?? 0;
  };

  return {
    fetchHistoricalSpend,
    upsertBudgets,
    deactivateOldBudgets,
    checkExistingBudgets,
    isPending,
  };
}
