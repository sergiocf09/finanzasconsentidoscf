import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface BudgetRule {
  id: string;
  user_id: string;
  rule_type: string;
  essential_ratio: number;
  discretionary_ratio: number;
  saving_investing_ratio: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useBudgetRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ['budget_rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_rules')
        .select('*')
        .eq('is_active', true)
        .limit(1);
      if (error) throw error;
      return (data?.[0] as BudgetRule) ?? null;
    },
    enabled: !!user,
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: { essential_ratio: number; discretionary_ratio: number; saving_investing_ratio: number }) => {
      const existing = rulesQuery.data;
      if (existing) {
        const { error } = await supabase.from('budget_rules').update(rule).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('budget_rules').insert({ ...rule, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_rules'] });
      toast({ title: "Regla actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    rule: rulesQuery.data ?? { essential_ratio: 0.5, discretionary_ratio: 0.3, saving_investing_ratio: 0.2 },
    isLoading: rulesQuery.isLoading,
    upsertRule,
  };
}
