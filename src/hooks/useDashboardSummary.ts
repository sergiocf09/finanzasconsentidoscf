import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DashboardSummary {
  period_totals: {
    income: number;
    expense: number;
  };
  transfer_total: number;
  accounts_summary: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    current_balance: number;
    is_active: boolean;
  }> | null;
  recent_transactions: Array<{
    id: string;
    account_id: string;
    category_id: string | null;
    type: string;
    amount: number;
    currency: string;
    description: string | null;
    transaction_date: string;
    created_at: string;
  }> | null;
  upcoming_debts: Array<{
    id: string;
    name: string;
    due_day: number;
    minimum_payment: number;
    currency: string;
    account_id: string | null;
  }> | null;
  upcoming_goals: Array<{
    id: string;
    name: string;
    contribution_day: number;
    monthly_contribution: number;
    account_id: string | null;
  }> | null;
  active_budgets: Array<{
    id: string;
    name: string;
    category_id: string | null;
    amount: number;
    spent: number;
    period: string;
    month: number | null;
    year: number;
    alert_threshold: number;
  }> | null;
  paid_due_dates: Array<{
    description: string;
    to_account_id: string;
  }> | null;
}

interface UseDashboardSummaryOptions {
  startDate?: Date;
  endDate?: Date;
}

export function useDashboardSummary(options?: UseDashboardSummaryOptions) {
  const { user } = useAuth();

  const startDate = options?.startDate ?? startOfMonth(new Date());
  const endDate = options?.endDate ?? endOfMonth(new Date());

  const query = useQuery({
    queryKey: [
      "dashboard_summary",
      user?.id,
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
      });

      if (error) throw error;
      return data as unknown as DashboardSummary;
    },
    enabled: !!user,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
