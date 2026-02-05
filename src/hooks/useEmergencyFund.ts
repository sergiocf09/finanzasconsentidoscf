import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface EmergencyFund {
  id: string;
  user_id: string;
  goal_amount: number;
  current_amount: number;
  monthly_target: number | null;
  target_date: string | null;
  currency: string;
  months_of_expenses: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: string;
  fund_id: string;
  user_id: string;
  amount: number;
  contribution_date: string;
  notes: string | null;
  created_at: string;
}

export function useEmergencyFund() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fundQuery = useQuery({
    queryKey: ['emergency-fund', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emergency_fund')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as EmergencyFund | null;
    },
    enabled: !!user,
  });

  const contributionsQuery = useQuery({
    queryKey: ['emergency-fund-contributions', user?.id],
    queryFn: async () => {
      if (!fundQuery.data) return [];
      
      const { data, error } = await supabase
        .from('emergency_fund_contributions')
        .select('*')
        .eq('fund_id', fundQuery.data.id)
        .order('contribution_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Contribution[];
    },
    enabled: !!fundQuery.data,
  });

  const createFund = useMutation({
    mutationFn: async (data: { goal_amount: number; monthly_target?: number; target_date?: string; months_of_expenses?: number }) => {
      const { error } = await supabase
        .from('emergency_fund')
        .insert({
          ...data,
          user_id: user!.id,
          current_amount: 0,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-fund'] });
      toast({ title: "Fondo de emergencia creado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateFund = useMutation({
    mutationFn: async (data: Partial<EmergencyFund>) => {
      if (!fundQuery.data) return;
      
      const { error } = await supabase
        .from('emergency_fund')
        .update(data)
        .eq('id', fundQuery.data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-fund'] });
      toast({ title: "Fondo actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addContribution = useMutation({
    mutationFn: async (data: { amount: number; contribution_date?: string; notes?: string }) => {
      if (!fundQuery.data) throw new Error("No fund exists");
      
      const { error } = await supabase
        .from('emergency_fund_contributions')
        .insert({
          ...data,
          fund_id: fundQuery.data.id,
          user_id: user!.id,
          contribution_date: data.contribution_date ?? new Date().toISOString().split('T')[0],
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-fund'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-fund-contributions'] });
      toast({ title: "Aportación registrada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const progress = fundQuery.data 
    ? Math.min((fundQuery.data.current_amount / fundQuery.data.goal_amount) * 100, 100)
    : 0;

  return {
    fund: fundQuery.data,
    contributions: contributionsQuery.data ?? [],
    isLoading: fundQuery.isLoading,
    progress,
    createFund,
    updateFund,
    addContribution,
  };
}
