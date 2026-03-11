import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
  month: number | null;
  year: number;
  spent: number;
  alert_threshold: number;
  alert_sent: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetData {
  category_id?: string;
  name: string;
  amount: number;
  period: Budget['period'];
  month?: number;
  year: number;
  alert_threshold?: number;
}

export function useBudgets(year?: number, month?: number) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const currentYear = year ?? new Date().getFullYear();
  const currentMonth = month ?? new Date().getMonth() + 1;

  const budgetsQuery = useQuery({
    queryKey: ['budgets', user?.id, currentYear, currentMonth],
    queryFn: async () => {
      // Recalculate spent from actual transactions before fetching
      await supabase.rpc('recalculate_budget_spent', {
        p_year: currentYear,
        p_month: currentMonth,
      });

      let query = supabase
        .from('budgets')
        .select('*')
        .eq('year', currentYear)
        .eq('is_active', true);
      
      // Get monthly budgets for the current month OR yearly budgets
      const { data, error } = await query.or(`month.eq.${currentMonth},period.eq.yearly`);
      
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!user,
  });

  const createBudget = useMutation({
    mutationFn: async (data: CreateBudgetData) => {
      const { error } = await supabase
        .from('budgets')
        .insert({
          ...data,
          user_id: user!.id,
          spent: 0,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Presupuesto creado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateBudget = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Budget> & { id: string }) => {
      const { error } = await supabase
        .from('budgets')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Presupuesto actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Presupuesto eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate totals and alerts
  const totalBudgeted = budgetsQuery.data?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const totalSpent = budgetsQuery.data?.reduce((sum, b) => sum + b.spent, 0) ?? 0;
  const budgetsNearLimit = budgetsQuery.data?.filter(b => b.spent / b.amount >= b.alert_threshold) ?? [];

  return {
    budgets: budgetsQuery.data ?? [],
    isLoading: budgetsQuery.isLoading,
    error: budgetsQuery.error,
    totalBudgeted,
    totalSpent,
    budgetsNearLimit,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
