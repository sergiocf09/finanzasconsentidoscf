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
        onConflict: "user_id,category_id,period,month,year,budget_type",
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
   * Searches backward up to 24 months for the most recent active budget
   * of the given type. Returns the rows of that month or [] if none found.
   */
  const fetchPreviousBudget = async (
    budgetType: "expense" | "income",
    fromYear: number,
    fromMonth: number
  ): Promise<{ year: number; month: number; rows: any[] }> => {
    if (!user) return { year: fromYear, month: fromMonth, rows: [] };
    let y = fromYear;
    let m = fromMonth;
    for (let i = 0; i < 24; i++) {
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", y)
        .eq("month", m)
        .eq("budget_type", budgetType)
        .eq("is_active", true);
      if (error) continue;
      if (data && data.length > 0) {
        return { year: y, month: m, rows: data };
      }
    }
    return { year: fromYear, month: fromMonth, rows: [] };
  };

  /**
   * Expands a start (year, month) plus horizon into an array of {year, month}.
   * - "single": just the month
   * - "quarter": the calendar quarter the month belongs to (3 months)
   * - "rest_of_year": from this month to December of the same year
   * - "full_year": months 1..12 of the year
   */
  const expandMonthRange = (
    year: number,
    month: number,
    horizon: "single" | "quarter" | "rest_of_year" | "full_year"
  ): { year: number; month: number }[] => {
    if (horizon === "single") return [{ year, month }];
    if (horizon === "quarter") {
      const qStart = Math.floor((month - 1) / 3) * 3 + 1;
      return [0, 1, 2].map((i) => ({ year, month: qStart + i }));
    }
    if (horizon === "rest_of_year") {
      const out: { year: number; month: number }[] = [];
      for (let m = month; m <= 12; m++) out.push({ year, month: m });
      return out;
    }
    // full_year
    return Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));
  };

  /**
   * Marks all active budgets for the given year/month as inactive.
   */
  const deactivateOldBudgets = async (
    year: number,
    month: number,
    budgetType: "expense" | "income" = "expense"
  ): Promise<void> => {
    if (!user) return;
    await supabase
      .from("budgets")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("budget_type", budgetType)
      .eq("is_active", true);
  };

  /**
   * Returns the count of active budgets for the given year/month and type.
   */
  const checkExistingBudgets = async (
    year: number,
    month: number,
    budgetType: "expense" | "income" = "expense"
  ): Promise<number> => {
    if (!user) return 0;
    const { count, error } = await supabase
      .from("budgets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("budget_type", budgetType)
      .eq("is_active", true);
    if (error) {
      console.error("Budget check error:", error);
      return 0;
    }
    return count ?? 0;
  };

  const fetchHistoricalIncome = async (months: number): Promise<number> => {
    const end = endOfMonth(new Date());
    const start = startOfMonth(subMonths(new Date(), months));
    const { data, error } = await supabase
      .from("transactions")
      .select("amount")
      .eq("type", "income")
      .gte("transaction_date", format(start, "yyyy-MM-dd"))
      .lte("transaction_date", format(end, "yyyy-MM-dd"));
    if (error) throw error;
    const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
    return Math.round(total / months);
  };

  return {
    fetchHistoricalSpend,
    fetchHistoricalIncome,
    upsertBudgets,
    deactivateOldBudgets,
    checkExistingBudgets,
    isPending,
  };
}
