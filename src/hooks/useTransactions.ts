import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense' | 'transfer' | 'adjustment_income' | 'adjustment_expense';
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_in_base: number | null;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  related_account_id: string | null;
  voice_transcript: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  account_id: string;
  category_id?: string;
  type: Transaction['type'];
  amount: number;
  currency: string;
  exchange_rate?: number;
  amount_in_base?: number;
  description?: string;
  notes?: string;
  transaction_date: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  related_account_id?: string;
  voice_transcript?: string;
}

export function useTransactions(options?: { startDate?: Date; endDate?: Date }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const startDate = options?.startDate ?? startOfMonth(new Date());
  const endDate = options?.endDate ?? endOfMonth(new Date());

  const transactionsQuery = useQuery({
    queryKey: ['transactions', user?.id, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transaction_date', format(endDate, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const { data: newTx, error } = await supabase
        .from('transactions')
        .insert({
          ...data,
          user_id: user!.id,
          amount_in_base: data.amount * (data.exchange_rate ?? 1),
        })
        .select()
        .single();
      
      if (error) throw error;
      return newTx;
    },
    onSuccess: (_data, _vars, _ctx) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento registrado", description: "Se ha guardado correctamente." });
      // Budget alert check will be triggered by the caller via onTransactionCreated callback
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Transaction> & { id: string }) => {
      // Fetch old transaction to merge fields
      const { data: oldTx, error: fetchErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const merged = { ...oldTx, ...data };
      merged.amount_in_base = merged.amount * (merged.exchange_rate ?? 1);

      // Use atomic SECURITY DEFINER function (delete+insert in single DB transaction)
      const { data: result, error } = await supabase.rpc('atomic_update_transaction', {
        p_old_id: id,
        p_user_id: merged.user_id,
        p_account_id: merged.account_id,
        p_type: merged.type,
        p_amount: merged.amount,
        p_transaction_date: merged.transaction_date,
        p_category_id: merged.category_id ?? null,
        p_description: merged.description ?? null,
        p_notes: merged.notes ?? null,
        p_currency: merged.currency ?? 'MXN',
        p_exchange_rate: merged.exchange_rate ?? 1,
        p_amount_in_base: merged.amount_in_base ?? null,
        p_is_recurring: merged.is_recurring ?? false,
        p_recurring_frequency: merged.recurring_frequency ?? null,
        p_related_account_id: merged.related_account_id ?? null,
        p_voice_transcript: merged.voice_transcript ?? null,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento actualizado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: "Movimiento eliminado" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Calculate totals
  // Calculate totals — adjustments are excluded from income/expense
  const totals = transactionsQuery.data?.reduce(
    (acc, tx) => {
      if (tx.type === 'income') acc.income += tx.amount;
      else if (tx.type === 'expense') acc.expense += tx.amount;
      // transfers and adjustments are excluded from income/expense totals
      return acc;
    },
    { income: 0, expense: 0 }
  ) ?? { income: 0, expense: 0 };

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    totals,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
