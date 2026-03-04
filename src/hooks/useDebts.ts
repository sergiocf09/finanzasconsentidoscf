import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: 'credit_card' | 'personal_loan' | 'mortgage' | 'car_loan' | 'student_loan' | 'other';
  creditor: string | null;
  original_amount: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  cut_day: number | null;
  start_date: string | null;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateDebtData {
  name: string;
  type: Debt['type'];
  creditor?: string;
  original_amount: number;
  current_balance: number;
  interest_rate?: number;
  minimum_payment?: number;
  due_day?: number;
  cut_day?: number;
  start_date?: string;
  currency?: string;
}

export function useDebts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const debtsQuery = useQuery({
    queryKey: ['debts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('is_active', true)
        .order('current_balance', { ascending: false });
      
      if (error) throw error;
      return data as Debt[];
    },
    enabled: !!user,
  });

  const createDebt = useMutation({
    mutationFn: async (data: CreateDebtData) => {
      const { error } = await supabase
        .from('debts')
        .insert({
          ...data,
          user_id: user!.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Deuda registrada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDebt = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Debt> & { id: string }) => {
      const { error } = await supabase
        .from('debts')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Deuda actualizada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      // Delete payments first
      const { error: errPay } = await supabase.from('debt_payments').delete().eq('debt_id', id);
      if (errPay) throw errPay;
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Deuda eliminada" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addPayment = useMutation({
    mutationFn: async (data: { debt_id: string; amount: number; payment_date?: string; notes?: string }) => {
      const { error } = await supabase
        .from('debt_payments')
        .insert({
          ...data,
          user_id: user!.id,
          payment_date: data.payment_date ?? new Date().toISOString().split('T')[0],
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: "Pago registrado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const totalDebt = debtsQuery.data?.reduce((sum, d) => sum + d.current_balance, 0) ?? 0;
  const totalMinimumPayment = debtsQuery.data?.reduce((sum, d) => sum + d.minimum_payment, 0) ?? 0;
  const snowballOrder = [...(debtsQuery.data ?? [])].sort((a, b) => a.current_balance - b.current_balance);
  const avalancheOrder = [...(debtsQuery.data ?? [])].sort((a, b) => b.interest_rate - a.interest_rate);

  return {
    debts: debtsQuery.data ?? [],
    isLoading: debtsQuery.isLoading,
    error: debtsQuery.error,
    totalDebt,
    totalMinimumPayment,
    snowballOrder,
    avalancheOrder,
    createDebt,
    updateDebt,
    deleteDebt,
    addPayment,
  };
}
